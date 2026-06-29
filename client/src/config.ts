/**
 * Configuration for JAM service client
 */

export type BackendName = 'polkajam' | 'lasair';

export const config = {
  // Which JAM node to talk to: 'polkajam' (bundled jamt CLI, default) or
  // 'lasair' (HTTP operator RPC). Set JAM_BACKEND to switch.
  backend: (process.env.JAM_BACKEND ?? 'polkajam') as BackendName,

  // WebSocket RPC endpoint (polkajam-testnet node0)
  rpcUrl: process.env.JAM_RPC ?? 'ws://localhost:19800',

  // Lasair node operator RPC (HTTP). Used when backend === 'lasair'.
  lasairRpc: process.env.LASAIR_RPC ?? 'http://localhost:19900',

  // Service ID (set after deployment). PolkaJam: hex id from create-service;
  // Lasair: decimal id from POST /v1/service. Override with JAM_SERVICE_ID.
  serviceId: process.env.JAM_SERVICE_ID ?? '',

  // Request timeout in milliseconds
  requestTimeout: 30000,
};

/**
 * Validates that required configuration is present
 */
export function validateConfig(): void {
  if (!config.serviceId) {
    console.error('Error: Service ID not configured.');
    console.error('Set JAM_SERVICE_ID environment variable or update config.ts');
    console.error('Example: JAM_SERVICE_ID=0c7bb62b npm run submit -- --payload "hello"');
    process.exit(1);
  }
}

/**
 * Storage keys used by the service (as hex)
 */
export const storageKeys = {
  status: '0x737461747573',           // "status"
  verificationCount: '0x766572696669636174696f6e5f636f756e74', // "verification_count"
  lastResult: '0x6c6173745f726573756c74', // "last_result"
};
