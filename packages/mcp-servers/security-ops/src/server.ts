import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import type { ToolDefinition } from './tools/shared.js';
import { scanLogs } from './tools/scanLogs.js';
import { blockIp } from './tools/blockIp.js';
import { unblockIp } from './tools/unblockIp.js';
import { quarantineDevice } from './tools/quarantineDevice.js';
import { createIncident } from './tools/createIncident.js';

const TOOLS: ToolDefinition[] = [scanLogs, blockIp, unblockIp, quarantineDevice, createIncident];

// Builds the MCP server. Exported (not just started) so tests can connect a client in-process.
export function createServer(): Server {
  const server = new Server(
    { name: 'security-ops', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = TOOLS.find((t) => t.name === request.params.name);
    if (!tool) {
      // Unknown tool is a protocol-level error (JSON-RPC error response), not a tool result.
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }
    try {
      const data = await tool.handler(request.params.arguments ?? {});
      return {
        content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      // A tool that rejects its input is a domain failure → MCP isError result, never a raw throw.
      return {
        content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      };
    }
  });

  return server;
}
