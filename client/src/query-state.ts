#!/usr/bin/env node
/**
 * Query service state from the JAM network
 *
 * Usage:
 *   JAM_SERVICE_ID=0c7bb62b npm run query
 *   JAM_SERVICE_ID=0c7bb62b npm run query -- --key status
 *   JAM_SERVICE_ID=0c7bb62b npm run query -- --key 0x737461747573
 */

import { program } from 'commander';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { config, storageKeys } from './config.js';
import { getRpcClient } from './utils/rpc.js';
import { ensureHex, hexToString, parseServiceId } from './utils/encoding.js';

interface QueryOptions {
  serviceId?: string;
  key?: string;
  block?: string;
  raw?: boolean;
}

/**
 * Execute jamt command and return output
 */
function execJamt(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    // Find polkajam-nightly relative to client directory
    const jamtPath = path.resolve(
      import.meta.dirname,
      '../../polkajam-nightly/jamt'
    );

    const proc = spawn(jamtPath, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `jamt exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function queryServiceInfo(serviceId: string): Promise<void> {
  console.log(`Querying service: ${serviceId}\n`);

  try {
    const output = await execJamt(['inspect', 'best', 'service', serviceId]);
    console.log(output);
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
    const output = await execJamt([
      'inspect',
      'best',
      'storage',
      serviceId,
      keyHex,
    ]);

    if (raw) {
      console.log(output);
    } else {
      // Try to decode as string
      if (output && output.startsWith('0x')) {
        try {
          const decoded = hexToString(output);
          console.log(`Value (hex): ${output}`);
          console.log(`Value (string): ${decoded}`);
        } catch {
          console.log(`Value: ${output}`);
        }
      } else {
        console.log(output || '(empty)');
      }
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

  // Determine service ID
  const serviceId = opts.serviceId ?? config.serviceId;
  if (!serviceId) {
    console.error('Error: No service ID provided.');
    console.error('Use --service-id or set JAM_SERVICE_ID environment variable.');
    process.exit(1);
  }

  const normalizedServiceId = parseServiceId(serviceId);

  if (opts.key) {
    // Query specific storage key
    let keyHex: string;

    // Check if it's a known key name
    const knownKey = storageKeys[opts.key as keyof typeof storageKeys];
    if (knownKey) {
      keyHex = knownKey;
    } else {
      keyHex = ensureHex(opts.key);
    }

    await queryStorage(normalizedServiceId, keyHex, opts.raw ?? false);
  } else {
    // Query service info
    await queryServiceInfo(normalizedServiceId);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
