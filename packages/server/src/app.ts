import express from 'express';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { McpRegistry } from '@armoriq/mcp-client';
import { CircuitBreaker } from '@armoriq/policy-engine';
import { RuleSchema } from '@armoriq/shared';
import { runTurn } from './orchestrator.js';
import { emitToConversation } from './events.js';
import { ApprovalRegistry } from './approvals.js';
import { auditRecorder, getAudit, verifyAudit } from './auditService.js';
import { loadRules } from './rules.js';
import { publicKeyInfo, verifyAttestation, type Attestation } from './attestation.js';
import { prisma } from './db.js';

export interface AppDeps {
  registry: McpRegistry;
  circuitBreaker: CircuitBreaker;
  approvals: ApprovalRegistry;
}

export function createApp(deps: AppDeps): { app: express.Express; http: HttpServer; io: IOServer } {
  const app = express();
  // CORS for the operator dashboard, which is a separate origin (:3000 → :4000). Matches the
  // socket.io `origin: '*'` below. ponytail: open origin — PoC has no auth; scope to the dashboard
  // origin in production. Short-circuits the preflight that POST/PATCH JSON calls trigger.
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });
  app.use(express.json());
  const http = createHttpServer(app);
  const io = new IOServer(http, { cors: { origin: '*' } });

  // A dashboard client joins its conversation's room to receive that turn's event stream.
  io.on('connection', (socket) => {
    socket.on('join', (conversationId: string) => {
      if (typeof conversationId === 'string') socket.join(conversationId);
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/tools', (_req, res) => {
    res.json({ tools: deps.registry.listAllTools() });
  });

  app.get('/rules', async (_req, res) => {
    res.json({ rules: await loadRules() });
  });

  app.post('/rules', async (req, res) => {
    const parsed = RuleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const rule = parsed.data;
    await prisma.rule.create({ data: { ...rule, config: rule.config as object } });
    res.status(201).json({ rule });
  });

  // Toggle (enable/disable) a rule. loadRules() re-reads every turn, so this takes effect on the
  // running agent with no restart — the engine simply stops counting a disabled rule (evaluate.ts).
  app.patch('/rules/:id', async (req, res) => {
    const enabled = (req.body as { enabled?: unknown }).enabled;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled (boolean) required' });
      return;
    }
    try {
      const rule = await prisma.rule.update({ where: { id: req.params.id }, data: { enabled } });
      res.json({ rule });
    } catch {
      res.status(404).json({ error: 'no such rule' });
    }
  });

  app.delete('/rules/:id', async (req, res) => {
    try {
      await prisma.rule.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch {
      res.status(404).json({ error: 'no such rule' });
    }
  });

  // Public key for the policy engine's decision signatures — anyone can verify attestations offline.
  app.get('/policy/pubkey', (_req, res) => {
    res.json(publicKeyInfo());
  });

  // Server-side fallback verifier (the dashboard prefers verifying client-side with the public key).
  app.post('/policy/verify', (req, res) => {
    const att = (req.body as { attestation?: Attestation }).attestation;
    if (!att || typeof att !== 'object') {
      res.status(400).json({ error: 'attestation required' });
      return;
    }
    res.json({ valid: verifyAttestation(att) });
  });

  // Policy-layer status the dashboard surfaces (e.g. is the semantic firewall active).
  app.get('/policy/config', (_req, res) => {
    res.json({ semanticFirewall: process.env.SEMANTIC_GUARD !== 'off' });
  });

  app.get('/audit', async (req, res) => {
    const conversationId = typeof req.query.conversationId === 'string' ? req.query.conversationId : undefined;
    res.json({ entries: await getAudit(conversationId) });
  });

  app.get('/audit/verify', async (_req, res) => {
    res.json(await verifyAudit());
  });

  // Human approval response for a parked tool call.
  app.post('/approvals/:approvalId', (req, res) => {
    const verdict = (req.body as { decision?: unknown }).decision;
    if (verdict !== 'ALLOW' && verdict !== 'DENY') {
      res.status(400).json({ error: "decision must be 'ALLOW' or 'DENY'" });
      return;
    }
    const ok = deps.approvals.resolve(req.params.approvalId, verdict);
    if (!ok) {
      res.status(404).json({ error: 'no such pending approval' });
      return;
    }
    res.json({ ok: true });
  });

  // The one entrypoint that drives the guardrail loop. Events also stream live over socket.io.
  app.post('/conversations/:id/messages', async (req, res) => {
    const message = (req.body as { message?: unknown }).message;
    if (typeof message !== 'string' || message.trim() === '') {
      res.status(400).json({ error: 'message (non-empty string) required' });
      return;
    }
    try {
      const result = await runTurn(req.params.id, message, {
        registry: deps.registry,
        rules: await loadRules(),
        circuitBreaker: deps.circuitBreaker,
        audit: auditRecorder,
        approvals: deps.approvals,
        emit: (event) => emitToConversation(io, event),
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return { app, http, io };
}
