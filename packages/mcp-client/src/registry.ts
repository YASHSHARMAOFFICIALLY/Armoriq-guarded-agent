import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { McpToolSchema } from '@armoriq/shared';
import { stdioTransport } from './transports/stdioClient.js';
import { sseTransport } from './transports/sseClient.js';
import { httpTransport } from './transports/httpClient.js';

// Connection details the registry needs to reach a server. Extends the shared
// McpServerInfo shape with the transport-specific bits (command/args or url)
// that McpServerInfo deliberately doesn't carry.
export interface StdioConnection {
  id: string;
  name: string;
  transport: 'stdio';
  command: string;
  args?: string[];
}
export interface SseConnection {
  id: string;
  name: string;
  transport: 'sse';
  url: string;
}
export interface HttpConnection {
  id: string;
  name: string;
  transport: 'http';
  url: string;
}
export type McpConnection = StdioConnection | SseConnection | HttpConnection;

// What executeTool reports. Intentionally NOT the shared ToolResult: that type
// carries a proposalId, which belongs to the policy/server layer, not here. The
// server attaches the proposalId when it wraps this.
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Inversion of control so this package stays pure: instead of importing the
// policy-engine CircuitBreaker (a downward dependency), the registry just emits
// transport health signals. The server wires these to recordSuccess/recordFailure.
export interface McpRegistryHooks {
  onTransportSuccess?: (serverId: string) => void;
  onTransportError?: (serverId: string, error: unknown) => void;
}

function buildTransport(conn: McpConnection): Transport {
  switch (conn.transport) {
    case 'stdio':
      return stdioTransport(conn.command, conn.args);
    case 'sse':
      return sseTransport(conn.url);
    case 'http':
      return httpTransport(conn.url);
  }
}

export class McpRegistry {
  private readonly clients = new Map<string, Client>();
  private readonly tools = new Map<string, McpToolSchema[]>();
  private readonly hooks: McpRegistryHooks;

  constructor(hooks: McpRegistryHooks = {}) {
    this.hooks = hooks;
  }

  // Connects, then discovers the server's tools live via tools/list and caches
  // them tagged with serverId. `transport` is injectable for tests; production
  // callers omit it and a real stdio/sse transport is built from `conn`.
  async connect(conn: McpConnection, transport?: Transport): Promise<void> {
    const client = new Client({ name: 'armoriq-guarded-agent', version: '1.0.0' });
    await client.connect(transport ?? buildTransport(conn));

    const { tools } = await client.listTools();
    this.clients.set(conn.id, client);
    this.tools.set(
      conn.id,
      tools.map((tool) => ({
        serverId: conn.id,
        name: tool.name,
        description: tool.description ?? '',
        inputSchema: tool.inputSchema,
      })),
    );
  }

  async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client) return;
    await client.close();
    this.clients.delete(serverId);
    this.tools.delete(serverId);
  }

  // Always reflects what's currently live across all connected servers.
  listAllTools(): McpToolSchema[] {
    return [...this.tools.values()].flat();
  }

  // Executes a tool on a connected server. The breaker hooks key off the only thing
  // that distinguishes a broken server from a working one: whether the round-trip
  // completed. A thrown error means the transport/protocol failed (onTransportError).
  // A resolved call means the connection is healthy (onTransportSuccess) — even if the
  // tool itself reports `isError`, which is a domain failure, not a connectivity one.
  async executeTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const client = this.clients.get(serverId);
    if (!client) {
      // A usage mistake, not a connectivity event — leave the breaker untouched.
      return { success: false, error: `Not connected to server '${serverId}'` };
    }

    let result: Awaited<ReturnType<Client['callTool']>>;
    try {
      result = await client.callTool({ name: toolName, arguments: args });
    } catch (error) {
      this.hooks.onTransportError?.(serverId, error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }

    this.hooks.onTransportSuccess?.(serverId);
    if (result.isError) {
      return { success: false, error: textContent(result.content) || 'Tool reported an error' };
    }
    return { success: true, data: result.structuredContent ?? result.content };
  }
}

// Pulls the human-readable text out of an MCP tool result's content array.
// Handy for building the `error` string from an isError result.
export function textContent(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter((c): c is { type: 'text'; text: string } => c?.type === 'text')
    .map((c) => c.text)
    .join('\n');
}
