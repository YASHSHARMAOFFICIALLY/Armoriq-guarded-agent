import { randomUUID } from 'node:crypto';
import type { McpToolSchema, ToolCallProposal, ToolResult } from '@armoriq/shared';
import { callModel, toOpenAiTools } from './llmClient.js';
import type { ChatMessage } from './llmClient.js';
import { ConversationStore } from './conversationStore.js';

// One store for the package. Exported so the server can read usage/history (e.g. for checkBudget).
export const conversationStore = new ConversationStore();

export type ProposeResult =
  | { type: 'TEXT'; content: string }
  | { type: 'TOOL_CALL'; proposal: ToolCallProposal };

// The entire exported decision surface. It PROPOSES a tool call or replies with text — it never
// executes anything. The server evaluates the proposal against policy and (if allowed) runs it.
export async function proposeNextStep(
  conversationId: string,
  userMessage: string | null,
  toolResultToFeedBack: ToolResult | null,
  availableTools: McpToolSchema[],
): Promise<ProposeResult> {
  if (userMessage !== null) {
    conversationStore.appendMessage(conversationId, { role: 'user', content: userMessage });
  }
  if (toolResultToFeedBack !== null) {
    conversationStore.appendMessage(conversationId, toolResultMessage(toolResultToFeedBack));
    // Count only calls that actually ran — denied/failed results don't burn the tool budget.
    if (toolResultToFeedBack.success) conversationStore.incrementToolCalls(conversationId);
  }

  const result = await callModel(conversationStore.getHistory(conversationId), toOpenAiTools(availableTools));
  conversationStore.addTokens(conversationId, result.tokensUsed);

  if (result.type === 'TEXT') {
    conversationStore.appendMessage(conversationId, { role: 'assistant', content: result.content });
    return { type: 'TEXT', content: result.content };
  }

  // TOOL_CALL. The fresh UUID doubles as the OpenAI tool_call id, so the fed-back ToolResult
  // (carrying proposalId) threads onto this exact call with no extra bookkeeping.
  const proposalId = randomUUID();
  const serverId = availableTools.find((t) => t.name === result.toolName)?.serverId;
  if (serverId === undefined) {
    throw new Error(`Model proposed unknown tool '${result.toolName}'`);
  }

  conversationStore.appendMessage(conversationId, {
    role: 'assistant',
    content: result.reasoning || null,
    tool_calls: [
      { id: proposalId, type: 'function', function: { name: result.toolName, arguments: JSON.stringify(result.args) } },
    ],
  });

  const proposal: ToolCallProposal = {
    id: proposalId,
    conversationId,
    toolName: result.toolName,
    serverId,
    args: result.args,
    reasoning: result.reasoning,
    timestamp: new Date().toISOString(),
  };
  return { type: 'TOOL_CALL', proposal };
}

// A fed-back ToolResult becomes the OpenAI 'tool' message, threaded to the assistant tool call
// by proposalId (which equals the tool_call id we set when proposing).
function toolResultMessage(result: ToolResult): ChatMessage {
  const content = result.success
    ? JSON.stringify(result.data ?? null)
    : `ERROR: ${result.error ?? 'tool call failed'}`;
  return { role: 'tool', tool_call_id: result.proposalId, content };
}
