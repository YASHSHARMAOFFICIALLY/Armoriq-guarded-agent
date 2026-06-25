import { describe, it, expect, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';
import { blockedIps } from '../src/fakeData/ips.js';

// Connects a real Client to the real server over an in-memory pair — exercises the
// actual ListTools/CallTool request handlers, no subprocess needed.
async function connectClient(): Promise<Client> {
  const server = createServer();
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

beforeEach(() => {
  blockedIps.length = 0;
});

describe('security-ops server', () => {
  it('lists all 5 tools, each with an object input schema', async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'block_ip',
      'create_incident',
      'quarantine_device',
      'scan_logs',
      'unblock_ip',
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.description).toBeTruthy();
    }
  });

  it('executes a valid call and returns its result', async () => {
    const client = await connectClient();
    const res = await client.callTool({ name: 'block_ip', arguments: { ip: '203.0.113.9', reason: 'test' } });
    expect(res.isError).toBeFalsy();
    expect(JSON.stringify(res.content)).toContain('203.0.113.9');
  });

  it('returns an isError result (not a thrown exception) on invalid input', async () => {
    const client = await connectClient();
    const res = await client.callTool({ name: 'block_ip', arguments: { ip: 'not-an-ip', reason: 'test' } });
    expect(res.isError).toBe(true);
    expect(JSON.stringify(res.content).toLowerCase()).toContain('invalid ip');
  });

  it('rejects an unknown tool as a protocol error', async () => {
    const client = await connectClient();
    await expect(client.callTool({ name: 'does_not_exist', arguments: {} })).rejects.toThrow();
  });
});
