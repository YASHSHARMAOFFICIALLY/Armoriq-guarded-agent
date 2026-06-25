import type { Decision, Rule, ToolCallProposal } from '@armoriq/shared';
import type { UsageSnapshot } from './types.js';
import { CircuitBreaker } from './circuitBreaker.js';
import { checkBlock } from './rules/blockRule.js';
import { checkInputValidation } from './rules/inputValidationRule.js';
import { checkBudget } from './rules/budgetRule.js';
import { checkApproval } from './rules/approvalRule.js';
import { checkInjectionHeuristic } from './injectionHeuristic.js';

export interface EvaluateContext {
  currentUsage: UsageSnapshot;
  circuitBreaker: CircuitBreaker;
}

/**
 * The single entry point of the policy engine.
 *
 * Given a proposed tool call and the active rule set, return a Decision. Pure except for
 * reading the in-memory circuit breaker — no I/O, and no awareness of LLMs, MCP, or HTTP.
 *
 * PRECEDENCE / CONFLICT RESOLUTION — the answer to "what wins when rules conflict":
 *
 *   1. Circuit breaker     — server unhealthy → DENY before any rule runs.
 *   2. BLOCK_TOOL          — hard deny.
 *   3. INPUT_VALIDATION    — deny on bad input.
 *   4. BUDGET_LIMIT        — deny when over budget.
 *   5. Injection heuristic — deny on likely prompt/command injection.
 *   6. REQUIRE_APPROVAL    — escalate to a human.
 *   7. (nothing matched)   — default ALLOW.
 *
 * The ordering encodes one principle: DENY-type outcomes ALWAYS beat the APPROVAL outcome.
 * If a tool is both blocked and merely requires approval, we DENY — we never pop an approval
 * prompt for something a hard rule already forbids. The injection heuristic sits in the deny
 * tier (above approval) on purpose: a likely-malicious call should be stopped outright, not
 * handed to a human who might rubber-stamp it. First match wins within this fixed order.
 */
export function evaluate(
  proposal: ToolCallProposal,
  rules: Rule[],
  context: EvaluateContext,
): Decision {
  // 1. Circuit breaker first — an unhealthy server is denied before any rule logic.
  if (context.circuitBreaker.isOpen(proposal.serverId)) {
    return {
      status: 'DENY',
      reason: `Circuit breaker is open for server '${proposal.serverId}'`,
    };
  }

  // Disabled rules never participate.
  const activeRules = rules.filter((rule) => rule.enabled);

  // 2–4. Deny tier — first match short-circuits.
  for (const rule of activeRules) {
    const decision = checkBlock(proposal, rule);
    if (decision) return decision;
  }
  for (const rule of activeRules) {
    const decision = checkInputValidation(proposal, rule);
    if (decision) return decision;
  }
  for (const rule of activeRules) {
    const decision = checkBudget(proposal, rule, context.currentUsage);
    if (decision) return decision;
  }

  // 5. Injection heuristic — still deny tier, above approval.
  const injection = checkInjectionHeuristic(proposal);
  if (injection) return injection;

  // 6. Approval tier — lowest-precedence positive match.
  for (const rule of activeRules) {
    const decision = checkApproval(proposal, rule);
    if (decision) return decision;
  }

  // 7. Nothing matched → default allow.
  return { status: 'ALLOW', reason: 'No matching policy rule; default allow' };
}
