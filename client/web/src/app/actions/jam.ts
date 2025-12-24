'use server';

import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import path from 'path';

const execAsync = promisify(exec);

// Path to jamt binary (relative to project root)
const JAMT_PATH = path.resolve(process.cwd(), '../../polkajam-nightly/jamt');

interface ExecResult {
  success: boolean;
  output: string;
  error?: string;
}

async function runJamt(args: string[]): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execAsync(`${JAMT_PATH} ${args.join(' ')}`, {
      timeout: 30000,
    });
    return { success: true, output: stdout.trim() };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return {
      success: false,
      output: err.stdout ?? '',
      error: err.stderr ?? err.message ?? 'Unknown error',
    };
  }
}

/**
 * Get current slot from the network
 */
export async function getCurrentSlot(): Promise<{ slot: number | null; error?: string }> {
  const result = await runJamt(['inspect', 'best', 'slot']);
  if (result.success) {
    const slot = parseInt(result.output, 10);
    return { slot: isNaN(slot) ? null : slot };
  }
  return { slot: null, error: result.error };
}

/**
 * Get service info
 */
export async function getServiceInfo(serviceId: string): Promise<{
  name: string;
  version: string;
  author: string;
} | null> {
  const result = await runJamt(['inspect', 'best', 'service', serviceId]);
  if (!result.success) return null;

  // Parse: "Service zk-jam-service v0.1.0 by abutlabs <abutlabs@gmx.com>"
  const match = result.output.match(/Service\s+(\S+)\s+v(\S+)\s+by\s+(.+)/);
  if (!match) return null;

  return {
    name: match[1] ?? '',
    version: match[2] ?? '',
    author: match[3] ?? '',
  };
}

/**
 * Query service storage
 */
export async function getStorageValue(
  serviceId: string,
  key: string
): Promise<{ value: string | null; error?: string }> {
  // Convert key to hex if not already
  const keyHex = key.startsWith('0x')
    ? key
    : '0x' + Buffer.from(key, 'utf8').toString('hex');

  const result = await runJamt(['inspect', 'best', 'storage', serviceId, keyHex]);
  if (result.success) {
    return { value: result.output || null };
  }
  return { value: null, error: result.error };
}

/**
 * Compute Blake2s-256 hash
 */
export async function computeBlake2sHash(preimage: string): Promise<string> {
  const hash = createHash('blake2s256')
    .update(Buffer.from(preimage, 'utf8'))
    .digest('hex');
  return '0x' + hash;
}

/**
 * Submit a hash verification work item
 */
export async function submitHashVerification(
  serviceId: string,
  preimage: string,
  tamper: boolean = false
): Promise<{
  success: boolean;
  hash: string;
  payload: string;
  packageId?: string;
  slot?: number;
  error?: string;
}> {
  // Compute hash
  const preimageBuffer = Buffer.from(preimage, 'utf8');
  const hashBuffer = createHash('blake2s256').update(preimageBuffer).digest();

  // Optionally tamper with hash
  let expectedHash = Buffer.from(hashBuffer);
  if (tamper) {
    expectedHash[0] = (expectedHash[0]! + 1) % 256;
  }

  // Build payload: [32 bytes hash] + [preimage bytes]
  const payload = Buffer.concat([expectedHash, preimageBuffer]);
  const payloadHex = '0x' + payload.toString('hex');
  const hashHex = '0x' + hashBuffer.toString('hex');

  // Submit via jamt
  const result = await runJamt(['item', serviceId, payloadHex]);

  if (result.success) {
    // Parse output for package ID and slot
    // "Item submitted in package 0x... with anchor at #123"
    const packageMatch = result.output.match(/package\s+(0x[a-f0-9]+)/i);
    const slotMatch = result.output.match(/anchor at #(\d+)/);

    return {
      success: true,
      hash: hashHex,
      payload: payloadHex,
      packageId: packageMatch?.[1],
      slot: slotMatch ? parseInt(slotMatch[1], 10) : undefined,
    };
  }

  return {
    success: false,
    hash: hashHex,
    payload: payloadHex,
    error: result.error,
  };
}

/**
 * Get recent activity (placeholder - would need event subscription)
 */
export async function getRecentActivity(): Promise<{
  currentSlot: number | null;
  recentSlots: number[];
}> {
  const { slot } = await getCurrentSlot();
  const recentSlots = slot
    ? Array.from({ length: 10 }, (_, i) => slot - i).filter(s => s > 0)
    : [];

  return { currentSlot: slot, recentSlots };
}
