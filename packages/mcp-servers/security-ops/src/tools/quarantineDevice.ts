import type { ToolDefinition } from './shared.js';
import { requireString } from './shared.js';
import { devices } from '../fakeData/devices.js';

export const quarantineDevice: ToolDefinition = {
  name: 'quarantine_device',
  description: 'Isolate a known device from the network by marking it quarantined.',
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: { type: 'string', description: 'ID of the device to quarantine, e.g. dev-001.' },
      reason: { type: 'string', description: 'Why the device is being quarantined.' },
    },
    required: ['deviceId', 'reason'],
  },
  handler: (args) => {
    const deviceId = requireString(args, 'deviceId');
    const reason = requireString(args, 'reason');
    const device = devices.find((d) => d.id === deviceId);
    if (!device) {
      throw new Error(`Unknown device: ${deviceId}`);
    }
    if (device.status === 'QUARANTINED') {
      throw new Error(`Device ${deviceId} is already quarantined`);
    }
    device.status = 'QUARANTINED';
    return { status: 'QUARANTINED', deviceId, name: device.name, reason };
  },
};
