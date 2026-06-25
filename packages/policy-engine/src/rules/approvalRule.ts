import { randomUUID } from 'node:crypto';
import type { Decision, Rule, ToolCallProposal } from '@armoriq/shared';
import { toolMatches } from '../match.js';

// Returns PENDING_APPROVAL with a fresh approval id the caller (server) uses to track and
// later resolve the pending request. Generating an id is the only nondeterminism here.
export function checkApproval(proposal: ToolCallProposal, rule: Rule): Decision | null {
  if (rule.type !== 'REQUIRE_APPROVAL') return null;
  if (!toolMatches(rule.toolName, proposal.toolName)) return null;
  return {
    status: 'PENDING_APPROVAL',
    reason: `Tool '${proposal.toolName}' requires manual approval (rule ${rule.id})`,
    matchedRuleId: rule.id,
    requiresApprovalId: randomUUID(),
  };
}
