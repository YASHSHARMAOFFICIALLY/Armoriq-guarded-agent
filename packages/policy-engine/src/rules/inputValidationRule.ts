import type { Decision, Rule, ToolCallProposal } from '@armoriq/shared';
import { toolMatches } from '../match.js';

// Validates one arg field against pattern / allowedPrefix / maxLength. DENY on violation.
//   - pattern:       allow-list regex — the value MUST match it.
//   - allowedPrefix: the value MUST start with this (e.g. '/sandbox/' to jail file paths).
//   - maxLength:     the value MUST be no longer than this.
// A missing field is "no opinion" (null) — there is no value to validate.
export function checkInputValidation(proposal: ToolCallProposal, rule: Rule): Decision | null {
  if (rule.type !== 'INPUT_VALIDATION') return null;
  if (!toolMatches(rule.toolName, proposal.toolName)) return null;

  const { field, pattern, allowedPrefix, maxLength } = rule.config;
  const raw = proposal.args[field];
  if (raw === undefined || raw === null) return null;

  const value = typeof raw === 'string' ? raw : String(raw);

  const deny = (why: string): Decision => ({
    status: 'DENY',
    reason: `Input validation failed for '${field}': ${why} (rule ${rule.id})`,
    matchedRuleId: rule.id,
  });

  if (pattern !== undefined) {
    let matches: boolean;
    try {
      matches = new RegExp(pattern).test(value);
    } catch {
      // A misconfigured pattern must fail closed (DENY), never throw and crash the engine.
      return deny(`rule has an invalid pattern /${pattern}/`);
    }
    if (!matches) return deny(`value does not match required pattern /${pattern}/`);
  }
  if (allowedPrefix !== undefined && !value.startsWith(allowedPrefix)) {
    return deny(`value must start with '${allowedPrefix}'`);
  }
  if (maxLength !== undefined && value.length > maxLength) {
    return deny(`value length ${value.length} exceeds maxLength ${maxLength}`);
  }
  return null;
}
