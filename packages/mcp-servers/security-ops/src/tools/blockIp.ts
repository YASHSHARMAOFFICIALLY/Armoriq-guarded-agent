import { isIP } from 'node:net';
import type { ToolDefinition } from './shared.js';
import { requireString } from './shared.js';
import { blockedIps } from '../fakeData/ips.js';

export const blockIp: ToolDefinition = {
  name: 'block_ip',
  description: 'Add an IP address to the blocklist. Validates IPv4/IPv6 format.',
  inputSchema: {
    type: 'object',
    properties: {
      ip: { type: 'string', description: 'IPv4 or IPv6 address to block.' },
      reason: { type: 'string', description: 'Why the IP is being blocked.' },
    },
    required: ['ip', 'reason'],
  },
  handler: (args) => {
    const ip = requireString(args, 'ip');
    const reason = requireString(args, 'reason');
    if (isIP(ip) === 0) {
      throw new Error(`Invalid IP address: ${ip}`);
    }
    if (blockedIps.some((b) => b.ip === ip)) {
      throw new Error(`IP ${ip} is already blocked`);
    }
    const entry = { ip, reason, blockedAt: new Date().toISOString() };
    blockedIps.push(entry);
    return { status: 'BLOCKED', ...entry };
  },
};
