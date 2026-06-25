import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

// Connects to a remote MCP server over Streamable HTTP (the current spec transport, e.g. Context7
// at https://mcp.context7.com/mcp). Many hosted servers have moved from SSE to this.
export function httpTransport(url: string): Transport {
  return new StreamableHTTPClientTransport(new URL(url));
}
