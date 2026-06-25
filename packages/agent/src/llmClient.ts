import OpenAI from 'openai';
import type { McpToolSchema } from '@armoriq/shared';

export type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool;
type ChatFunctionTool = OpenAI.Chat.Completions.ChatCompletionFunctionTool;

// Local result type. serverId is intentionally absent — the converted tool schema doesn't carry
// it, so the model can't know it; the orchestrator resolves it from the McpToolSchema list.
export type LlmTurnResult =
  | { type: 'TEXT'; content: string; tokensUsed: number }
  | { type: 'TOOL_CALL'; toolName: string; args: Record<string, unknown>; reasoning: string; tokensUsed: number };

// Synthetic, required parameter injected into every tool schema. OpenAI function-calling doesn't
// reliably emit free text alongside a tool call (Claude does), so we force the reason into the
// call itself, then strip it back out before building the proposal.
export const REASONING_FIELD = '__reasoning__';

const SYSTEM_PROMPT =
  'You are a security-operations assistant. Use the provided tools to investigate and respond to ' +
  `incidents. Before every tool call, set the "${REASONING_FIELD}" field to a brief, honest ` +
  'justification for the call. Never invent tools or arguments.';

// Converts MCP tool schemas (from @armoriq/shared) into OpenAI function tools, injecting the
// reasoning field. Drops serverId — the LLM only ever sees tool names.
export function toOpenAiTools(mcpTools: McpToolSchema[]): ChatFunctionTool[] {
  return mcpTools.map((tool) => {
    const schema = (tool.inputSchema ?? {}) as { properties?: Record<string, unknown>; required?: string[] };
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: {
            ...(schema.properties ?? {}),
            [REASONING_FIELD]: { type: 'string', description: 'One sentence: why you are calling this tool.' },
          },
          required: [...(schema.required ?? []), REASONING_FIELD],
        },
      },
    };
  });
}

// Lazy so importing this module (e.g. for toOpenAiTools) never requires an API key — only an
// actual callModel() does.
let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI();
  return client;
}

export async function callModel(messages: ChatMessage[], tools: ChatTool[]): Promise<LlmTurnResult> {
  const response = await getClient().chat.completions.create({
    model: process.env.OPENAI_MODEL ?? 'gpt-4o',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    tools: tools.length > 0 ? tools : undefined,
    parallel_tool_calls: tools.length > 0 ? false : undefined, // one proposal per turn
  });

  const tokensUsed = response.usage?.total_tokens ?? 0;
  const message = response.choices[0]?.message;
  const toolCall = message?.tool_calls?.find((tc) => tc.type === 'function');

  if (toolCall && toolCall.type === 'function') {
    const raw = parseArgs(toolCall.function.arguments);
    const { [REASONING_FIELD]: reasoningRaw, ...args } = raw;
    const reasoning = typeof reasoningRaw === 'string' ? reasoningRaw : message?.content ?? '';
    return { type: 'TOOL_CALL', toolName: toolCall.function.name, args, reasoning, tokensUsed };
  }

  return { type: 'TEXT', content: message?.content ?? '', tokensUsed };
}

// A cheap, separate completion used by the policy layer's semantic firewall (a different model and
// no tools). Returns the raw model text; the caller parses it. Kept here so the OpenAI client and
// key handling live in one place.
export async function judge(prompt: string): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: process.env.SEMANTIC_GUARD_MODEL ?? 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    response_format: { type: 'json_object' },
  });
  return response.choices[0]?.message?.content ?? '';
}

function parseArgs(json: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
