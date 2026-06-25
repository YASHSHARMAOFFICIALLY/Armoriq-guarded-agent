import { evaluate, judgeIntent, CircuitBreaker } from '@armoriq/policy-engine';
import type { Rule, ToolCallProposal, ToolResult, McpToolSchema, Decision, AuditEntry } from '@armoriq/shared';
import { proposeNextStep, conversationStore, judge } from '@armoriq/agent';
import { attestDecision, type Attestation } from './attestation.js';

export type AuditEventType = AuditEntry['eventType'];

// What mcp-client's executeTool returns (it doesn't know about proposalId — that's bridged here).
export interface ExecResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolRegistryLike {
  listAllTools(): McpToolSchema[];
  executeTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<ExecResult>;
}

export interface AuditRecorder {
  record(eventType: AuditEventType, payload: unknown): Promise<unknown>;
}

export interface ApprovalGate {
  // Resolves once a human responds or the per-rule timeout fallback fires.
  waitForApproval(proposal: ToolCallProposal, rule: Rule | undefined, approvalId: string): Promise<'ALLOW' | 'DENY'>;
}

export type ServerEvent =
  | { type: 'turn:start'; conversationId: string }
  | { type: 'proposal'; conversationId: string; proposal: ToolCallProposal }
  | { type: 'decision'; conversationId: string; proposalId: string; decision: Decision; attestation?: Attestation }
  | { type: 'approval:required'; conversationId: string; approvalId: string; proposal: ToolCallProposal }
  | { type: 'execution'; conversationId: string; proposalId: string; result: ToolResult }
  | { type: 'assistant:text'; conversationId: string; content: string }
  | { type: 'turn:end'; conversationId: string }
  | { type: 'error'; conversationId: string; message: string };

export type EmitFn = (event: ServerEvent) => void;

export interface RunTurnDeps {
  registry: ToolRegistryLike;
  rules: Rule[];
  circuitBreaker: CircuitBreaker;
  audit: AuditRecorder;
  approvals: ApprovalGate;
  emit: EmitFn;
  maxSteps?: number;
}

export interface TurnStep {
  proposal: ToolCallProposal;
  decision: Decision;
  result?: ToolResult;
}

export interface TurnResult {
  finalText: string;
  steps: TurnStep[];
  stoppedReason: 'TEXT' | 'MAX_STEPS';
}

const DEFAULT_MAX_STEPS = 8;

/**
 * The single execution chokepoint. Drives one user turn through the guardrail loop:
 * propose → evaluate → (approve) → execute-or-deny → audit → feed the result back, until the agent
 * replies with text or the step cap is hit. This is the ONLY place a tool is actually executed.
 */
export async function runTurn(
  conversationId: string,
  userMessage: string,
  deps: RunTurnDeps,
): Promise<TurnResult> {
  const { registry, rules, circuitBreaker, audit, approvals, emit } = deps;
  const maxSteps = deps.maxSteps ?? DEFAULT_MAX_STEPS;
  const steps: TurnStep[] = [];

  emit({ type: 'turn:start', conversationId });
  let step = await proposeNextStep(conversationId, userMessage, null, registry.listAllTools());

  for (let i = 0; i < maxSteps; i++) {
    if (step.type === 'TEXT') {
      emit({ type: 'assistant:text', conversationId, content: step.content });
      emit({ type: 'turn:end', conversationId });
      return { finalText: step.content, steps, stoppedReason: 'TEXT' };
    }

    const proposal = step.proposal;
    await audit.record('PROPOSAL', proposal);
    emit({ type: 'proposal', conversationId, proposal });

    // Real policy evaluation. currentUsage comes from the agent's per-conversation tallies; the
    // SAME circuit breaker instance is also fed by the registry's transport hooks.
    let decision = evaluate(proposal, rules, {
      currentUsage: conversationStore.getUsage(conversationId),
      circuitBreaker,
    });

    // Semantic firewall — second injection-defense layer over what the deterministic rules allowed.
    // Catches hijacks the regex heuristic can't (e.g. acting on instructions injected via tool output).
    if (decision.status === 'ALLOW' && process.env.SEMANTIC_GUARD !== 'off') {
      const verdict = await judgeIntent({ proposal, userIntent: userMessage }, judge);
      if (verdict.verdict === 'DENY') {
        decision = {
          status: 'DENY',
          reason: `Semantic firewall: ${verdict.reason}`,
          matchedRuleId: 'semantic-firewall',
        };
      }
    }

    // Cryptographically attest the verdict (Ed25519). The signature binds intent → verdict → signer.
    let attestation = attestDecision(proposal, decision);
    await audit.record('DECISION', { conversationId, proposalId: proposal.id, decision, attestation });
    emit({ type: 'decision', conversationId, proposalId: proposal.id, decision, attestation });

    if (decision.status === 'PENDING_APPROVAL') {
      const approvalId = decision.requiresApprovalId ?? proposal.id;
      const rule = rules.find((r) => r.id === decision.matchedRuleId);
      emit({ type: 'approval:required', conversationId, approvalId, proposal });
      const verdict = await approvals.waitForApproval(proposal, rule, approvalId);
      decision =
        verdict === 'ALLOW'
          ? { status: 'ALLOW', reason: `Approved (${approvalId})`, matchedRuleId: decision.matchedRuleId }
          : { status: 'DENY', reason: `Approval denied (${approvalId})`, matchedRuleId: decision.matchedRuleId };
      // Re-attest the resolved verdict so the final ALLOW/DENY is itself signed and on the chain.
      attestation = attestDecision(proposal, decision);
      await audit.record('APPROVAL', { conversationId, proposalId: proposal.id, approvalId, verdict, decision, attestation });
      emit({ type: 'decision', conversationId, proposalId: proposal.id, decision, attestation });
    }

    let result: ToolResult;
    if (decision.status === 'DENY') {
      // Fed back as a failed tool result so the model can explain/adapt — not a hard halt.
      result = { proposalId: proposal.id, success: false, error: decision.reason };
    } else {
      const exec = await registry.executeTool(proposal.serverId, proposal.toolName, proposal.args);
      result = {
        proposalId: proposal.id,
        success: exec.success,
        data: unwrapText(exec.data),
        error: exec.error,
      };
      await audit.record('EXECUTION', { conversationId, proposalId: proposal.id, result });
      emit({ type: 'execution', conversationId, proposalId: proposal.id, result });
    }

    steps.push({ proposal, decision, result });
    step = await proposeNextStep(conversationId, null, result, registry.listAllTools());
  }

  emit({ type: 'error', conversationId, message: `Max steps (${maxSteps}) reached without a final reply` });
  emit({ type: 'turn:end', conversationId });
  return { finalText: '', steps, stoppedReason: 'MAX_STEPS' };
}

// mcp-client returns the raw MCP content envelope ([{type:'text',text:'...'}]) as data. Pull the
// text out so the model gets clean content instead of the protocol wrapper.
function unwrapText(data: unknown): unknown {
  if (Array.isArray(data)) {
    const texts = data.filter(
      (c): c is { type: 'text'; text: string } =>
        !!c && typeof c === 'object' && (c as { type?: unknown }).type === 'text' && typeof (c as { text?: unknown }).text === 'string',
    );
    if (texts.length > 0) return texts.map((t) => t.text).join('\n');
  }
  return data;
}
