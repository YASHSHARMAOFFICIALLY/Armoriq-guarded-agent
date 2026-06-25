import { describe, it, expect } from 'vitest';
import type { AuditEntry } from '@armoriq/shared';
import { computeHash, createEntry, verifyChain } from '../src/hashChain.js';

// Build a small, valid chain: PROPOSAL -> DECISION -> EXECUTION.
function buildChain(): AuditEntry[] {
  const e0 = createEntry(null, 'PROPOSAL', { conversationId: 'c1', toolName: 'fs.read' });
  const e1 = createEntry(e0, 'DECISION', { conversationId: 'c1', status: 'ALLOW' });
  const e2 = createEntry(e1, 'EXECUTION', { conversationId: 'c1', success: true });
  return [e0, e1, e2];
}

// Recompute an entry's own hash so it is internally consistent — simulates a forger who
// rewrites a single entry but can't reach the later entries that point at its old hash.
function rehash(entry: AuditEntry): AuditEntry {
  const { hash: _oldHash, ...rest } = entry;
  return { ...rest, hash: computeHash(rest) };
}

describe('verifyChain', () => {
  it('accepts an untampered chain', () => {
    expect(verifyChain(buildChain())).toEqual({ valid: true });
  });

  it('detects a tampered payload at the exact sequence (hash not updated)', () => {
    const chain = buildChain();
    // Attacker edits the decision payload but does not recompute the hash.
    chain[1] = { ...chain[1], payload: { conversationId: 'c1', status: 'DENY' } };

    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAtSequence).toBe(chain[1].sequence); // sequence 1
  });

  it('detects a tampered+rehashed entry at the FOLLOWING sequence (broken linkage)', () => {
    const chain = buildChain();
    // Sophisticated attacker rewrites e1 AND rehashes it so e1 is self-consistent...
    chain[1] = rehash({ ...chain[1], payload: { conversationId: 'c1', status: 'DENY' } });

    // ...but e2.prevHash still points at the ORIGINAL hash of e1, so the break surfaces at e2.
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAtSequence).toBe(chain[2].sequence); // sequence 2
  });

  it('detects a deleted entry even when its neighbour is re-linked and re-hashed', () => {
    const chain = buildChain(); // sequences 0,1,2
    // Attacker deletes e1, re-links e2 to e0, and rehashes e2 so linkage + content both pass —
    // but e2 still carries sequence 2, leaving a gap at index 1.
    const relinked = rehash({ ...chain[2], prevHash: chain[0].hash });
    const result = verifyChain([chain[0], relinked]);
    expect(result.valid).toBe(false);
    expect(result.brokenAtSequence).toBe(2); // contiguity catches the gap
  });

  it('stays valid when payload keys come back reordered (jsonb round-trip)', () => {
    const chain = buildChain();
    // Postgres jsonb does not preserve key order — simulate by reversing each payload's keys.
    const reordered = chain.map((e) =>
      e.payload && typeof e.payload === 'object'
        ? { ...e, payload: Object.fromEntries(Object.entries(e.payload as Record<string, unknown>).reverse()) }
        : e,
    );
    expect(verifyChain(reordered)).toEqual({ valid: true });
  });

  it('stays valid when an undefined-valued key is dropped on persistence (e.g. result.error)', () => {
    // A successful tool result carries `error: undefined`; JSON/jsonb persistence drops it.
    const e0 = createEntry(null, 'EXECUTION', { proposalId: 'p', success: true, data: 'x', error: undefined });
    const persisted = { ...e0, payload: JSON.parse(JSON.stringify(e0.payload)) }; // simulates the round-trip
    expect(verifyChain([persisted])).toEqual({ valid: true });
  });

  it('flags a corrupted genesis prevHash', () => {
    const chain = buildChain();
    chain[0] = { ...chain[0], prevHash: 'NOT_GENESIS' };
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAtSequence).toBe(chain[0].sequence); // sequence 0
  });
});
