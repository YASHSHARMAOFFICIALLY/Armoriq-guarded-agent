// The shape every tool module exports. The server registers these uniformly, so adding a
// tool is "write the module, drop it in the TOOLS array" — no other changes.
export interface ToolDefinition {
  name: string;
  description: string;
  // Raw JSON Schema — MCP requires JSON Schema for tool inputs (not zod).
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  // Returns plain data (the server wraps it into an MCP result) or throws on bad input.
  handler: (args: Record<string, unknown>) => unknown;
}

// Tool input is untrusted, so validate at the boundary even though the JSON Schema and the
// policy engine also check (defense in depth). A throw here becomes an MCP isError result.
export function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing or invalid '${key}' (expected a non-empty string)`);
  }
  return value;
}
