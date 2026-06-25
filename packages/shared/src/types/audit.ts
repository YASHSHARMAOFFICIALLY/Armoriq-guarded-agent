import { z } from 'zod';

// One entry in the hash-chained audit log. prevHash/hash link entries tamper-evidently.
export const AuditEntrySchema = z.object({
  id: z.string(),
  sequence: z.number(),
  timestamp: z.string(),
  eventType: z.enum(['PROPOSAL', 'DECISION', 'EXECUTION', 'APPROVAL']),
  payload: z.unknown(),
  prevHash: z.string(),
  hash: z.string(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
