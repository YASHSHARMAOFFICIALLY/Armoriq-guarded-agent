import { z } from 'zod';

export const McpServerInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  transport: z.enum(['stdio', 'sse']),
  status: z.enum(['CONNECTED', 'DISCONNECTED', 'CIRCUIT_OPEN']),
});
export type McpServerInfo = z.infer<typeof McpServerInfoSchema>;

// Mirrors a single tool from MCP's tools/list. inputSchema stays unknown — it's
// raw JSON Schema from the SDK; don't retype it here.
export const McpToolSchemaSchema = z.object({
  serverId: z.string(),
  name: z.string(),
  description: z.string(),
  inputSchema: z.unknown(),
});
export type McpToolSchema = z.infer<typeof McpToolSchemaSchema>;
