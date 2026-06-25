# ArmorIQ Guarded Agent

A miniature **AI-agent security platform**: an LLM agent that talks to MCP tool servers, with a
**policy layer that sits between the agent and its tools and enforces guardrails in real time** —
and signs every decision it makes.

The goal is *enforcement at the intent layer.* So the policy engine here doesn't just decide — it
produces a **cryptographically signed attestation** binding the agent's intent (the proposed tool
call) to the verdict and the signer, and every decision is written to a **tamper-evident hash chain**.

---

## What it does

```
  Operator                          Server (Express + Socket.IO, :4000)
  Dashboard ──── REST ────────────►  ├─ orchestrator       the guarded tool-use loop (only place a tool runs)
  (Next.js  ◄─── Socket.IO ───────┐  ├─ policy-engine      PURE module: rules + fixed precedence + injection heuristic
   :3000)                         │  ├─ semantic firewall  LLM judge: is this call faithful to user intent? ─ agent → OpenAI
      ▲                           └──┼─ attestation        Ed25519-signs every ALLOW/DENY verdict
      │ create/toggle rules,         ├─ audit              SHA-256 hash chain, verifiable + tamper-evident
      │ approvals, verify sigs       └─ mcp-client ──► MCP servers (discovered live, never hardcoded):
                                          • security-ops   custom server, stdio, 5 tools
                                          • context7       remote existing server, streamable-HTTP, 2 tools
```

The agent runs a real tool-use loop: **LLM proposes a tool call → policy engine decides
(ALLOW / DENY / PENDING_APPROVAL) → tool executes via MCP or is blocked → result fed back**, until
the agent replies with text. Tools are **discovered live** from the MCP servers — nothing is hardcoded.

The orchestrator is the *only* place a tool actually runs, and it runs one only after the policy
engine returns ALLOW. The agent can propose anything; it can enforce nothing.

---

## Three layers of defense (the policy engine is the heart)

1. **Deterministic rules** (`policy-engine`, pure) with a *fixed precedence* so conflicts resolve the
   same way every time.
2. **Semantic firewall** — an LLM judge that asks *"is this tool call a faithful execution of the
   user's intent, or is the agent hijacked by instructions injected via tool output/logs?"* Catches
   what a regex can't. Fails **open** (the deterministic guards already approved) and is toggleable.
3. **Cryptographic attestation** — every verdict is Ed25519-signed; the dashboard verifies the
   signature in-browser. Combined with the hash-chained audit log, the decision trail is both
   *attested* (who decided) and *tamper-evident* (nothing was altered after the fact).

### Decision precedence (how conflicts resolve)

`evaluate()` applies a **fixed, deterministic tier order** — the rule-list order is irrelevant, so
two rules can never "fight." First match wins:

```
circuit-breaker → BLOCK_TOOL → INPUT_VALIDATION → BUDGET_LIMIT → injection-heuristic
   → (semantic firewall, in the orchestrator) → REQUIRE_APPROVAL → default ALLOW
```

The principle encoded here: **every DENY tier beats APPROVAL.** We never pop an approval prompt for
something a hard rule already forbids, and a suspected injection is stopped outright rather than
handed to a human who might rubber-stamp it. This is covered by a unit test (block + approval on the
same tool → DENY wins).

---

## Guardrail rule types (all creatable in the dashboard, effective with no restart)
- **BLOCK_TOOL** — hard-deny a tool (e.g. never allow `unblock_ip`).
- **REQUIRE_APPROVAL** — hold the call for a human, with a `timeoutSeconds` + `AUTO_DENY`/`AUTO_ALLOW` fallback.
- **INPUT_VALIDATION** — regex / allowed-prefix (e.g. paths under `/sandbox/`) / max-length on an argument.
- **BUDGET_LIMIT** — cap tokens or tool-calls per conversation (or globally).

Rules are loaded from Postgres **on every turn**, so creating or toggling one in the dashboard takes
effect on the running agent immediately.

---

## MCP servers (no hardcoded tool lists)
Servers are configured in [`mcp-servers.json`](./mcp-servers.json) (or the `MCP_SERVERS` env) and
connected at boot — adding one is a **config edit, not a code change**:
- **`security-ops`** — a custom MCP server (this repo, `packages/mcp-servers/security-ops`) over stdio:
  `scan_logs`, `block_ip`, `unblock_ip`, `quarantine_device`, `create_incident`.
- **`context7`** — a real, existing **remote** MCP server over streamable-HTTP (`resolve-library-id`,
  `query-docs`). A server that fails to connect is logged and skipped; it doesn't block boot.

---

## How edge cases are handled

**An MCP server crashes mid-call.** A per-server **circuit breaker** records each failure; after 5
consecutive failures it opens for 30s and `evaluate()` denies all calls to that server (precedence
tier 1). One success closes it. The failed call is also fed back to the model as a failed
`ToolResult`, so the agent adapts instead of crashing. *(Breaker state is process-local; horizontal
scaling would need a shared store like Redis.)*

**The agent is hijacked via prompt injection.** Two layers: (a) a deterministic **heuristic** scans
the proposal's reasoning + args for known injection phrases and shell metacharacters; (b) the
**semantic firewall** asks whether the call serves the user's *original* intent or follows
instructions injected via tool output. Crucially, the **hard limits are the real boundary** —
`BLOCK_TOOL` and `INPUT_VALIDATION` read the concrete tool + args, not the model's intent, so they
can't be talked around. The firewall is defense-in-depth, never the sole boundary.

**Two rules conflict.** Resolved by the fixed precedence above — not rule order, not randomly.

**The approver is offline.** `REQUIRE_APPROVAL` carries `timeoutSeconds` and an `approverFallback`
(`AUTO_DENY` default, fail-safe). If no human responds in time, the fallback verdict resolves the
parked call. *(Pending approvals are in-memory — a restart drops them and the user re-issues; safe,
never silently approved.)*

---

## Why decisions are signed

A tamper-evident *log* tells you whether history was altered. Enforcement at the *intent layer* needs
more, so each verdict is **Ed25519-signed**. The signed payload binds
`proposalId · conversationId · toolName · argsHash · status · reason` — i.e. *the agent's intent → the
policy's verdict → the signer.* Anyone with the public key (`GET /policy/pubkey`) can verify a
decision offline; the dashboard does it in-browser via Web Crypto. Two independent properties result:

- **Attested** — a verdict provably came from the policy engine and was not altered (the signature
  breaks if any signed field changes).
- **Tamper-evident** — the audit **hash chain** (SHA-256 over canonical, key-order-independent JSON)
  proves no entry was inserted, deleted, reordered, or edited.

---

## Repository layout
```
packages/
  agent/          OpenAI tool-use loop + conversation/usage store + the semantic-firewall judge call
  policy-engine/  PURE decision engine: rules, precedence, circuit breaker, injection heuristic, semantic guard
  audit/          SHA-256 hash chain (canonical, tamper-evident) + Prisma repository
  mcp-client/     MCP registry + stdio / SSE / streamable-HTTP transports
  mcp-servers/
    security-ops/ the custom MCP server
  server/         Express + Socket.IO: orchestrator, attestation (Ed25519), approvals, audit service, routes
  shared/         Zod schemas shared across packages (Rule, Decision, ToolCallProposal, AuditEntry, …)
  dashboard/      Next.js operator console (live console, policies, audit, security, tools, overview)
```

---

## Run it locally
Prereqs: Node 20.9+, Docker, an OpenAI API key.
```bash
docker compose up -d                                              # Postgres (published on :5433)
cp .env.example .env                                              # set OPENAI_API_KEY; DATABASE_URL uses :5433
npm install
npm run build -w packages/mcp-servers/security-ops                # build the custom MCP server
npx prisma db push --schema packages/server/prisma/schema.prisma  # create tables + generate client
node --env-file=.env --import tsx packages/server/src/index.ts    # agent + policy server on :4000
# in another terminal:
npm run dev -w packages/dashboard                                 # operator console on :3000
```
Notes: an Ed25519 signing key is generated to `policy-key.json` on first boot (gitignored). Set
`SEMANTIC_GUARD=off` to disable the LLM firewall. The dashboard targets `:4000` by default
(`NEXT_PUBLIC_API_URL` to override).

---

## Verify it works
- **Tools:** `/tools` shows both MCP servers and their live-discovered tools.
- **Guardrails live:** toggle a rule on `/rules` → behavior changes on the next turn, no restart.
- **Attestation:** every decision on `/audit` and the console shows **✓ attested**; click *verify
  signature* (verified in-browser). Tamper with a row → signature **and** chain verification fail.
- **Defense-in-depth:** red-team scenarios in the console; blocked attempts land in `/security`.

```bash
npm run typecheck   # all workspaces
npm run test        # policy-engine, audit, server, mcp-client, dashboard
```

---

## Limitations (honest)
- **No auth layer** (proof-of-concept) — production would scope conversations/approvals to
  authenticated operators.
- **Signing key is local and self-trusted** — production would keep it in an HSM/KMS and periodically
  notarize the chain tip externally (an in-band chain can't catch an attacker who re-hashes the whole tail).
- **The injection heuristic is best-effort** string matching (misses obfuscation/base64); the semantic
  firewall depends on a model and **fails open**. Hard limits (`BLOCK_TOOL`, `INPUT_VALIDATION`) are
  the dependable boundary.
- **Circuit-breaker and pending-approval state are in-memory** — fine for a single process, needs a
  shared store to scale horizontally.
