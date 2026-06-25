import { describe, it, expect, beforeEach } from 'vitest';
import { scanLogs } from '../src/tools/scanLogs.js';
import { blockIp } from '../src/tools/blockIp.js';
import { unblockIp } from '../src/tools/unblockIp.js';
import { quarantineDevice } from '../src/tools/quarantineDevice.js';
import { createIncident } from '../src/tools/createIncident.js';
import { blockedIps } from '../src/fakeData/ips.js';
import { devices } from '../src/fakeData/devices.js';

// Fake data is mutable module state — reset the bits the tools change so tests don't bleed.
beforeEach(() => {
  blockedIps.length = 0;
  for (const d of devices) d.status = 'ACTIVE';
});

describe('scan_logs', () => {
  it('returns only entries from the requested source at or after `since`', () => {
    const result = scanLogs.handler({ source: 'auth', since: '2000-01-01T00:00:00Z' }) as Array<{ source: string }>;
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((e) => e.source === 'auth')).toBe(true);
  });

  it('filters out entries older than `since`', () => {
    const all = scanLogs.handler({ source: 'auth', since: '2000-01-01T00:00:00Z' }) as unknown[];
    const future = scanLogs.handler({ source: 'auth', since: '2999-01-01T00:00:00Z' }) as unknown[];
    expect(future.length).toBeLessThan(all.length);
  });

  it('surfaces log lines carrying an embedded prompt-injection payload', () => {
    const result = scanLogs.handler({ source: 'ids', since: '2000-01-01T00:00:00Z' });
    expect(JSON.stringify(result).toLowerCase()).toContain('ignore all previous instructions');
  });

  it('throws on an invalid `since` timestamp', () => {
    expect(() => scanLogs.handler({ source: 'auth', since: 'not-a-date' })).toThrow();
  });
});

describe('block_ip / unblock_ip', () => {
  it('blocks a valid IPv4 and records it', () => {
    const res = blockIp.handler({ ip: '203.0.113.5', reason: 'brute force' }) as { ip: string };
    expect(res.ip).toBe('203.0.113.5');
    expect(blockedIps.some((b) => b.ip === '203.0.113.5')).toBe(true);
  });

  it('blocks a valid IPv6', () => {
    const res = blockIp.handler({ ip: '2001:db8::1', reason: 'port scan' }) as { ip: string };
    expect(res.ip).toBe('2001:db8::1');
  });

  it('rejects an invalid IP', () => {
    expect(() => blockIp.handler({ ip: '999.999.0.1', reason: 'x' })).toThrow(/invalid ip/i);
  });

  it('rejects re-blocking an already-blocked IP', () => {
    blockIp.handler({ ip: '203.0.113.6', reason: 'first' });
    expect(() => blockIp.handler({ ip: '203.0.113.6', reason: 'again' })).toThrow(/already blocked/i);
  });

  it('unblocks a previously blocked IP', () => {
    blockIp.handler({ ip: '198.51.100.7', reason: 'test' });
    const res = unblockIp.handler({ ip: '198.51.100.7', reason: 'cleared' }) as { status: string };
    expect(res.status).toBe('UNBLOCKED');
    expect(blockedIps.some((b) => b.ip === '198.51.100.7')).toBe(false);
  });

  it('errors when unblocking an IP that is not blocked', () => {
    expect(() => unblockIp.handler({ ip: '10.0.0.1', reason: 'x' })).toThrow(/not.*blocked/i);
  });
});

describe('quarantine_device', () => {
  it('quarantines a known device', () => {
    const id = devices[0].id;
    const res = quarantineDevice.handler({ deviceId: id, reason: 'malware beacon' }) as { status: string };
    expect(res.status).toBe('QUARANTINED');
    expect(devices.find((d) => d.id === id)!.status).toBe('QUARANTINED');
  });

  it('errors on an unknown device', () => {
    expect(() => quarantineDevice.handler({ deviceId: 'ghost-999', reason: 'x' })).toThrow(/unknown device/i);
  });
});

describe('create_incident', () => {
  it('creates an incident from valid input', () => {
    const res = createIncident.handler({ title: 'Data breach', severity: 'HIGH', details: 'exfil detected' }) as {
      id: string;
      severity: string;
      status: string;
    };
    expect(res.id).toBeTruthy();
    expect(res.severity).toBe('HIGH');
    expect(res.status).toBe('OPEN');
  });

  it('rejects an invalid severity', () => {
    expect(() => createIncident.handler({ title: 'x', severity: 'SUPER', details: 'y' })).toThrow(/severity/i);
  });

  it('rejects details exceeding the max length', () => {
    expect(() =>
      createIncident.handler({ title: 'x', severity: 'LOW', details: 'a'.repeat(10_000) }),
    ).toThrow(/details/i);
  });
});
