import { createHash, randomUUID } from 'node:crypto';
import type { AuditEntry } from '@armoriq/shared';

// Sentinel prevHash for the first entry in a chain.
export const GENESIS_HASH = 'GENESIS';

/**
 * Deterministic JSON: recursively sorts object keys so serialization is invariant to key order.
 * REQUIRED here because the audit payload is persisted as Postgres `jsonb`, which does not
 * preserve key order on read — with a plain JSON.stringify the recomputed hash would never match
 * the stored one and every chain would "fail" verification.
 */
export function canonicalStringify(value: unknown): string {
  // `?? 'null'` only matters for undefined array elements, matching JSON.stringify([undefined]) → [null].
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const body = Object.keys(obj)
    .sort()
    // Drop undefined-valued keys, exactly as JSON.stringify (and therefore jsonb persistence)
    // does — otherwise an in-memory `{error: undefined}` hashes differently from the stored row.
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`)
    .join(',');
  return `{${body}}`;
}

/**
 * SHA-256 over the chain-linked fields, serialized canonically (key-order-independent). Because
 * `prevHash` is part of the material, every hash transitively commits to the entire history
 * before it — editing any past entry invalidates every hash after it.
 *
 * `id` is intentionally excluded (it's a random surrogate key, not integrity material).
 */
export function computeHash(entry: Omit<AuditEntry, 'hash'>): string {
  const material = canonicalStringify({
    prevHash: entry.prevHash,
    sequence: entry.sequence,
    timestamp: entry.timestamp,
    eventType: entry.eventType,
    payload: entry.payload,
  });
  return createHash('sha256').update(material).digest('hex');
}

/** Builds the next entry in the chain, linking it to `prevEntry` (or GENESIS if none). */
export function createEntry(
  prevEntry: AuditEntry | null,
  eventType: AuditEntry['eventType'],
  payload: unknown,
): AuditEntry {
  const base: Omit<AuditEntry, 'hash'> = {
    id: randomUUID(),
    sequence: prevEntry ? prevEntry.sequence + 1 : 0,
    timestamp: new Date().toISOString(),
    eventType,
    payload,
    prevHash: prevEntry?.hash ?? GENESIS_HASH,
  };
  return { ...base, hash: computeHash(base) };
}

/**
 * Walks the chain in order and returns the first place it breaks. Expects the COMPLETE, ordered
 * chain (as returned by an unfiltered audit read) — not a per-conversation subset. Three
 * independent checks per entry:
 *   1. Contiguity — sequences must run 0,1,2,… with no gaps or reordering.
 *   2. Linkage    — this entry's `prevHash` equals the prior entry's stored hash (GENESIS for #0).
 *   3. Content    — recomputing the hash from the entry's own fields matches its stored hash.
 *
 * A tampered-but-not-rehashed entry fails check 3 at its own sequence. A tampered-and-rehashed
 * entry passes check 3 but breaks check 2 on the *following* entry. A deleted/inserted/reordered
 * entry breaks check 1 (and usually 2). The one thing no in-band check can catch is an attacker
 * who renumbers AND re-hashes the entire tail after the edit — defeating that requires external
 * anchoring (e.g. periodically notarizing the tip hash somewhere append-only).
 */
export function verifyChain(
  entries: AuditEntry[],
): { valid: boolean; brokenAtSequence?: number } {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // 1. Contiguity: the full chain is 0-indexed and gap-free.
    if (entry.sequence !== i) {
      return { valid: false, brokenAtSequence: entry.sequence };
    }

    // 2. Linkage.
    const expectedPrevHash = i === 0 ? GENESIS_HASH : entries[i - 1].hash;
    if (entry.prevHash !== expectedPrevHash) {
      return { valid: false, brokenAtSequence: entry.sequence };
    }

    // 3. Content.
    const { hash, ...rest } = entry;
    if (computeHash(rest) !== hash) {
      return { valid: false, brokenAtSequence: entry.sequence };
    }
  }
  return { valid: true };
}
