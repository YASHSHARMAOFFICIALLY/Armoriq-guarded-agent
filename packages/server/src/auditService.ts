import { createEntry, verifyChain, PrismaAuditRepository } from '@armoriq/audit';
import type { AuditEntry } from '@armoriq/shared';
import { prismaAuditStore } from './prismaAuditStore.js';

type AuditEventType = AuditEntry['eventType'];

const repo = new PrismaAuditRepository(prismaAuditStore);

// Serialize appends: each record() waits for the previous to finish before reading getLatest, so two
// concurrent turns can't both read the same tip and fork the hash chain.
// ponytail: single-process promise lock — move to a DB advisory lock if the server is ever scaled out.
let chain: Promise<unknown> = Promise.resolve();

async function recordAudit(eventType: AuditEventType, payload: unknown): Promise<AuditEntry> {
  const next = chain.then(async () => {
    const prev = await repo.getLatest();
    return repo.append(createEntry(prev, eventType, payload));
  });
  chain = next.catch(() => undefined); // keep the lock intact even if one append fails
  return next;
}

// Matches the orchestrator's AuditRecorder interface.
export const auditRecorder = { record: recordAudit };

export async function getAudit(conversationId?: string): Promise<AuditEntry[]> {
  return repo.getAll(conversationId);
}

export async function verifyAudit(): Promise<{ valid: boolean; brokenAtSequence?: number }> {
  return verifyChain(await repo.getAll());
}
