import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

// Connects to a remote MCP server over SSE/HTTP (e.g. Context7).
export function sseTransport(url: string): Transport {
  return new SSEClientTransport(new URL(url));
}
