import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

// Spawns a local MCP server (e.g. `node packages/mcp-servers/security-ops/dist/index.js`)
// and returns a transport ready to hand to a Client.
export function stdioTransport(command: string, args: string[] = []): Transport {
  return new StdioClientTransport({ command, args });
}
