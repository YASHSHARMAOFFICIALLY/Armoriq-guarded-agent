import { z } from 'zod';

export const RuleTypeSchema = z.enum([
  'BLOCK_TOOL',
  'REQUIRE_APPROVAL',
  'INPUT_VALIDATION',
  'BUDGET_LIMIT',
]);
export type RuleType = z.infer<typeof RuleTypeSchema>;

// Per-type config objects.

// BLOCK_TOOL needs only the tool name, which already lives on the base Rule.
export const BlockToolConfigSchema = z.object({});
export type BlockToolConfig = z.infer<typeof BlockToolConfigSchema>;

export const RequireApprovalConfigSchema = z.object({
  approverFallback: z.enum(['AUTO_DENY', 'AUTO_ALLOW']),
  timeoutSeconds: z.number(),
});
export type RequireApprovalConfig = z.infer<typeof RequireApprovalConfigSchema>;

export const InputValidationConfigSchema = z.object({
  field: z.string(),
  pattern: z.string().optional(),
  allowedPrefix: z.string().optional(),
  maxLength: z.number().optional(),
});
export type InputValidationConfig = z.infer<typeof InputValidationConfigSchema>;

export const BudgetLimitConfigSchema = z.object({
  maxTokens: z.number().optional(),
  maxToolCalls: z.number().optional(),
  scope: z.enum(['CONVERSATION', 'GLOBAL']),
});
export type BudgetLimitConfig = z.infer<typeof BudgetLimitConfigSchema>;

// Base shape shared by every rule. toolName is a specific tool or '*' for all tools.
const ruleBase = {
  id: z.string(),
  toolName: z.union([z.string(), z.literal('*')]),
  enabled: z.boolean(),
  createdAt: z.string(),
};

// A Rule is a discriminated union on `type`: each variant carries its own typed `config`.
// Consumers narrow `rule.config` by checking `rule.type` (exhaustive switch with no casts).
export const BlockToolRuleSchema = z.object({
  ...ruleBase,
  type: z.literal('BLOCK_TOOL'),
  config: BlockToolConfigSchema,
});
export const RequireApprovalRuleSchema = z.object({
  ...ruleBase,
  type: z.literal('REQUIRE_APPROVAL'),
  config: RequireApprovalConfigSchema,
});
export const InputValidationRuleSchema = z.object({
  ...ruleBase,
  type: z.literal('INPUT_VALIDATION'),
  config: InputValidationConfigSchema,
});
export const BudgetLimitRuleSchema = z.object({
  ...ruleBase,
  type: z.literal('BUDGET_LIMIT'),
  config: BudgetLimitConfigSchema,
});

export const RuleSchema = z.discriminatedUnion('type', [
  BlockToolRuleSchema,
  RequireApprovalRuleSchema,
  InputValidationRuleSchema,
  BudgetLimitRuleSchema,
]);
export type Rule = z.infer<typeof RuleSchema>;
