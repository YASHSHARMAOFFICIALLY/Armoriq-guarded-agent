export interface BlockedIp {
  ip: string;
  reason: string;
  blockedAt: string;
}

// Currently blocked IPs. block_ip pushes, unblock_ip splices. Starts empty.
export const blockedIps: BlockedIp[] = [];
