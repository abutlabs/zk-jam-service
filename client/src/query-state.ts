#!/usr/bin/env node
/**
 * Query service state from the JAM network (PolkaJam or Lasair — see JAM_BACKEND)
 *
 * Usage:
 *   JAM_SERVICE_ID=0c7bb62b npm run query
 *   JAM_SERVICE_ID=0c7bb62b npm run query -- --key status
 *   JAM_BACKEND=lasair JAM_SERVICE_ID=1729 npm run query -- --key status
 */

import { program } from 'commander';
import { config, storageKeys } from './config.js';
import { getBackend } from './backends/index.js';
import { ensureHex, hexToString } from './utils/encoding.js';

interface QueryOptions {
  serviceId?: string;
  key?: string;
  block?: string;
  raw?: boolean;
}

async function queryServiceInfo(serviceId: string): Promise<void> {
  console.log(`Querying service: ${serviceId}\n`);
  try {
    console.log(await getBackend().readServiceInfo(serviceId));
  } catch (err) {
    console.error('Failed to query service:', err);
  }
}

async function queryStorage(
  serviceId: string,
  keyHex: string,
  raw: boolean
): Promise<void> {
  console.log(`Querying storage key: ${keyHex}`);
  console.log(`Service: ${serviceId}\n`);
  try {
    const value = await getBackend().readStorage(serviceId, keyHex);
    if (raw) {
      console.log(value ?? '(empty)');
    } else if (value && value.startsWith('0x')) {
      console.log(`Value (hex): ${value}`);
      try {
        console.log(`Value (string): ${hexToString(value)}`);
      } catch {
        /* not printable */
      }
    } else {
      console.log(value ?? '(empty)');
    }
  } catch (err) {
    console.error('Failed to query storage:', err);
  }
}

async function main(): Promise<void> {
  program
    .name('query-state')
    .description('Query JAM service state')
    .option('-s, --service-id <id>', 'Service ID (overrides JAM_SERVICE_ID)')
    .option('-k, --key <key>', 'Storage key to query (name or hex)')
    .option('-b, --block <id>', 'Block to query (best or final)', 'best')
    .option('-r, --raw', 'Output raw values without decoding')
    .parse();

  const opts = program.opts<QueryOptions>();

  const serviceId = opts.serviceId ?? config.serviceId;
  if (!serviceId) {
    console.error('Error: No service ID provided.');
    console.error('Use --service-id or set JAM_SERVICE_ID environment variable.');
    process.exit(1);
  }

  console.log(`Backend: ${config.backend}`);

  if (opts.key) {
    const knownKey = storageKeys[opts.key as keyof typeof storageKeys];
    const keyHex = knownKey ?? ensureHex(opts.key);
    await queryStorage(serviceId, keyHex, opts.raw ?? false);
  } else {
    await queryServiceInfo(serviceId);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
