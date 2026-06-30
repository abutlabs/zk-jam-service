'use server';

import { createHash } from 'crypto';
import { getBackend, backendName } from '../../lib/jam-backend';

/**
 * Get current slot from the network
 */
export async function getCurrentSlot(): Promise<{ slot: number | null; error?: string }> {
  const slot = await getBackend().readSlot();
  return slot === null ? { slot: null, error: 'Cannot reach JAM node' } : { slot };
}

/**
 * Get service info
 */
export async function getServiceInfo(serviceId: string): Promise<{
  name: string;
  version: string;
  author: string;
} | null> {
  return getBackend().serviceInfo(serviceId);
}

/**
 * Query service storage
 */
export async function getStorageValue(
  serviceId: string,
  key: string
): Promise<{ value: string | null; error?: string }> {
  const keyHex = key.startsWith('0x')
    ? key
    : '0x' + Buffer.from(key, 'utf8').toString('hex');
  try {
    return { value: await getBackend().readStorage(serviceId, keyHex) };
  } catch (e) {
    return { value: null, error: (e as Error).message };
  }
}

/**
 * Cast an anonymous vote. Asks the prover sidecar for a ZK proof that an eligible
 * member is voting (without revealing which member), then submits it to the JAM
 * service: refine verifies the proof, accumulate tallies it and rejects a re-used
 * nullifier (double-vote). The voter's identity never reaches the chain.
 */
export async function submitVote(
  serviceId: string,
  voter: number,
  vote: 0 | 1
): Promise<{ success: boolean; verdict?: string; error?: string }> {
  const proverUrl = process.env.PROVER_URL ?? 'http://prover:9090';
  try {
    const r = await fetch(`${proverUrl}/prove?voter=${voter}&vote=${vote}`);
    const j = await r.json();
    if (!r.ok || j.error || !j.submission_hex) {
      return { success: false, error: j.error || `prover error ${r.status}` };
    }
    const result = await getBackend().submitItem(serviceId, '0x' + j.submission_hex);
    return { success: result.success, verdict: result.verdict };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/** Read the on-chain tally (yes / no / total) from the voting service storage. */
export async function getVoteTally(
  serviceId: string
): Promise<{ yes: number; no: number; total: number; error?: string }> {
  const leU64 = (hex: string | null): number => {
    if (!hex) return 0;
    const b = Buffer.from(hex.replace(/^0x/, ''), 'hex');
    let n = 0;
    for (let i = b.length - 1; i >= 0; i--) n = n * 256 + b[i];
    return n;
  };
  try {
    const read = (k: string) =>
      getBackend().readStorage(serviceId, '0x' + Buffer.from(k, 'utf8').toString('hex'));
    const [yes, no, total] = await Promise.all([read('yes'), read('no'), read('total')]);
    return { yes: leU64(yes), no: leU64(no), total: leU64(total) };
  } catch (e) {
    return { yes: 0, no: 0, total: 0, error: (e as Error).message };
  }
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
  verdict?: 'valid' | 'invalid' | 'unknown';
  packageId?: string;
  slot?: number;
  error?: string;
}> {
  const preimageBuffer = Buffer.from(preimage, 'utf8');
  const hashBuffer = createHash('blake2s256').update(preimageBuffer).digest();

  const expectedHash = Buffer.from(hashBuffer);
  if (tamper) expectedHash[0] = (expectedHash[0]! + 1) % 256;

  // payload = [32 bytes expected-hash] + [preimage bytes]
  const payload = Buffer.concat([expectedHash, preimageBuffer]);
  const payloadHex = '0x' + payload.toString('hex');
  const hashHex = '0x' + hashBuffer.toString('hex');

  const result = await getBackend().submitItem(serviceId, payloadHex);
  if (!result.success) {
    return { success: false, hash: hashHex, payload: payloadHex, error: result.error };
  }

  // PolkaJam prints "package 0x.. anchor at #123"; Lasair returns the verdict inline.
  const packageMatch = result.raw.match(/package\s+(0x[a-f0-9]+)/i);
  const slotMatch = result.raw.match(/anchor at #(\d+)/);
  return {
    success: true,
    hash: hashHex,
    payload: payloadHex,
    verdict: result.verdict,
    packageId: packageMatch?.[1],
    slot: slotMatch ? parseInt(slotMatch[1], 10) : undefined,
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
    ? Array.from({ length: 10 }, (_, i) => slot - i).filter((s) => s > 0)
    : [];
  return { currentSlot: slot, recentSlots };
}

interface JamServiceInfo {
  id: string;
  name: string;
  version?: string;
  author?: string;
}

/**
 * Get list of available services on the chain.
 * PolkaJam: probe known IDs. Lasair: the configured hosted service.
 */
export async function getServices(): Promise<{
  services: JamServiceInfo[];
  error?: string;
}> {
  const backend = getBackend();
  const slot = await backend.readSlot();
  if (slot === null) {
    return { services: [], error: 'Cannot connect to JAM node' };
  }

  if (backendName() === 'lasair') {
    const id =
      process.env.NEXT_PUBLIC_JAM_SERVICE_ID ?? process.env.JAM_SERVICE_ID ?? '1729';
    const info = await backend.serviceInfo(id);
    return {
      services: info ? [{ id, name: info.name, version: info.version, author: info.author }] : [],
    };
  }

  // PolkaJam: probe the bootstrap + first few sequential IDs.
  const ids = ['00000000', '00000001', '00000002', '00000003', '00000004', '00000005'];
  const probed = await Promise.all(
    ids.map(async (id) => {
      const info = await backend.serviceInfo(id);
      return info && info.name ? { id, ...info } : null;
    })
  );
  const services: JamServiceInfo[] = [];
  for (const r of probed) if (r && !services.some((s) => s.id === r.id)) services.push(r);
  return { services };
}

/**
 * Check if a specific service exists and get its info
 */
export async function checkService(serviceId: string): Promise<JamServiceInfo | null> {
  const normalizedId =
    backendName() === 'lasair'
      ? serviceId
      : serviceId.toLowerCase().replace(/^0x/, '').padStart(8, '0');
  const info = await getBackend().serviceInfo(normalizedId);
  return info && info.name
    ? { id: normalizedId, name: info.name, version: info.version, author: info.author }
    : null;
}
