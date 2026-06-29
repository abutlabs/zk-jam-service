/**
 * Backend selector — `JAM_BACKEND` chooses PolkaJam (default) or Lasair.
 */

import { config } from '../config.js';
import { PolkajamBackend } from './polkajam.js';
import { LasairBackend } from './lasair.js';
import type { Backend } from './types.js';

export function getBackend(): Backend {
  switch (config.backend) {
    case 'lasair':
      return new LasairBackend(config.lasairRpc);
    case 'polkajam':
      return new PolkajamBackend();
    default:
      throw new Error(
        `unknown JAM_BACKEND "${config.backend}" (expected "polkajam" or "lasair")`
      );
  }
}

export type { Backend, SubmitResult, StorageEntry, Verdict } from './types.js';
