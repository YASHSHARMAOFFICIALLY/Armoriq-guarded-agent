export type DeviceStatus = 'ACTIVE' | 'QUARANTINED';

export interface Device {
  id: string;
  name: string;
  owner: string;
  status: DeviceStatus;
}

// Known devices. quarantine_device flips `status` in place.
export const devices: Device[] = [
  { id: 'dev-001', name: 'alice-laptop', owner: 'alice', status: 'ACTIVE' },
  { id: 'dev-002', name: 'web-prod-01', owner: 'platform', status: 'ACTIVE' },
  { id: 'dev-003', name: 'bob-phone', owner: 'bob', status: 'ACTIVE' },
];
