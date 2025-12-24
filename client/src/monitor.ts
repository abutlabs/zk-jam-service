#!/usr/bin/env node
/**
 * Monitor JAM network and service activity
 *
 * Usage:
 *   npm run monitor
 *   JAM_SERVICE_ID=0c7bb62b npm run monitor
 */

import { program } from 'commander';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { config } from './config.js';
import { getRpcClient } from './utils/rpc.js';

interface MonitorOptions {
  serviceId?: string;
  interval?: string;
}

/**
 * Query the current slot from the network
 */
async function getCurrentSlot(): Promise<string | null> {
  const jamtPath = path.resolve(
    import.meta.dirname,
    '../../polkajam-nightly/jamt'
  );

  return new Promise((resolve) => {
    const proc = spawn(jamtPath, ['inspect', 'best', 'slot'], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        resolve(null);
      }
    });

    proc.on('error', () => {
      resolve(null);
    });
  });
}

async function monitorNetwork(intervalMs: number): Promise<void> {
  console.log('Monitoring JAM network...');
  console.log(`RPC: ${config.rpcUrl}`);
  console.log(`Interval: ${intervalMs}ms`);
  console.log('Press Ctrl+C to stop\n');

  let lastSlot: string | null = null;

  const poll = async () => {
    const slot = await getCurrentSlot();

    if (slot && slot !== lastSlot) {
      const timestamp = new Date().toISOString().slice(11, 19);
      console.log(`[${timestamp}] Slot: ${slot}`);
      lastSlot = slot;
    }
  };

  // Initial poll
  await poll();

  // Set up interval
  const interval = setInterval(poll, intervalMs);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nStopping monitor...');
    clearInterval(interval);
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

async function main(): Promise<void> {
  program
    .name('monitor')
    .description('Monitor JAM network activity')
    .option('-s, --service-id <id>', 'Service ID to monitor')
    .option('-i, --interval <ms>', 'Polling interval in milliseconds', '2000')
    .parse();

  const opts = program.opts<MonitorOptions>();
  const interval = parseInt(opts.interval ?? '2000', 10);

  await monitorNetwork(interval);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
