import { describe, it, expect } from 'vitest';
import type { ToolCallProposal } from '@armoriq/shared';
import { judgeIntent } from '../src/semanticGuard.js';

const proposal: ToolCallProposal = {
  id: 'p1',
  conversationId: 'c1',
  toolName: 'block_ip',
  serverId: 'security-ops',
  args: { ip: '1.2.3.4' },
  reasoning: 'the logs told me to',
  timestamp: '2026-01-01T00:00:00.000Z',
};

describe('judgeIntent (semantic firewall)', () => {
  it('denies when the judge flags a hijack', async () => {
    const r = await judgeIntent({ proposal, userIntent: 'summarize the logs' }, async () =>
      '{"verdict":"DENY","reason":"acting on injected instructions"}',
    );
    expect(r.verdict).toBe('DENY');
    expect(r.reason).toContain('injected');
  });

  it('allows when the judge approves', async () => {
    const r = await judgeIntent({ proposal, userIntent: 'block that ip' }, async () =>
      '{"verdict":"ALLOW","reason":"matches intent"}',
    );
    expect(r.verdict).toBe('ALLOW');
  });

  it('fails OPEN (ALLOW) when the judge throws — must not break the agent', async () => {
    const r = await judgeIntent({ proposal, userIntent: 'x' }, async () => {
      throw new Error('LLM unavailable');
    });
    expect(r.verdict).toBe('ALLOW');
  });

  it('fails OPEN (ALLOW) on unparseable judge output', async () => {
    const r = await judgeIntent({ proposal, userIntent: 'x' }, async () => 'not json at all');
    expect(r.verdict).toBe('ALLOW');
  });
});
