import type { Decision, Rule, ToolCallProposal } from '@armoriq/shared';
import { toolMatches } from '../match.js';

// Returns a DENY when a BLOCK_TOOL rule covers this tool, otherwise null ("no opinion").
export function checkBlock(proposal: ToolCallProposal, rule: Rule): Decision | null {
  if (rule.type !== 'BLOCK_TOOL') return null;
  if (!toolMatches(rule.toolName, proposal.toolName)) return null;
  return {
    status: 'DENY',
    reason: `Tool '${proposal.toolName}' is blocked by rule ${rule.id}`,
    matchedRuleId: rule.id,
  };
}
