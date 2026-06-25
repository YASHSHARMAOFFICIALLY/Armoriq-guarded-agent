import { describe, it, expect } from 'vitest';
import { toOpenAiTools, REASONING_FIELD } from '../src/llmClient.js';
import type { McpToolSchema } from '@armoriq/shared';

describe('toOpenAiTools', () => {
  it('maps an McpToolSchema to an OpenAI function tool, injecting a required reasoning field', () => {
    const mcp: McpToolSchema[] = [
      {
        serverId: 's1',
        name: 'block_ip',
        description: 'block an ip',
        inputSchema: { type: 'object', properties: { ip: { type: 'string' } }, required: ['ip'] },
      },
    ];

    const [tool] = toOpenAiTools(mcp);
    expect(tool.type).toBe('function');
    expect(tool.function.name).toBe('block_ip');
    expect(tool.function.description).toBe('block an ip');

    const params = tool.function.parameters as { properties: Record<string, unknown>; required: string[] };
    expect(params.properties).toHaveProperty('ip'); // original input preserved
    expect(params.properties).toHaveProperty(REASONING_FIELD); // synthetic reasoning injected
    expect(params.required).toEqual(expect.arrayContaining(['ip', REASONING_FIELD]));
  });

  it('does not leak serverId to the model — it only sees tool names', () => {
    const [tool] = toOpenAiTools([
      { serverId: 'secret-server', name: 't', description: 'd', inputSchema: { type: 'object', properties: {} } },
    ]);
    expect(JSON.stringify(tool)).not.toContain('secret-server');
  });

  it('tolerates a tool with no/empty input schema', () => {
    const [tool] = toOpenAiTools([
      { serverId: 's', name: 'noargs', description: 'd', inputSchema: undefined },
    ]);
    const params = tool.function.parameters as { type: string; properties: Record<string, unknown> };
    expect(params.type).toBe('object');
    expect(params.properties).toHaveProperty(REASONING_FIELD);
  });
});
