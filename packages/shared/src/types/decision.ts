import { z } from 'zod';

export const DecisionStatusSchema = z.enum(['ALLOW', 'DENY', 'PENDING_APPROVAL']);
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;

export const DecisionSchema = z.object({
  status: DecisionStatusSchema,
  reason: z.string(),
  matchedRuleId: z.string().optional(),
  requiresApprovalId: z.string().optional(),
});
export type Decision = z.infer<typeof DecisionSchema>;
