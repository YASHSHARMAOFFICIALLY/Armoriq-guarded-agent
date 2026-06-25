import type { Server as IOServer } from 'socket.io';
import type { ServerEvent } from './orchestrator.js';

// Emit a guardrail event to the room named after its conversation, so a dashboard client that
// joined that room sees only its own stream.
export function emitToConversation(io: IOServer, event: ServerEvent): void {
  io.to(event.conversationId).emit(event.type, event);
}
