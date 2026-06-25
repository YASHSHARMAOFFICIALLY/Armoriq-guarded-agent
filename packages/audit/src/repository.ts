import type { AuditEntry } from '@armoriq/shared';

// The port the rest of the system codes against. No DB type ever leaks through it.
export interface AuditRepository {
  append(entry: AuditEntry): Promise<AuditEntry>;
  getAll(conversationId?: string): Promise<AuditEntry[]>;
  getLatest(): Promise<AuditEntry | null>;
}

// A persisted row is an AuditEntry plus the conversationId we denormalize for querying
// (AuditEntry itself has no conversationId — it lives on the event payload).
export type AuditEntryRow = AuditEntry & { conversationId: string | null };

// The minimal slice of a Prisma model delegate this repo needs. The server passes its real
// `prisma.auditEntry` in here — so we get a Prisma-backed repo WITHOUT importing
// @prisma/client, keeping this package DB-agnostic and unit-testable with a fake store.
export interface AuditEntryStore {
  create(args: { data: AuditEntryRow }): Promise<AuditEntryRow>;
  findMany(args: {
    where?: { conversationId?: string };
    orderBy: { sequence: 'asc' };
  }): Promise<AuditEntryRow[]>;
  findFirst(args: { orderBy: { sequence: 'desc' } }): Promise<AuditEntryRow | null>;
}

// Prisma-backed AuditRepository. "Backed" via dependency injection: the Prisma delegate is
// passed in as an AuditEntryStore, so this file has zero Prisma import.
export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly store: AuditEntryStore) {}

  async append(entry: AuditEntry): Promise<AuditEntry> {
    const row = await this.store.create({
      data: { ...entry, conversationId: extractConversationId(entry.payload) },
    });
    return toEntry(row);
  }

  async getAll(conversationId?: string): Promise<AuditEntry[]> {
    const rows = await this.store.findMany({
      where: conversationId ? { conversationId } : undefined,
      orderBy: { sequence: 'asc' },
    });
    return rows.map(toEntry);
  }

  async getLatest(): Promise<AuditEntry | null> {
    const row = await this.store.findFirst({ orderBy: { sequence: 'desc' } });
    return row ? toEntry(row) : null;
  }
}

function toEntry(row: AuditEntryRow): AuditEntry {
  const { conversationId: _conversationId, ...entry } = row;
  return entry;
}

// Best-effort extraction so getAll() can filter by conversation. The proposal/decision
// payloads carry conversationId; if a payload doesn't, the column is null and the entry is
// simply excluded from conversation-scoped queries (still returned by getAll() with no arg).
function extractConversationId(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'conversationId' in payload) {
    const value = (payload as { conversationId: unknown }).conversationId;
    return typeof value === 'string' ? value : null;
  }
  return null;
}
