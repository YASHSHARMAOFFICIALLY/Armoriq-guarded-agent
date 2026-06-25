import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpRegistry, type McpConnection } from '@armoriq/mcp-client';
import { CircuitBreaker } from '@armoriq/policy-engine';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// Builds the registry with its transport-health hooks wired to the SAME circuit breaker the policy
// engine reads — so a flaky MCP server trips the breaker and evaluate() then denies calls to it.
export function createRegistry(circuitBreaker: CircuitBreaker): McpRegistry {
  return new McpRegistry({
    onTransportError: (serverId) => circuitBreaker.recordFailure(serverId),
    onTransportSuccess: (serverId) => circuitBreaker.recordSuccess(serverId),
  });
}

// Fallback when no config file / env is present: just the bundled security-ops server.
const DEFAULT_SERVERS: McpConnection[] = [
  {
    id: 'security-ops',
    name: 'Security Ops',
    transport: 'stdio',
    command: 'node',
    args: [process.env.SECURITY_OPS_PATH ?? 'packages/mcp-servers/security-ops/dist/index.js'],
  },
];

function parseServers(raw: unknown): McpConnection[] {
  if (!Array.isArray(raw)) throw new Error('MCP server config must be a JSON array');
  return raw.map((entry, i) => {
    const o = entry as Record<string, unknown>;
    if (!o || typeof o.id !== 'string' || typeof o.name !== 'string') {
      throw new Error(`server[${i}] must have string id and name`);
    }
    if (o.transport === 'stdio' && typeof o.command === 'string') {
      return {
        id: o.id,
        name: o.name,
        transport: 'stdio',
        command: o.command,
        args: Array.isArray(o.args) ? (o.args as string[]) : [],
      };
    }
    if (o.transport === 'sse' && typeof o.url === 'string') {
      return { id: o.id, name: o.name, transport: 'sse', url: o.url };
    }
    if (o.transport === 'http' && typeof o.url === 'string') {
      return { id: o.id, name: o.name, transport: 'http', url: o.url };
    }
    throw new Error(`server[${i}] needs transport 'stdio' (command), 'sse' (url), or 'http' (url)`);
  });
}

// Where the server list comes from — data, never code. Precedence: MCP_SERVERS env (JSON) >
// mcp-servers.json at the repo root > built-in default. Adding/removing a server is a config edit.
function loadServerConfig(): McpConnection[] {
  const env = process.env.MCP_SERVERS;
  if (env && env.trim()) {
    try {
      return parseServers(JSON.parse(env));
    } catch (e) {
      console.error('Invalid MCP_SERVERS env, ignoring:', e instanceof Error ? e.message : e);
    }
  }
  try {
    const raw = readFileSync(resolve(repoRoot, 'mcp-servers.json'), 'utf8');
    return parseServers(JSON.parse(raw));
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.error('Invalid mcp-servers.json, using defaults:', e instanceof Error ? e.message : e);
    }
    return DEFAULT_SERVERS;
  }
}

// Connects every configured MCP server and discovers its tools live. A server that fails to connect
// is logged and skipped so one bad endpoint can't block boot — the rest still come up.
export async function connectConfiguredServers(registry: McpRegistry): Promise<void> {
  const servers = loadServerConfig();
  for (const conn of servers) {
    try {
      await registry.connect(conn);
      console.error(`connected MCP server '${conn.id}' (${conn.transport})`);
    } catch (e) {
      console.error(`failed to connect MCP server '${conn.id}':`, e instanceof Error ? e.message : e);
    }
  }
  console.error(`MCP: ${registry.listAllTools().length} tools discovered across configured servers`);
}
