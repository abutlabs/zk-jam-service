/**
 * JAM RPC Client for Web Dashboard
 *
 * Provides methods to interact with a PolkaJam node via the jamt CLI
 * (since direct WebSocket RPC methods aren't fully documented yet)
 */

export interface ServiceInfo {
  id: string;
  name: string;
  version: string;
  author: string;
}

export interface SlotInfo {
  slot: number;
  timestamp: Date;
}

export interface WorkPackage {
  id: string;
  serviceId: string;
  status: 'pending' | 'refining' | 'auditing' | 'accumulated' | 'failed';
  slot: number;
  payload: string;
  result?: string;
}

// API endpoints for server actions
export const JAM_CONFIG = {
  rpcUrl: process.env.NEXT_PUBLIC_JAM_RPC ?? 'ws://localhost:19800',
  serviceId: process.env.NEXT_PUBLIC_JAM_SERVICE_ID ?? '',
};

/**
 * Encoding utilities
 */
export function stringToHex(str: string): string {
  return '0x' + Buffer.from(str, 'utf8').toString('hex');
}

export function hexToString(hex: string): string {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(cleanHex, 'hex').toString('utf8');
}

export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Parse service info from jamt output
 */
export function parseServiceInfo(output: string): ServiceInfo | null {
  // Format: "Service my-jam-service v0.1.0 by abutlabs <abutlabs@gmx.com>"
  const match = output.match(/Service\s+(\S+)\s+v(\S+)\s+by\s+(.+)/);
  if (!match) return null;

  return {
    id: '',
    name: match[1] ?? '',
    version: match[2] ?? '',
    author: match[3] ?? '',
  };
}

/**
 * Compute Blake2s-256 hash (browser-compatible)
 * Note: Uses SubtleCrypto which doesn't support Blake2s directly,
 * so we'll need to use a server action or the CLI for actual hashing
 */
export async function computeHash(preimage: string): Promise<string> {
  // This will be handled by server action calling the CLI
  throw new Error('Use server action for hash computation');
}
