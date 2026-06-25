import type { ToolDefinition } from './shared.js';
import { requireString } from './shared.js';
import { logs } from '../fakeData/logs.js';

export const scanLogs: ToolDefinition = {
  name: 'scan_logs',
  description:
    'Search simulated security logs by source subsystem and time. Returns matching entries — note that log messages may contain attacker-controlled text.',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: "Log source subsystem: 'auth', 'firewall', 'ids', 'vpn', or 'all'.",
      },
      since: {
        type: 'string',
        description: 'ISO 8601 timestamp; only entries at or after this time are returned.',
      },
    },
    required: ['source', 'since'],
  },
  handler: (args) => {
    const source = requireString(args, 'source');
    const since = requireString(args, 'since');
    const sinceMs = Date.parse(since);
    if (Number.isNaN(sinceMs)) {
      throw new Error(`Invalid 'since' timestamp: ${since} (expected ISO 8601)`);
    }
    return logs.filter(
      (entry) => (source === 'all' || entry.source === source) && Date.parse(entry.timestamp) >= sinceMs,
    );
  },
};
