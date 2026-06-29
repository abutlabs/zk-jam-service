#!/usr/bin/env node
/**
 * Hash Verification Client for JAM Service (PolkaJam or Lasair — see JAM_BACKEND)
 *
 * - Computes Blake2s-256 hash of the preimage
 * - Builds payload: [32 bytes hash] + [preimage bytes]
 * - Submits via the selected backend
 *
 * Usage:
 *   JAM_SERVICE_ID=99fbfec5 npm run hash-verify -- --preimage "hello world" --submit
 *   JAM_BACKEND=lasair JAM_SERVICE_ID=1729 npm run hash-verify -- --preimage "hello" --submit
 *   JAM_SERVICE_ID=99fbfec5 npm run hash-verify -- --preimage "hello" --tamper --submit
 */

import { program } from 'commander';
import { createHash } from 'node:crypto';
import { config } from './config.js';
import { getBackend } from './backends/index.js';
import { bytesToHex } from './utils/encoding.js';

interface HashVerifyOptions {
  preimage: string;
  serviceId?: string;
  submit?: boolean;
  tamper?: boolean;
}

/** Blake2s-256 (matches the Rust blake2 crate the service uses). */
function blake2s256(data: Buffer): Buffer {
  return createHash('blake2s256').update(data).digest();
}

async function main(): Promise<void> {
  program
    .name('hash-verify')
    .description('Submit a hash verification request to the JAM service')
    .requiredOption('-p, --preimage <data>', 'The preimage data to hash')
    .option('-s, --service-id <id>', 'Service ID (overrides JAM_SERVICE_ID)')
    .option('--submit', 'Actually submit to the network (otherwise just show the payload)')
    .option('--tamper', 'Tamper with the hash to test invalid verification')
    .parse();

  const opts = program.opts<HashVerifyOptions>();

  const serviceId = opts.serviceId ?? config.serviceId;
  if (!serviceId) {
    console.error('Error: No service ID provided.');
    console.error('Use --service-id or set JAM_SERVICE_ID environment variable.');
    process.exit(1);
  }

  const preimageBytes = Buffer.from(opts.preimage, 'utf8');
  console.log(`\nBackend: ${config.backend}`);
  console.log(`Preimage: "${opts.preimage}"`);
  console.log(`Preimage (hex): ${bytesToHex(new Uint8Array(preimageBytes))}`);

  const hash = blake2s256(preimageBytes);
  console.log(`Blake2s-256 hash: ${bytesToHex(new Uint8Array(hash))}`);

  let expectedHash = hash;
  if (opts.tamper) {
    expectedHash = Buffer.from(hash);
    expectedHash[0] = (expectedHash[0]! + 1) % 256;
    console.log(`Tampered hash:   ${bytesToHex(new Uint8Array(expectedHash))}`);
    console.log('(This should cause verification to FAIL)');
  }

  // payload = [32 bytes expected-hash] + [preimage bytes]
  const payload = Buffer.concat([expectedHash, preimageBytes]);
  const payloadHex = bytesToHex(new Uint8Array(payload));
  console.log(`Payload (hex): ${payloadHex}`);

  if (!opts.submit) {
    console.log('\n(Use --submit to actually send to the network)');
    return;
  }

  console.log('\n--- Submitting ---');
  try {
    const result = await getBackend().submitItem(serviceId, payloadHex);
    console.log('Work item submitted.');
    if (result.verdict !== 'unknown') {
      console.log(`Verdict: ${result.verdict.toUpperCase()}`);
    }
    if (result.storage && result.storage.length) {
      console.log('On-chain storage now:');
      for (const e of result.storage) {
        console.log(`  ${e.keyHex} = ${e.valueHex}`);
      }
    } else {
      console.log('(read the result back with: npm run query -- --key status)');
    }
  } catch (err) {
    console.error('Submission failed:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
