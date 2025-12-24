/**
 * Local verification history store
 * Tracks all submissions from this UI for display and learning purposes
 */

export interface VerificationRecord {
  id: string;
  timestamp: number;
  preimage: string;
  hash: string;
  payload: string;
  tampered: boolean;
  packageId?: string;
  anchorSlot?: number;
  status: 'pending' | 'submitted' | 'refining' | 'auditing' | 'accumulated' | 'failed';
  result?: 'valid' | 'invalid' | 'error';
  error?: string;
  // Decoded payload breakdown for education
  payloadBreakdown: {
    expectedHash: string;
    preimageHex: string;
    preimageUtf8: string;
  };
}

const STORAGE_KEY = 'jam-verification-history';
const MAX_RECORDS = 50;

/**
 * Get all verification records from localStorage
 */
export function getHistory(): VerificationRecord[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as VerificationRecord[];
  } catch {
    return [];
  }
}

/**
 * Add a new verification record
 */
export function addRecord(record: Omit<VerificationRecord, 'id' | 'timestamp'>): VerificationRecord {
  const newRecord: VerificationRecord = {
    ...record,
    id: generateId(),
    timestamp: Date.now(),
  };

  const history = getHistory();
  history.unshift(newRecord);

  // Keep only the most recent records
  const trimmed = history.slice(0, MAX_RECORDS);

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }

  return newRecord;
}

/**
 * Update an existing record by ID
 */
export function updateRecord(id: string, updates: Partial<VerificationRecord>): VerificationRecord | null {
  const history = getHistory();
  const index = history.findIndex(r => r.id === id);

  if (index === -1) return null;

  history[index] = { ...history[index], ...updates };

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  return history[index];
}

/**
 * Get a single record by ID
 */
export function getRecord(id: string): VerificationRecord | null {
  const history = getHistory();
  return history.find(r => r.id === id) ?? null;
}

/**
 * Clear all history
 */
export function clearHistory(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Get records that match a specific slot
 */
export function getRecordsBySlot(slot: number): VerificationRecord[] {
  return getHistory().filter(r => r.anchorSlot === slot);
}

/**
 * Get summary statistics
 */
export function getStats(): {
  total: number;
  valid: number;
  invalid: number;
  pending: number;
  failed: number;
} {
  const history = getHistory();
  return {
    total: history.length,
    valid: history.filter(r => r.result === 'valid').length,
    invalid: history.filter(r => r.result === 'invalid').length,
    pending: history.filter(r => r.status === 'pending' || r.status === 'submitted' || r.status === 'refining' || r.status === 'auditing').length,
    failed: history.filter(r => r.status === 'failed').length,
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Parse a payload hex string into its components for educational display
 */
export function parsePayload(payloadHex: string): {
  expectedHash: string;
  preimageHex: string;
  preimageUtf8: string;
} {
  // Remove 0x prefix
  const hex = payloadHex.startsWith('0x') ? payloadHex.slice(2) : payloadHex;

  // First 32 bytes (64 hex chars) is the expected hash
  const expectedHash = '0x' + hex.slice(0, 64);

  // Rest is the preimage
  const preimageHex = '0x' + hex.slice(64);

  // Try to decode preimage as UTF-8
  let preimageUtf8 = '';
  try {
    const bytes = Buffer.from(hex.slice(64), 'hex');
    preimageUtf8 = bytes.toString('utf8');
  } catch {
    preimageUtf8 = '[binary data]';
  }

  return { expectedHash, preimageHex, preimageUtf8 };
}
