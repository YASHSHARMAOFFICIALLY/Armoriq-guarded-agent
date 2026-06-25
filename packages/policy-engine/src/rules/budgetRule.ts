import type { Decision, Rule, ToolCallProposal } from '@armoriq/shared';
import type { UsageSnapshot } from '../types.js';
import { toolMatches } from '../match.js';

// Denies when usage so far has reached a configured cap. State lives with the caller; this
// function is pure — it only compares the provided snapshot against the rule's limits.
// ponytail: ceiling is inclusive (usage >= limit denies). We don't know this call's token
// cost yet, so we gate on "already at the cap" rather than "would exceed". Switch to a
// projected-usage param if per-call cost estimation is ever needed.
export function checkBudget(
  proposal: ToolCallProposal,
  rule: Rule,
  usage: UsageSnapshot,
): Decision | null {
  if (rule.type !== 'BUDGET_LIMIT') return null;
  if (!toolMatches(rule.toolName, proposal.toolName)) return null;

  const { maxTokens, maxToolCalls } = rule.config;

  if (maxTokens !== undefined && usage.tokensUsed >= maxTokens) {
    return {
      status: 'DENY',
      reason: `Token budget exhausted: ${usage.tokensUsed}/${maxTokens} (rule ${rule.id})`,
      matchedRuleId: rule.id,
    };
  }
  if (maxToolCalls !== undefined && usage.toolCallsMade >= maxToolCalls) {
    return {
      status: 'DENY',
      reason: `Tool-call budget exhausted: ${usage.toolCallsMade}/${maxToolCalls} (rule ${rule.id})`,
      matchedRuleId: rule.id,
    };
  }
  return null;
}
