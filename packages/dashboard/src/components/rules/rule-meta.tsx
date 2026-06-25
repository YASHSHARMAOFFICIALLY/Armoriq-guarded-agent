import { Ban, Gauge, ScanSearch, UserCheck, type LucideIcon } from 'lucide-react';
import type { Rule, RuleType } from '@/lib/types';

export const RULE_META: Record<RuleType, { label: string; icon: LucideIcon; blurb: string }> = {
  BLOCK_TOOL: { label: 'Block tool', icon: Ban, blurb: 'Hard-deny every call to a tool.' },
  REQUIRE_APPROVAL: { label: 'Require approval', icon: UserCheck, blurb: 'Hold the call for a human decision.' },
  INPUT_VALIDATION: { label: 'Validate input', icon: ScanSearch, blurb: 'Reject calls whose arguments fail a check.' },
  BUDGET_LIMIT: { label: 'Budget limit', icon: Gauge, blurb: 'Cap tokens or tool-calls per scope.' },
};

export const RULE_TYPE_ORDER: RuleType[] = ['BLOCK_TOOL', 'REQUIRE_APPROVAL', 'INPUT_VALIDATION', 'BUDGET_LIMIT'];

// One-line, human summary of a rule's typed config.
export function configSummary(rule: Rule): string {
  switch (rule.type) {
    case 'BLOCK_TOOL':
      return 'Blocks all calls.';
    case 'REQUIRE_APPROVAL':
      return `Fallback ${rule.config.approverFallback === 'AUTO_ALLOW' ? 'auto-allow' : 'auto-deny'} after ${rule.config.timeoutSeconds}s.`;
    case 'INPUT_VALIDATION': {
      const c = rule.config;
      const parts = [`field “${c.field}”`];
      if (c.pattern) parts.push(`pattern /${c.pattern}/`);
      if (c.allowedPrefix) parts.push(`prefix “${c.allowedPrefix}”`);
      if (c.maxLength != null) parts.push(`max ${c.maxLength} chars`);
      return parts.join(' · ');
    }
    case 'BUDGET_LIMIT': {
      const c = rule.config;
      const parts = [c.scope === 'GLOBAL' ? 'global' : 'per conversation'];
      if (c.maxTokens != null) parts.push(`${c.maxTokens} tokens`);
      if (c.maxToolCalls != null) parts.push(`${c.maxToolCalls} tool calls`);
      return parts.join(' · ');
    }
  }
}
