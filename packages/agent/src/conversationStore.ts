import type { ChatMessage } from './llmClient.js';

// Mirrors the policy engine's UsageSnapshot shape WITHOUT importing it — this package must depend
// on neither the policy nor the transport package. Structural typing lets the server pass this
// straight into checkBudget.
export interface UsageSnapshot {
  tokensUsed: number;
  toolCallsMade: number;
}

interface ConversationRecord {
  messages: ChatMessage[];
  tokensUsed: number;
  toolCallsMade: number;
}

// Per-conversation message history + running usage totals. In-memory map; fine for now.
// ponytail: process-local Map — move to shared storage only if the agent is horizontally scaled.
export class ConversationStore {
  private readonly conversations = new Map<string, ConversationRecord>();

  getHistory(conversationId: string): ChatMessage[] {
    return this.recordFor(conversationId).messages;
  }

  appendMessage(conversationId: string, message: ChatMessage): void {
    this.recordFor(conversationId).messages.push(message);
  }

  addTokens(conversationId: string, tokens: number): void {
    this.recordFor(conversationId).tokensUsed += tokens;
  }

  incrementToolCalls(conversationId: string): void {
    this.recordFor(conversationId).toolCallsMade += 1;
  }

  getUsage(conversationId: string): UsageSnapshot {
    const record = this.recordFor(conversationId);
    return { tokensUsed: record.tokensUsed, toolCallsMade: record.toolCallsMade };
  }

  private recordFor(conversationId: string): ConversationRecord {
    let record = this.conversations.get(conversationId);
    if (!record) {
      record = { messages: [], tokensUsed: 0, toolCallsMade: 0 };
      this.conversations.set(conversationId, record);
    }
    return record;
  }
}
