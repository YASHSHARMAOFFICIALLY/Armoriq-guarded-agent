import { isIP } from 'node:net';
import type { ToolDefinition } from './shared.js';
import { requireString } from './shared.js';
import { blockedIps } from '../fakeData/ips.js';

export const unblockIp: ToolDefinition = {
  name: 'unblock_ip',
  description: 'Remove an IP address from the blocklist.',
  inputSchema: {
    type: 'object',
    properties: {
      ip: { type: 'string', description: 'IPv4 or IPv6 address to unblock.' },
      reason: { type: 'string', description: 'Why the IP is being unblocked.' },
    },
    required: ['ip', 'reason'],
  },
  handler: (args) => {
    const ip = requireString(args, 'ip');
    const reason = requireString(args, 'reason');
    if (isIP(ip) === 0) {
      throw new Error(`Invalid IP address: ${ip}`);
    }
    const index = blockedIps.findIndex((b) => b.ip === ip);
    if (index === -1) {
      throw new Error(`IP ${ip} is not currently blocked`);
    }
    blockedIps.splice(index, 1);
    return { status: 'UNBLOCKED', ip, reason, unblockedAt: new Date().toISOString() };
  },
};
