/**
 * Lasair backend — talks to a lasair-node over its HTTP operator RPC.
 * Mirror of the PolkaJam workflow against Lasair's own contract (not PolkaJam's
 * wire protocol). See lasair docs/ZK_JAM_INTEGRATION_PLAN.md.
 */

import { readFile } from 'node:fs/promises';
import type { Backend, StorageEntry, SubmitResult, Verdict } from './types.js';

interface NodeStorageEntry { key_hex: string; value_hex: string; }
interface ItemResponse {
  verdict?: Verdict;
  refine_output_hex?: string;
  storage?: NodeStorageEntry[];
  error?: string;
}

export class LasairBackend implements Backend {
  readonly name = 'lasair';

  constructor(private readonly rpc: string) {}

  private url(p: string): string {
    return this.rpc.replace(/\/$/, '') + p;
  }

  private async req(p: string, init?: RequestInit): Promise<any> {
    const res = await fetch(this.url(p), init);
    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`non-JSON from lasair-node (${res.status}): ${text}`);
    }
    if (!res.ok || json?.error) {
      throw new Error(json?.error ?? `lasair-node returned ${res.status}`);
    }
    return json;
  }

  private post(p: string, body: unknown): Promise<any> {
    return this.req(p, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async deployService(jamPath: string, _endowment: string): Promise<string> {
    // Lasair funds the service at deploy; endowment is implicit (Deploy_demo).
    const jam = await readFile(jamPath);
    const r = await this.post('/v1/service', { jam_hex: jam.toString('hex') });
    return String(r.service_id);
  }

  async submitItem(serviceId: string, payloadHex: string): Promise<SubmitResult> {
    const r: ItemResponse = await this.post(`/v1/service/${serviceId}/item`, {
      payload_hex: payloadHex.replace(/^0x/, ''),
    });
    const storage: StorageEntry[] = (r.storage ?? []).map((e) => ({
      keyHex: e.key_hex,
      valueHex: e.value_hex,
    }));
    return { raw: JSON.stringify(r), verdict: r.verdict ?? 'unknown', storage };
  }

  async readStorage(serviceId: string, keyHex: string): Promise<string | null> {
    const k = keyHex.replace(/^0x/, '');
    const r = await this.req(`/v1/service/${serviceId}/storage/${k}`);
    return r.value_hex ? `0x${r.value_hex}` : null;
  }

  async readServiceInfo(serviceId: string): Promise<string> {
    const head = await this.req('/v1/head');
    return `lasair-node: service ${serviceId} | head slot ${head.slot}, ${head.services} service(s) hosted`;
  }
}
