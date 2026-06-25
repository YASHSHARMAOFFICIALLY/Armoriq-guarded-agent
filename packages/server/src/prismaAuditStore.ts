import type { AuditEntryStore, AuditEntryRow } from '@armoriq/audit';
import { prisma } from './db.js';

// Adapts Prisma's `auditEntry` delegate to the audit package's AuditEntryStore port. The casts are
// the one place Prisma's Json types meet AuditEntry.payload (unknown) — Prisma validates the JSON
// at runtime; our payloads are always plain objects.
export const prismaAuditStore: AuditEntryStore = {
  async create({ data }) {
    const row = await prisma.auditEntry.create({ data: data as never });
    return row as unknown as AuditEntryRow;
  },
  async findMany({ where, orderBy }) {
    const rows = await prisma.auditEntry.findMany({ where, orderBy });
    return rows as unknown as AuditEntryRow[];
  },
  async findFirst({ orderBy }) {
    const row = await prisma.auditEntry.findFirst({ orderBy });
    return (row as unknown as AuditEntryRow) ?? null;
  },
};
