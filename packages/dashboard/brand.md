# ArmorIQ — Brand

**Product:** ArmorIQ Guarded Agent — a policy-enforcing guardrail console for AI agents. Every tool
call an agent proposes is evaluated against policy (ALLOW / DENY / PENDING_APPROVAL), executed or
blocked, and written to a tamper-evident audit chain. The UI is the operator's view into that loop.

**Direction:** Clean, light-first, minimal operator console. No gradients, no glass, no AI-slop.
Soft off-white page, white cards that lift off it, hairline borders, one restrained blue accent,
monospace for machine values. Dark mode is defined and one class-toggle away.

**Category / mood / references:** ai/tech · technical + serious · Linear × Datadog.

---

## Palette — "Meridian" (blue, applied light-first)

Brand hue ≈ 250. The accent never overlaps the decision semantics (those own green/red/amber), so
status always reads cleanly. All values live in `src/app/globals.css` as OKLCH CSS variables —
**edit there.** Tokens map to Tailwind utilities via `@theme inline` (`bg-card`, `text-muted-foreground`,
`border-border`, `bg-allow`, etc.).

### Light (default, `:root`)
| Token | Value | Role |
|---|---|---|
| `--background` | `oklch(0.985 0.002 250)` | off-white page |
| `--foreground` | `oklch(0.21 0.015 250)` | ink |
| `--card` / `--popover` | `oklch(1 0 0)` | white surfaces |
| `--primary` | `oklch(0.52 0.16 250)` | actions, links, focus |
| `--muted-foreground` | `oklch(0.50 0.015 250)` | secondary text |
| `--border` / `--input` | `oklch(0.92 0.004 250)` | hairlines |

### Dark (`.dark`)
| Token | Value |
|---|---|
| `--background` | `oklch(0.14 0.012 250)` |
| `--foreground` | `oklch(0.96 0.008 250)` |
| `--card` | `oklch(0.175 0.015 250)` |
| `--primary` | `oklch(0.70 0.15 250)` |

### Decision semantics (fixed, both themes)
| State | Token | Hue |
|---|---|---|
| ALLOW | `--allow` (+ `--allow-soft`) | green ~150 |
| DENY | `--deny` (+ `--deny-soft`) | red ~25 |
| PENDING_APPROVAL | `--pending` (+ `--pending-soft`) | amber ~75–80 |

All foreground/background pairs target WCAG AA (body ≥ 4.5:1, UI/large ≥ 3:1).

---

## Typography

- **Sans:** Geist (`--font-geist-sans`) — UI text, headings. Clean, neutral, anti-slop.
- **Mono:** Geist Mono (`--font-geist-mono`) — every machine value: IDs, hashes, IPs, tool names,
  args, sequence numbers, counts in KPIs. Mono = "this is a literal you can copy/trust."
- Both already wired via `next/font/google` in `src/app/layout.tsx`. Use `font-mono` + tabular-nums
  (already defaulted in globals) for any numeric column so it doesn't jitter.

No gradients. No decorative type. Hierarchy comes from size, weight, and spacing — not color.

---

## Tone / voice

Operational and exact. This is a control plane; the operator is making consequential calls
(block an IP, quarantine a device). Copy states what happened and what's needed — no cheerleading,
no exclamation points, no emoji.

Decisions are stated plainly: "Denied by rule #3", "Awaiting approval", "Executed". Errors name the
cause and the next step. Empty states explain what will appear here and how to make it appear.

Trust is the product. Anything about the audit chain ("Chain verified", "Broken at #N") is stated
with authority and never softened.

---

## Usage do / don't

- **Do** use `--primary` for the single primary action per view; everything else is secondary/ghost.
- **Do** color decisions only with the semantic tokens; never paint a DENY blue or an ALLOW with the brand.
- **Do** put hashes/ids/args in `font-mono`, middle-truncated, with a copy affordance.
- **Don't** add gradients, glassmorphism, drop-shadow stacks, or purple-on-purple AI-slop.
- **Don't** introduce a second accent hue — the palette is monochrome-blue + fixed status colors.
- **Don't** hardcode hex in components — read the CSS variables / Tailwind tokens.
