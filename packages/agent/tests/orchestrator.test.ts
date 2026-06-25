import { describe, it, expect, vi, beforeEach } from 'vitest';

// The LLM call is the one boundary we must mock — we can't hit a real model in a unit test.
// Everything else (proposal shape, serverId resolution, history threading, usage) is real.
vi.mock('../src/llmClient.js', () => ({
  callModel: vi.fn(),
  toOpenAiTools: vi.fn(() => []),
  REASONING_FIELD: '__reasoning__',
}));

import { callModel } from '../src/llmClient.js';
import { proposeNextStep, conversationStore } from '../src/orchestrator.js';
import type { McpToolSchema, ToolResult } from '@armoriq/shared';

const mockedCallModel = vi.mocked(callModel);

const tools: McpToolSchema[] = [
  {
    serverId: 'security-ops',
    name: 'block_ip',
    description: 'block an ip',
    inputSchema: { type: 'object', properties: { ip: { type: 'string' } }, required: ['ip'] },
  },
];

beforeEach(() => {
  mockedCallModel.mockReset();
});

describe('proposeNextStep', () => {
  it('returns plain text and records the user + assistant messages', async () => {
    mockedCallModel.mockResolvedValue({ type: 'TEXT', content: 'hello there', tokensUsed: 10 });
    const id = 'conv-text';

    const res = await proposeNextStep(id, 'hi', null, tools);

    expect(res).toEqual({ type: 'TEXT', content: 'hello there' });
    const history = conversationStore.getHistory(id);
    expect(history[0]).toEqual({ role: 'user', content: 'hi' });
    expect(history.at(-1)).toEqual({ role: 'assistant', content: 'hello there' });
  });

  it('builds a correctly shaped ToolCallProposal from a TOOL_CALL turn', async () => {
    mockedCallModel.mockResolvedValue({
      type: 'TOOL_CALL',
      toolName: 'block_ip',
      args: { ip: '1.2.3.4', reason: 'brute force' },
      reasoning: 'the logs show a brute-force attempt',
      tokensUsed: 25,
    });
    const id = 'conv-tool';

    const res = await proposeNextStep(id, 'block the attacker', null, tools);

    expect(res.type).toBe('TOOL_CALL');
    if (res.type !== 'TOOL_CALL') throw new Error('expected a tool call');
    const p = res.proposal;
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.conversationId).toBe(id);
    expect(p.toolName).toBe('block_ip');
    expect(p.serverId).toBe('security-ops'); // resolved from availableTools, not from the LLM
    expect(p.args).toEqual({ ip: '1.2.3.4', reason: 'brute force' });
    expect(p.reasoning).toBe('the logs show a brute-force attempt');
    expect(typeof p.timestamp).toBe('string');
  });

  it('only proposes — it never executes (no tool-result message ever appears for its own call)', async () => {
    mockedCallModel.mockResolvedValue({
      type: 'TOOL_CALL',
      toolName: 'block_ip',
      args: { ip: '1.2.3.4' },
      reasoning: 'r',
      tokensUsed: 5,
    });
    const id = 'conv-noexec';

    await proposeNextStep(id, 'go', null, tools);

    const history = conversationStore.getHistory(id);
    expect(history.some((m) => m.role === 'tool')).toBe(false); // agent can't produce a result
    expect(history.at(-1)).toMatchObject({ role: 'assistant', tool_calls: [{ function: { name: 'block_ip' } }] });
  });

  it('threads a fed-back ToolResult into the conversation and continues', async () => {
    const id = 'conv-loop';

    mockedCallModel.mockResolvedValueOnce({
      type: 'TOOL_CALL',
      toolName: 'block_ip',
      args: { ip: '1.2.3.4' },
      reasoning: 'r',
      tokensUsed: 5,
    });
    const first = await proposeNextStep(id, 'block it', null, tools);
    if (first.type !== 'TOOL_CALL') throw new Error('expected a tool call');
    const proposalId = first.proposal.id;

    mockedCallModel.mockResolvedValueOnce({ type: 'TEXT', content: 'done, the IP is blocked', tokensUsed: 8 });
    const result: ToolResult = { proposalId, success: true, data: { status: 'BLOCKED' } };
    const second = await proposeNextStep(id, null, result, tools);

    expect(second).toEqual({ type: 'TEXT', content: 'done, the IP is blocked' });
    const history = conversationStore.getHistory(id);
    const toolMsg = history.find((m) => m.role === 'tool') as { tool_call_id: string } | undefined;
    expect(toolMsg?.tool_call_id).toBe(proposalId); // result threaded back by proposal id
    expect(conversationStore.getUsage(id)).toEqual({ tokensUsed: 13, toolCallsMade: 1 });
  });
});
