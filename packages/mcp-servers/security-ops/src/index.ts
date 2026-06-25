import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const server = createServer();
await server.connect(new StdioServerTransport());
// stdout carries the JSON-RPC stream — diagnostics must go to stderr only.
console.error('security-ops MCP server running on stdio');
