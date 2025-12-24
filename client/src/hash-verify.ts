#!/usr/bin/env node
/**
 * Hash Verification Client for JAM Service
 *
 * This script creates a proper payload for the hash verification service:
 * - Computes Blake2s-256 hash of the preimage
 * - Builds payload: [32 bytes hash] + [preimage bytes]
 * - Submits via jamt or outputs the command
 *
 * Usage:
 *   JAM_SERVICE_ID=99fbfec5 npm run hash-verify -- --preimage "hello world"
 *   JAM_SERVICE_ID=99fbfec5 npm run hash-verify -- --preimage "hello world" --submit
 *   JAM_SERVICE_ID=99fbfec5 npm run hash-verify -- --preimage "hello world" --tamper
 */

import { program } from 'commander';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { config } from './config.js';
import { bytesToHex, parseServiceId } from './utils/encoding.js';

interface HashVerifyOptions {
  preimage: string;
  serviceId?: string;
  submit?: boolean;
  tamper?: boolean;
}

/**
 * Compute Blake2s-256 hash (compatible with Rust blake2 crate)
 */
function blake2s256(data: Buffer): Buffer {
  // Node.js crypto supports blake2s256
  return createHash('blake2s256').update(data).digest();
}

/**
 * Execute jamt command
 */
function execJamt(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const jamtPath = path.resolve(
      import.meta.dirname,
      '../../polkajam-nightly/jamt'
    );

    console.log(`Running: jamt ${args.join(' ')}`);

    const proc = spawn(jamtPath, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
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

async function main(): Promise<void> {
  program
    .name('hash-verify')
    .description('Submit a hash verification request to the JAM service')
    .requiredOption('-p, --preimage <data>', 'The preimage data to hash')
    .option('-s, --service-id <id>', 'Service ID (overrides JAM_SERVICE_ID)')
    .option('--submit', 'Actually submit to the network (otherwise just show command)')
    .option('--tamper', 'Tamper with the hash to test invalid verification')
    .parse();

  const opts = program.opts<HashVerifyOptions>();

  // Determine service ID
  const serviceId = opts.serviceId ?? config.serviceId;
  if (!serviceId) {
    console.error('Error: No service ID provided.');
    console.error('Use --service-id or set JAM_SERVICE_ID environment variable.');
    process.exit(1);
  }

  const normalizedServiceId = parseServiceId(serviceId);

  // Convert preimage to bytes
  const preimageBytes = Buffer.from(opts.preimage, 'utf8');
  console.log(`\nPreimage: "${opts.preimage}"`);
  console.log(`Preimage (hex): ${bytesToHex(new Uint8Array(preimageBytes))}`);
  console.log(`Preimage size: ${preimageBytes.length} bytes`);

  // Compute hash
  const hash = blake2s256(preimageBytes);
  console.log(`\nBlake2s-256 hash: ${bytesToHex(new Uint8Array(hash))}`);

  // Optionally tamper with the hash
  let expectedHash = hash;
  if (opts.tamper) {
    expectedHash = Buffer.from(hash);
    expectedHash[0] = (expectedHash[0]! + 1) % 256; // Flip first byte
    console.log(`Tampered hash:   ${bytesToHex(new Uint8Array(expectedHash))}`);
    console.log('(This should cause verification to FAIL)');
  }

  // Build payload: [32 bytes hash] + [preimage bytes]
  const payload = Buffer.concat([expectedHash, preimageBytes]);
  const payloadHex = bytesToHex(new Uint8Array(payload));

  console.log(`\nPayload size: ${payload.length} bytes (32 hash + ${preimageBytes.length} preimage)`);
  console.log(`Payload (hex): ${payloadHex}`);

  console.log('\n--- jamt command ---');
  console.log(`./polkajam-nightly/jamt item ${normalizedServiceId} ${payloadHex}`);

  if (opts.submit) {
    console.log('\n--- Submitting to network ---');
    try {
      await execJamt(['item', normalizedServiceId, payloadHex]);
      console.log('\nWork item submitted successfully!');
      console.log('The refine stage will verify the hash and return:');
      console.log('  - 0x01 + computed_hash if VALID');
      console.log('  - 0x00 + computed_hash if INVALID');
    } catch (err) {
      console.error('Submission failed:', err);
      process.exit(1);
    }
  } else {
    console.log('\n(Use --submit to actually send to the network)');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
