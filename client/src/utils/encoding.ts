/**
 * Encoding utilities for JAM client
 */

/**
 * Convert a string to hex encoding
 */
export function stringToHex(str: string): string {
  return '0x' + Buffer.from(str, 'utf8').toString('hex');
}

/**
 * Convert hex to string
 */
export function hexToString(hex: string): string {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(cleanHex, 'hex').toString('utf8');
}

/**
 * Convert hex to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex
 */
export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Ensure a value is hex-encoded
 * If it's already hex (starts with 0x), return as-is
 * Otherwise, encode as UTF-8 hex
 */
export function ensureHex(value: string): string {
  if (value.startsWith('0x')) {
    return value;
  }
  return stringToHex(value);
}

/**
 * Parse a service ID
 * JAM service IDs are hex strings (e.g., "0c7bb62b")
 * jamt expects them WITHOUT the 0x prefix
 */
export function parseServiceId(id: string): string {
  // Remove 0x prefix if present
  if (id.startsWith('0x')) {
    return id.slice(2);
  }
  // Return as-is (already a hex string without prefix)
  return id;
}
