import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpRegistry } from '../src/registry.js';
import type { McpConnection, McpRegistryHooks } from '../src/registry.js';

// A trivial in-process MCP server with two tools. Mirrors a real stdio server
// (real Client, real protocol round-trips) without spawning a subprocess.
function mockServer(): McpServer {
  const server = new McpServer({ name: 'mock', version: '1.0.0' });
  server.registerTool(
    'echo',
    { description: 'echoes the message back', inputSchema: { message: z.string() } },
    async ({ message }) => ({ content: [{ type: 'text', text: message }] }),
  );
  server.registerTool(
    'boom',
    { description: 'always reports a domain error' },
    async () => ({ content: [{ type: 'text', text: 'kaboom' }], isError: true }),
  );
  return server;
}

const conn: McpConnection = { id: 'srv-1', name: 'Mock', transport: 'stdio', command: 'unused' };

// Links a real McpServer to the registry over an in-memory transport pair and
// returns the server so a test can close it to simulate a transport failure.
async function connectMock(registry: McpRegistry, c: McpConnection = conn): Promise<McpServer> {
  const server = mockServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await registry.connect(c, clientTransport);
  return server;
}

describe('McpRegistry discovery', () => {
  it('lists exactly the tools the live server advertises, tagged with the serverId', async () => {
    const registry = new McpRegistry();
    await connectMock(registry);

    const tools = registry.listAllTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['boom', 'echo']);
    expect(tools.every((t) => t.serverId === 'srv-1')).toBe(true);

    const echo = tools.find((t) => t.name === 'echo')!;
    expect(echo.description).toBe('echoes the message back');
    expect(echo.inputSchema).toBeTypeOf('object'); // raw JSON Schema relayed live, not hardcoded
  });

  it('aggregates tools across multiple connected servers', async () => {
    const registry = new McpRegistry();
    await connectMock(registry);
    await connectMock(registry, { id: 'srv-2', name: 'Mock2', transport: 'stdio', command: 'unused' });

    expect(registry.listAllTools()).toHaveLength(4);
    expect(new Set(registry.listAllTools().map((t) => t.serverId))).toEqual(new Set(['srv-1', 'srv-2']));
  });

  it('drops a server\'s tools after disconnect', async () => {
    const registry = new McpRegistry();
    await connectMock(registry);
    await registry.disconnect('srv-1');
    expect(registry.listAllTools()).toEqual([]);
  });
});

describe('McpRegistry.executeTool', () => {
  it('runs a tool and returns its output on success', async () => {
    const registry = new McpRegistry();
    await connectMock(registry);

    const result = await registry.executeTool('srv-1', 'echo', { message: 'hello' });
    expect(result.success).toBe(true);
    expect(JSON.stringify(result.data)).toContain('hello');
  });

  it('reports a tool-level (isError) result as a failure without a transport error', async () => {
    let transportError = false;
    const hooks: McpRegistryHooks = { onTransportError: () => { transportError = true; } };
    const registry = new McpRegistry(hooks);
    await connectMock(registry);

    const result = await registry.executeTool('srv-1', 'boom', {});
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(transportError).toBe(false); // tool ran fine; the connection is healthy
  });

  it('returns a failure (not a throw) when the server is not connected', async () => {
    const registry = new McpRegistry();
    const result = await registry.executeTool('ghost', 'echo', {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ghost/);
  });

  it('records a healthy round-trip via onTransportSuccess', async () => {
    let successes = 0;
    const registry = new McpRegistry({ onTransportSuccess: () => { successes++; } });
    await connectMock(registry);

    await registry.executeTool('srv-1', 'echo', { message: 'hi' });
    expect(successes).toBe(1);
  });

  it('feeds a transport failure to onTransportError', async () => {
    let failedServer: string | null = null;
    const registry = new McpRegistry({ onTransportError: (id) => { failedServer = id; } });
    const server = await connectMock(registry);

    await server.close(); // kill the far end → next call cannot complete its round-trip

    const result = await registry.executeTool('srv-1', 'echo', { message: 'hi' });
    expect(result.success).toBe(false);
    expect(failedServer).toBe('srv-1');
  });
});
