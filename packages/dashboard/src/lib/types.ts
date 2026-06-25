// UI-facing types. These mirror the Zod schemas in @armoriq/shared
// (packages/shared/src/types/*). Kept as plain interfaces here so the dashboard
// doesn't have to transpile the shared package or bundle zod into the client.
// If the backend contract changes, update these to match.

export type RuleType = 'BLOCK_TOOL' | 'REQUIRE_APPROVAL' | 'INPUT_VALIDATION' | 'BUDGET_LIMIT';

export type BlockToolConfig = Record<string, never>;
export interface RequireApprovalConfig {
  approverFallback: 'AUTO_DENY' | 'AUTO_ALLOW';
  timeoutSeconds: number;
}
export interface InputValidationConfig {
  field: string;
  pattern?: string;
  allowedPrefix?: string;
  maxLength?: number;
}
export interface BudgetLimitConfig {
  maxTokens?: number;
  maxToolCalls?: number;
  scope: 'CONVERSATION' | 'GLOBAL';
}

interface RuleBase {
  id: string;
  toolName: string; // a specific tool name or '*'
  enabled: boolean;
  createdAt: string; // ISO 8601
}

export type Rule =
  | (RuleBase & { type: 'BLOCK_TOOL'; config: BlockToolConfig })
  | (RuleBase & { type: 'REQUIRE_APPROVAL'; config: RequireApprovalConfig })
  | (RuleBase & { type: 'INPUT_VALIDATION'; config: InputValidationConfig })
  | (RuleBase & { type: 'BUDGET_LIMIT'; config: BudgetLimitConfig });

export type DecisionStatus = 'ALLOW' | 'DENY' | 'PENDING_APPROVAL';
export interface Decision {
  status: DecisionStatus;
  reason: string;
  matchedRuleId?: string;
  requiresApprovalId?: string;
}

// Ed25519 attestation the policy engine attaches to a decision (mirrors server/attestation.ts).
export interface Attestation {
  alg: 'ed25519';
  keyId: string;
  signature: string;
  signedAt: string;
  signed: {
    proposalId: string;
    conversationId: string;
    toolName: string;
    argsHash: string;
    status: DecisionStatus;
    reason: string;
    matchedRuleId?: string;
  };
}

export interface ToolCallProposal {
  id: string;
  conversationId: string;
  toolName: string;
  serverId: string;
  args: Record<string, unknown>;
  reasoning: string;
  timestamp: string;
}

export interface ToolResult {
  proposalId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export type AuditEventType = 'PROPOSAL' | 'DECISION' | 'EXECUTION' | 'APPROVAL';
export interface AuditEntry {
  id: string;
  sequence: number;
  timestamp: string;
  eventType: AuditEventType;
  payload: unknown;
  prevHash: string;
  hash: string;
  conversationId?: string;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  serverId?: string;
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

export interface VerifyResult {
  valid: boolean;
  brokenAtSequence?: number;
}

// Socket.IO events the server emits to a conversation room (see packages/server/src/orchestrator.ts).
export type ServerEvent =
  | { type: 'turn:start'; conversationId: string }
  | { type: 'proposal'; conversationId: string; proposal: ToolCallProposal }
  | { type: 'decision'; conversationId: string; proposalId: string; decision: Decision; attestation?: Attestation }
  | { type: 'approval:required'; conversationId: string; approvalId: string; proposal: ToolCallProposal }
  | { type: 'execution'; conversationId: string; proposalId: string; result: ToolResult }
  | { type: 'assistant:text'; conversationId: string; content: string }
  | { type: 'turn:end'; conversationId: string }
  | { type: 'error'; conversationId: string; message: string };

export const SERVER_EVENT_NAMES = [
  'turn:start',
  'proposal',
  'decision',
  'approval:required',
  'execution',
  'assistant:text',
  'turn:end',
  'error',
] as const;
