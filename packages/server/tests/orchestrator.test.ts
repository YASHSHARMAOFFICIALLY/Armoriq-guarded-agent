import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ONLY the LLM boundary. evaluate + CircuitBreaker are the real policy engine; the registry,
// audit log, and approval gate are injected fakes. This is the cross-package guardrail-loop test.
vi.mock('@armoriq/agent', () => ({
  proposeNextStep: vi.fn(),
  conversationStore: { getUsage: vi.fn(() => ({ tokensUsed: 0, toolCallsMade: 0 })) },
  // semantic firewall LLM call: judge ALLOW so the ALLOW path stays ALLOW (judgeIntent itself fails open).
  judge: vi.fn(async () => '{"verdict":"ALLOW","reason":"ok"}'),
}));

import { proposeNextStep } from '@armoriq/agent';
import { CircuitBreaker } from '@armoriq/policy-engine';
import type { Rule, ToolCallProposal, McpToolSchema } from '@armoriq/shared';
import { runTurn } from '../src/orchestrator.js';
import type { RunTurnDeps, ServerEvent, ExecResult } from '../src/orchestrator.js';

const mockedPropose = vi.mocked(proposeNextStep);

const TOOLS: McpToolSchema[] = [
  { serverId: 'security-ops', name: 'block_ip', description: 'block', inputSchema: { type: 'object', properties: {} } },
];

function makeProposal(over: Partial<ToolCallProposal> = {}): ToolCallProposal {
  return {
    id: 'prop-1',
    conversationId: 'c1',
    toolName: 'block_ip',
    serverId: 'security-ops',
    args: { ip: '203.0.113.45', reason: 'brute force' },
    reasoning: 'the logs show repeated failures',
    timestamp: '2026-06-23T00:00:00.000Z',
    ...over,
  };
}

function makeDeps(over: Partial<RunTurnDeps> = {}): {
  deps: RunTurnDeps;
  events: ServerEvent[];
  audited: string[];
  exec: ReturnType<typeof vi.fn>;
} {
  const events: ServerEvent[] = [];
  const audited: string[] = [];
  const exec = vi.fn(async (): Promise<ExecResult> => ({
    success: true,
    data: [{ type: 'text', text: '{"status":"BLOCKED"}' }],
  }));
  const deps: RunTurnDeps = {
    registry: { listAllTools: () => TOOLS, executeTool: exec as RunTurnDeps['registry']['executeTool'] },
    rules: [],
    circuitBreaker: new CircuitBreaker(),
    audit: { record: async (type) => { audited.push(type); } },
    approvals: { waitForApproval: async () => 'ALLOW' },
    emit: (e) => events.push(e),
    ...over,
  };
  return { deps, events, audited, exec };
}

const approvalRule: Rule = {
  id: 'rule-approval',
  type: 'REQUIRE_APPROVAL',
  toolName: 'block_ip',
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  config: { approverFallback: 'AUTO_DENY', timeoutSeconds: 60 },
};

const blockRule: Rule = {
  id: 'rule-block',
  type: 'BLOCK_TOOL',
  toolName: 'block_ip',
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  config: {},
};

beforeEach(() => mockedPropose.mockReset());

describe('runTurn', () => {
  it('ALLOW: evaluates, executes via registry, audits, and feeds the result back', async () => {
    mockedPropose
      .mockResolvedValueOnce({ type: 'TOOL_CALL', proposal: makeProposal() })
      .mockResolvedValueOnce({ type: 'TEXT', content: 'done — the IP is blocked' });
    const { deps, events, audited, exec } = makeDeps();

    const result = await runTurn('c1', 'block the attacker', deps);

    expect(result.finalText).toBe('done — the IP is blocked');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].decision.status).toBe('ALLOW');
    expect(exec).toHaveBeenCalledWith('security-ops', 'block_ip', { ip: '203.0.113.45', reason: 'brute force' });
    // executeTool's MCP envelope is unwrapped to clean text, and proposalId is bridged on.
    expect(result.steps[0].result).toMatchObject({ proposalId: 'prop-1', success: true, data: '{"status":"BLOCKED"}' });
    expect(audited).toEqual(['PROPOSAL', 'DECISION', 'EXECUTION']);
    expect(events.map((e) => e.type)).toEqual(['turn:start', 'proposal', 'decision', 'execution', 'assistant:text', 'turn:end']);
  });

  it('DENY (BLOCK_TOOL): never executes, feeds the denial back to the model', async () => {
    mockedPropose
      .mockResolvedValueOnce({ type: 'TOOL_CALL', proposal: makeProposal() })
      .mockResolvedValueOnce({ type: 'TEXT', content: 'understood, policy blocks that' });
    const { deps, exec } = makeDeps({ rules: [blockRule] });

    const result = await runTurn('c1', 'block it', deps);

    expect(result.steps[0].decision.status).toBe('DENY');
    expect(exec).not.toHaveBeenCalled(); // structural guarantee: blocked tools never run
    expect(result.steps[0].result).toMatchObject({ proposalId: 'prop-1', success: false });
    expect(result.steps[0].result?.error).toMatch(/blocked/i);
    expect(result.finalText).toBe('understood, policy blocks that');
  });

  it('PENDING_APPROVAL: waits for the gate, then executes when approved', async () => {
    mockedPropose
      .mockResolvedValueOnce({ type: 'TOOL_CALL', proposal: makeProposal() })
      .mockResolvedValueOnce({ type: 'TEXT', content: 'approved and done' });
    const waitForApproval = vi.fn(async () => 'ALLOW' as const);
    const { deps, events, exec } = makeDeps({ rules: [approvalRule], approvals: { waitForApproval } });

    const result = await runTurn('c1', 'block it', deps);

    expect(events.some((e) => e.type === 'approval:required')).toBe(true);
    expect(waitForApproval).toHaveBeenCalledOnce();
    expect(exec).toHaveBeenCalledOnce();
    expect(result.steps[0].decision.status).toBe('ALLOW');
  });

  it('PENDING_APPROVAL: denial from the gate blocks execution', async () => {
    mockedPropose
      .mockResolvedValueOnce({ type: 'TOOL_CALL', proposal: makeProposal() })
      .mockResolvedValueOnce({ type: 'TEXT', content: 'request was denied' });
    const { deps, exec } = makeDeps({ rules: [approvalRule], approvals: { waitForApproval: async () => 'DENY' } });

    const result = await runTurn('c1', 'block it', deps);

    expect(result.steps[0].decision.status).toBe('DENY');
    expect(exec).not.toHaveBeenCalled();
  });

  it('circuit breaker open: denies before executing (real evaluate + breaker)', async () => {
    mockedPropose
      .mockResolvedValueOnce({ type: 'TOOL_CALL', proposal: makeProposal() })
      .mockResolvedValueOnce({ type: 'TEXT', content: 'server unhealthy' });
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    breaker.recordFailure('security-ops'); // trip it
    const { deps, exec } = makeDeps({ circuitBreaker: breaker });

    const result = await runTurn('c1', 'block it', deps);

    expect(result.steps[0].decision.status).toBe('DENY');
    expect(result.steps[0].decision.reason).toMatch(/circuit breaker/i);
    expect(exec).not.toHaveBeenCalled();
  });

  it('stops at MAX_STEPS to prevent an infinite tool loop', async () => {
    mockedPropose.mockResolvedValue({ type: 'TOOL_CALL', proposal: makeProposal() }); // never returns TEXT
    const { deps, exec, events } = makeDeps({ maxSteps: 3 });

    const result = await runTurn('c1', 'loop forever', deps);

    expect(result.stoppedReason).toBe('MAX_STEPS');
    expect(result.steps).toHaveLength(3);
    expect(exec).toHaveBeenCalledTimes(3);
    expect(events.some((e) => e.type === 'error')).toBe(true);
  });
});
