// Pure-logic checks for the guardrail stream reducer — the event-correlation core.
// Run: npx tsx --test src/lib/use-guardrail-stream.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import type { ServerEvent, ToolCallProposal } from './types';
import { guardrailReducer, initialStreamState, type StreamState } from './use-guardrail-stream';

const CID = 'conv-1';
const proposal: ToolCallProposal = {
  id: 'p1',
  conversationId: CID,
  toolName: 'block_ip',
  serverId: 'security-ops',
  args: { ip: '1.2.3.4' },
  reasoning: 'suspicious traffic',
  timestamp: '2020-01-01T00:00:00.000Z',
};

function apply(events: ServerEvent[]): StreamState {
  return events.reduce((s, e) => guardrailReducer(s, { t: 'event', e }), initialStreamState);
}

function proposalItem(s: StreamState) {
  const item = s.items.find((i) => i.kind === 'proposal');
  if (!item || item.kind !== 'proposal') throw new Error('expected a proposal item');
  return item;
}

test('correlates proposal → decision → execution onto one row', () => {
  const s = apply([
    { type: 'turn:start', conversationId: CID },
    { type: 'proposal', conversationId: CID, proposal },
    { type: 'decision', conversationId: CID, proposalId: 'p1', decision: { status: 'ALLOW', reason: 'ok' } },
    {
      type: 'execution',
      conversationId: CID,
      proposalId: 'p1',
      result: { proposalId: 'p1', success: true, data: { ok: 1 } },
    },
    { type: 'turn:end', conversationId: CID },
  ]);
  const item = proposalItem(s);
  assert.equal(s.items.length, 1);
  assert.equal(item.decision?.status, 'ALLOW');
  assert.equal(item.result?.success, true);
  assert.equal(s.running, false);
});

test('pending approval is set, then cleared once execution arrives', () => {
  let s = apply([
    { type: 'proposal', conversationId: CID, proposal },
    {
      type: 'decision',
      conversationId: CID,
      proposalId: 'p1',
      decision: { status: 'PENDING_APPROVAL', reason: 'needs human', requiresApprovalId: 'a1' },
    },
    { type: 'approval:required', conversationId: CID, approvalId: 'a1', proposal },
  ]);
  assert.equal(proposalItem(s).approvalId, 'a1');

  s = guardrailReducer(s, {
    t: 'event',
    e: { type: 'execution', conversationId: CID, proposalId: 'p1', result: { proposalId: 'p1', success: true } },
  });
  assert.equal(proposalItem(s).approvalId, undefined);
  assert.equal(proposalItem(s).result?.success, true);
});

test('duplicate proposal events are ignored', () => {
  const s = apply([
    { type: 'proposal', conversationId: CID, proposal },
    { type: 'proposal', conversationId: CID, proposal },
  ]);
  assert.equal(s.items.filter((i) => i.kind === 'proposal').length, 1);
});

test('user + assistant messages append in order', () => {
  let s = guardrailReducer(initialStreamState, { t: 'user', text: 'scan logs' });
  s = guardrailReducer(s, { t: 'event', e: { type: 'assistant:text', conversationId: CID, content: 'done' } });
  assert.deepEqual(
    s.items.map((i) => i.kind),
    ['user', 'assistant'],
  );
});
