/**
 * WebSocket JSON-RPC client for JAM
 */

import WebSocket from 'ws';
import { config } from '../config.js';

interface RpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown[];
}

interface RpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

/**
 * JAM RPC Client
 *
 * Connects to a PolkaJam node via WebSocket and provides
 * methods for interacting with JAM services.
 */
export class JamRpcClient {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private connected = false;
  private connectPromise: Promise<void> | null = null;

  constructor(private rpcUrl: string = config.rpcUrl) {}

  /**
   * Connect to the RPC endpoint
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.rpcUrl);

      this.ws.on('open', () => {
        this.connected = true;
        this.connectPromise = null;
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (err) => {
        this.connectPromise = null;
        reject(err);
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.ws = null;
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Connection closed'));
          this.pendingRequests.delete(id);
        }
      });
    });

    return this.connectPromise;
  }

  /**
   * Disconnect from the RPC endpoint
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  /**
   * Send an RPC request and wait for response
   */
  async request<T = unknown>(method: string, params?: unknown[]): Promise<T> {
    await this.connect();

    if (!this.ws) {
      throw new Error('Not connected');
    }

    const id = ++this.requestId;
    const request: RpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, config.requestTimeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      this.ws!.send(JSON.stringify(request));
    });
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const response: RpcResponse = JSON.parse(data.toString());
      const pending = this.pendingRequests.get(response.id);

      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id);

        if (response.error) {
          pending.reject(new Error(`RPC Error: ${response.error.message}`));
        } else {
          pending.resolve(response.result);
        }
      }
    } catch (err) {
      console.error('Failed to parse RPC response:', err);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton instance
let clientInstance: JamRpcClient | null = null;

/**
 * Get the shared RPC client instance
 */
export function getRpcClient(): JamRpcClient {
  if (!clientInstance) {
    clientInstance = new JamRpcClient();
  }
  return clientInstance;
}
