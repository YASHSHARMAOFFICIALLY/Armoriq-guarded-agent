import { z } from 'zod';

// A tool call the LLM agent wants to make, before the policy engine decides on it.
export const ToolCallProposalSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  toolName: z.string(),
  serverId: z.string(),
  args: z.record(z.string(), z.unknown()),
  // The LLM's stated justification for the call. Always captured — used later for injection detection.
  reasoning: z.string(),
  timestamp: z.string(),
});
export type ToolCallProposal = z.infer<typeof ToolCallProposalSchema>;

export const ToolResultSchema = z.object({
  proposalId: z.string(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});
export type ToolResult = z.infer<typeof ToolResultSchema>;
