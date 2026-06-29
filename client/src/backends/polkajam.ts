/**
 * PolkaJam backend — shells the bundled `jamt` CLI (WebSocket RPC to the node).
 * This preserves the original client behaviour exactly; it is the default.
 */

import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { parseServiceId } from '../utils/encoding.js';
import type { Backend, SubmitResult } from './types.js';

function jamtPath(): string {
  // Overridable; default resolves polkajam-nightly/jamt at the repo root
  // (this file lives at client/src/backends/, so up three levels).
  return (
    process.env.JAMT_PATH ??
    path.resolve(import.meta.dirname, '../../../polkajam-nightly/jamt')
  );
}

function execJamt(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(jamtPath(), args, { stdio: ['inherit', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) =>
      code === 0
        ? resolve(stdout.trim())
        : reject(new Error(stderr || `jamt exited with code ${code}`))
    );
    proc.on('error', reject);
  });
}

export class PolkajamBackend implements Backend {
  readonly name = 'polkajam';

  async deployService(jamPath: string, endowment: string): Promise<string> {
    const out = await execJamt(['create-service', jamPath, endowment]);
    const m = out.match(/\b([0-9a-fA-F]{6,})\b/);
    if (!m) throw new Error(`could not parse service id from jamt output: ${out}`);
    return m[1];
  }

  async submitItem(serviceId: string, payloadHex: string): Promise<SubmitResult> {
    const payload = payloadHex.replace(/^0x/, '');
    const raw = await execJamt(['item', parseServiceId(serviceId), payload]);
    // PolkaJam does not report the verdict inline — it is read back from storage.
    return { raw, verdict: 'unknown' };
  }

  async readStorage(serviceId: string, keyHex: string): Promise<string | null> {
    const out = await execJamt([
      'inspect', 'best', 'storage', parseServiceId(serviceId), keyHex,
    ]);
    const t = out.trim();
    if (!t || t === '(empty)') return null;
    return t.startsWith('0x') ? t : `0x${t}`;
  }

  async readServiceInfo(serviceId: string): Promise<string> {
    return execJamt(['inspect', 'best', 'service', parseServiceId(serviceId)]);
  }
}
