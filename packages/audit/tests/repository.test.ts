import { describe, it, expect } from 'vitest';
import { createEntry } from '../src/hashChain.js';
import { PrismaAuditRepository } from '../src/repository.js';
import type { AuditEntryRow, AuditEntryStore } from '../src/repository.js';

// In-memory stand-in for `prisma.auditEntry` — this is the whole point of the port: the
// repository is exercised end-to-end with zero database.
class FakeStore implements AuditEntryStore {
  rows: AuditEntryRow[] = [];

  async create({ data }: { data: AuditEntryRow }): Promise<AuditEntryRow> {
    this.rows.push(data);
    return data;
  }

  async findMany({
    where,
  }: {
    where?: { conversationId?: string };
    orderBy: { sequence: 'asc' };
  }): Promise<AuditEntryRow[]> {
    const rows = where?.conversationId
      ? this.rows.filter((r) => r.conversationId === where.conversationId)
      : [...this.rows];
    return rows.sort((a, b) => a.sequence - b.sequence);
  }

  async findFirst(): Promise<AuditEntryRow | null> {
    if (this.rows.length === 0) return null;
    return [...this.rows].sort((a, b) => b.sequence - a.sequence)[0];
  }
}

describe('PrismaAuditRepository (DB-less via injected store)', () => {
  it('appends, denormalizes conversationId, and queries by conversation', async () => {
    const repo = new PrismaAuditRepository(new FakeStore());

    const e0 = createEntry(null, 'PROPOSAL', { conversationId: 'c1', toolName: 'fs.read' });
    const e1 = createEntry(e0, 'DECISION', { conversationId: 'c2', status: 'ALLOW' });
    await repo.append(e0);
    await repo.append(e1);

    const all = await repo.getAll();
    expect(all).toHaveLength(2);
    // append() returns a clean AuditEntry — the denormalized column must not leak out.
    expect('conversationId' in all[0]).toBe(false);

    const onlyC1 = await repo.getAll('c1');
    expect(onlyC1.map((e) => e.id)).toEqual([e0.id]);

    const latest = await repo.getLatest();
    expect(latest?.id).toBe(e1.id);
  });
});
