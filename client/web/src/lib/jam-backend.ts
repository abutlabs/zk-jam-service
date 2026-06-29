/**
 * JAM backend for the web dashboard — the same polkajam | lasair switch the CLI
 * has, for Next.js server actions. Selected by JAM_BACKEND (server-side env).
 *
 *   JAM_BACKEND=polkajam  -> shell the bundled jamt CLI (default)
 *   JAM_BACKEND=lasair    -> HTTP operator RPC at LASAIR_RPC
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { readFile } from 'fs/promises';

const execAsync = promisify(exec);

export type BackendName = 'polkajam' | 'lasair';
export type Verdict = 'valid' | 'invalid' | 'unknown';

export interface StorageEntry { keyHex: string; valueHex: string; }
export interface ItemResult {
  success: boolean;
  verdict: Verdict;
  storage?: StorageEntry[];
  raw: string;
  error?: string;
}

export interface ServiceInfo { name: string; version: string; author: string; }

export interface JamBackend {
  readonly name: BackendName;
  readSlot(): Promise<number | null>;
  /** Returns 0x-prefixed hex value, or null. */
  readStorage(serviceId: string, keyHex: string): Promise<string | null>;
  submitItem(serviceId: string, payloadHex: string): Promise<ItemResult>;
  serviceInfo(serviceId: string): Promise<ServiceInfo | null>;
  deployService(jamPath: string): Promise<string>;
}

// ---- PolkaJam (jamt CLI) -------------------------------------------------
const JAMT_PATH =
  process.env.JAMT_PATH ?? path.resolve(process.cwd(), '../../polkajam-nightly/jamt');

class PolkajamBackend implements JamBackend {
  readonly name = 'polkajam' as const;

  private async runJamt(args: string[]): Promise<{ ok: boolean; out: string; err?: string }> {
    try {
      const { stdout } = await execAsync(`${JAMT_PATH} ${args.join(' ')}`, { timeout: 30000 });
      return { ok: true, out: stdout.trim() };
    } catch (e: unknown) {
      const x = e as { stdout?: string; stderr?: string; message?: string };
      return { ok: false, out: x.stdout ?? '', err: x.stderr ?? x.message ?? 'jamt failed' };
    }
  }

  async readSlot(): Promise<number | null> {
    const r = await this.runJamt(['inspect', 'best', 'slot']);
    if (!r.ok) return null;
    const n = parseInt(r.out, 10);
    return isNaN(n) ? null : n;
  }

  async readStorage(serviceId: string, keyHex: string): Promise<string | null> {
    const r = await this.runJamt(['inspect', 'best', 'storage', serviceId, keyHex]);
    return r.ok ? (r.out || null) : null;
  }

  async submitItem(serviceId: string, payloadHex: string): Promise<ItemResult> {
    const r = await this.runJamt(['item', serviceId, payloadHex]);
    return { success: r.ok, verdict: 'unknown', raw: r.out, error: r.ok ? undefined : r.err };
  }

  async serviceInfo(serviceId: string): Promise<ServiceInfo | null> {
    const r = await this.runJamt(['inspect', 'best', 'service', serviceId]);
    if (!r.ok) return null;
    // "Service zk-jam-service v0.1.0 by abutlabs <abutlabs@gmx.com>"
    const m = r.out.match(/Service\s+(\S+)\s+v(\S+)\s+by\s+(.+)/);
    return m ? { name: m[1] ?? '', version: m[2] ?? '', author: m[3] ?? '' } : null;
  }

  async deployService(jamPath: string): Promise<string> {
    const r = await this.runJamt(['create-service', jamPath, '10000000000']);
    const m = r.out.match(/\b([0-9a-fA-F]{6,})\b/);
    if (!r.ok || !m) throw new Error(r.err ?? `could not parse service id: ${r.out}`);
    return m[1];
  }
}

// ---- Lasair (HTTP operator RPC) -----------------------------------------
class LasairBackend implements JamBackend {
  readonly name = 'lasair' as const;
  constructor(private readonly rpc: string) {}

  private url(p: string): string { return this.rpc.replace(/\/$/, '') + p; }

  private async req(p: string, init?: RequestInit): Promise<any> {
    const res = await fetch(this.url(p), init);
    const text = await res.text();
    let json: any;
    try { json = text ? JSON.parse(text) : {}; }
    catch { throw new Error(`non-JSON from lasair-node (${res.status}): ${text}`); }
    if (!res.ok || json?.error) throw new Error(json?.error ?? `lasair-node ${res.status}`);
    return json;
  }

  async readSlot(): Promise<number | null> {
    try { return (await this.req('/v1/head')).slot ?? null; } catch { return null; }
  }

  async readStorage(serviceId: string, keyHex: string): Promise<string | null> {
    try {
      const r = await this.req(`/v1/service/${serviceId}/storage/${keyHex.replace(/^0x/, '')}`);
      return r.value_hex ? `0x${r.value_hex}` : null;
    } catch { return null; }
  }

  async submitItem(serviceId: string, payloadHex: string): Promise<ItemResult> {
    try {
      const r = await this.req(`/v1/service/${serviceId}/item`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payload_hex: payloadHex.replace(/^0x/, '') }),
      });
      const storage: StorageEntry[] = (r.storage ?? []).map((e: any) => ({
        keyHex: e.key_hex, valueHex: e.value_hex,
      }));
      return { success: true, verdict: r.verdict ?? 'unknown', storage, raw: JSON.stringify(r) };
    } catch (e) {
      return { success: false, verdict: 'unknown', raw: '', error: (e as Error).message };
    }
  }

  async serviceInfo(serviceId: string): Promise<ServiceInfo | null> {
    // lasair-node carries no service metadata; surface a basic record when the
    // node is reachable so the dashboard can show the hosted service.
    if ((await this.readSlot()) === null) return null;
    void serviceId;
    return { name: 'zk-jam-service', version: '0.1.0', author: 'abutlabs' };
  }

  async deployService(jamPath: string): Promise<string> {
    const jam = await readFile(jamPath);
    const r = await this.req('/v1/service', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jam_hex: jam.toString('hex') }),
    });
    return String(r.service_id);
  }
}

// ---- selector ------------------------------------------------------------
export function backendName(): BackendName {
  return (process.env.JAM_BACKEND ?? 'polkajam') as BackendName;
}

export function getBackend(): JamBackend {
  if (backendName() === 'lasair') {
    return new LasairBackend(process.env.LASAIR_RPC ?? 'http://localhost:19900');
  }
  return new PolkajamBackend();
}
