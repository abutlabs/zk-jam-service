#!/usr/bin/env node
/**
 * Submit a proof/payload to the JAM service
 *
 * Usage:
 *   JAM_SERVICE_ID=0c7bb62b npm run submit -- --payload "hello"
 *   JAM_SERVICE_ID=0c7bb62b npm run submit -- --payload 0x48656c6c6f
 *   JAM_SERVICE_ID=0c7bb62b npm run submit -- --file proof.bin
 */

import { program } from 'commander';
import * as fs from 'node:fs';
import { config, validateConfig } from './config.js';
import { getRpcClient } from './utils/rpc.js';
import { ensureHex, bytesToHex, parseServiceId } from './utils/encoding.js';

interface SubmitOptions {
  payload?: string;
  file?: string;
  serviceId?: string;
  refineGas?: string;
  accumulateGas?: string;
}

async function submitWorkItem(payloadHex: string, serviceId: string): Promise<void> {
  const client = getRpcClient();

  try {
    await client.connect();
    console.log(`Connected to ${config.rpcUrl}`);

    // Note: The actual RPC method depends on PolkaJam's API
    // This is a placeholder - we may need to use jamt via subprocess
    // or discover the correct RPC method
    console.log(`\nSubmitting to service: ${serviceId}`);
    console.log(`Payload: ${payloadHex.slice(0, 66)}${payloadHex.length > 66 ? '...' : ''}`);
    console.log(`Payload size: ${(payloadHex.length - 2) / 2} bytes`);

    // For now, inform user to use jamt directly
    // TODO: Implement direct RPC submission when API is documented
    console.log('\n---');
    console.log('Direct RPC submission not yet implemented.');
    console.log('Use jamt CLI instead:');
    console.log(`  ./polkajam-nightly/jamt item ${serviceId} ${payloadHex}`);

  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    client.disconnect();
  }
}

async function main(): Promise<void> {
  program
    .name('submit-proof')
    .description('Submit a proof or payload to the JAM service')
    .option('-p, --payload <data>', 'Payload data (string or hex with 0x prefix)')
    .option('-f, --file <path>', 'Read payload from file')
    .option('-s, --service-id <id>', 'Service ID (overrides JAM_SERVICE_ID)')
    .option('-G, --refine-gas <amount>', 'Gas for refine stage')
    .option('-g, --accumulate-gas <amount>', 'Gas for accumulate stage')
    .parse();

  const opts = program.opts<SubmitOptions>();

  // Determine service ID
  const serviceId = opts.serviceId ?? config.serviceId;
  if (!serviceId) {
    console.error('Error: No service ID provided.');
    console.error('Use --service-id or set JAM_SERVICE_ID environment variable.');
    process.exit(1);
  }

  // Determine payload
  let payloadHex: string;

  if (opts.file) {
    // Read from file
    if (!fs.existsSync(opts.file)) {
      console.error(`Error: File not found: ${opts.file}`);
      process.exit(1);
    }
    const fileData = fs.readFileSync(opts.file);
    payloadHex = bytesToHex(new Uint8Array(fileData));
    console.log(`Read ${fileData.length} bytes from ${opts.file}`);
  } else if (opts.payload) {
    // Use provided payload
    payloadHex = ensureHex(opts.payload);
  } else {
    console.error('Error: No payload provided.');
    console.error('Use --payload <data> or --file <path>');
    process.exit(1);
  }

  const normalizedServiceId = parseServiceId(serviceId);

  await submitWorkItem(payloadHex, normalizedServiceId);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
