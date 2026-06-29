/**
 * Backend abstraction — the seam that makes the JAM node a config option.
 *
 * The same client workflow (deploy → submit work-item → read storage) runs
 * against either PolkaJam (via the `jamt` CLI / WebSocket RPC) or a Lasair node
 * (via its HTTP operator RPC). Selected by JAM_BACKEND (see config.ts).
 */

export type Verdict = 'valid' | 'invalid' | 'unknown';

export interface StorageEntry {
  keyHex: string;
  valueHex: string;
}

export interface SubmitResult {
  /** Raw backend output, for display/logging. */
  raw: string;
  /** Hash-verification verdict, when the backend can report it inline
      (Lasair returns it; PolkaJam requires a follow-up storage read). */
  verdict: Verdict;
  /** Post-submission storage snapshot, when the backend returns one. */
  storage?: StorageEntry[];
}

export interface Backend {
  readonly name: string;

  /** Deploy a service blob (.jam at `jamPath`) with `endowment`; returns the
      service id (PolkaJam: hex; Lasair: decimal). */
  deployService(jamPath: string, endowment: string): Promise<string>;

  /** Submit a work-item payload (hex) to `serviceId`. */
  submitItem(serviceId: string, payloadHex: string): Promise<SubmitResult>;

  /** Read a storage key (hex); returns the `0x`-prefixed hex value, or null. */
  readStorage(serviceId: string, keyHex: string): Promise<string | null>;

  /** Human-readable service summary. */
  readServiceInfo(serviceId: string): Promise<string>;
}
