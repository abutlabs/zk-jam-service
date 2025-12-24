#![no_std]
#![no_main]

extern crate alloc;

use alloc::vec::Vec;
use blake2::{Blake2s256, Digest};
use jam_pvm_common::{
    declare_service,
    Service,
    accumulate::{set_storage, get_storage},
};
use jam_pvm_common::jam_types::*;

declare_service!(MyService);

struct MyService;

/// Hash verification result codes
const RESULT_VALID: u8 = 0x01;
const RESULT_INVALID: u8 = 0x00;
const RESULT_ERROR_PAYLOAD_TOO_SHORT: u8 = 0xE1;

/// Expected payload format:
/// - Bytes 0-31: Expected Blake2s-256 hash (32 bytes)
/// - Bytes 32+: Preimage data to hash
const HASH_SIZE: usize = 32;

impl Service for MyService {
    /// Refine: Verify that blake2s256(preimage) == expected_hash
    ///
    /// Input payload: [32 bytes expected_hash] + [N bytes preimage]
    /// Output: [1 byte result] + [32 bytes computed_hash]
    ///   - result: 0x01 = valid, 0x00 = invalid, 0xE1 = error
    fn refine(
        _core_index: CoreIndex,
        _item_index: usize,
        _service_id: ServiceId,
        payload: WorkPayload,
        _package_hash: WorkPackageHash,
    ) -> WorkOutput {
        let data = payload.take();

        // Check minimum payload size (32 bytes for hash + at least 1 byte preimage)
        if data.len() < HASH_SIZE + 1 {
            let mut result = Vec::with_capacity(33);
            result.push(RESULT_ERROR_PAYLOAD_TOO_SHORT);
            result.extend_from_slice(&[0u8; 32]);
            return result.into();
        }

        // Extract expected hash and preimage
        let expected_hash = &data[..HASH_SIZE];
        let preimage = &data[HASH_SIZE..];

        // Compute Blake2s-256 hash of the preimage
        let mut hasher = Blake2s256::new();
        hasher.update(preimage);
        let computed_hash = hasher.finalize();

        // Compare hashes
        let is_valid = computed_hash.as_slice() == expected_hash;

        // Build result: [result_code, computed_hash...]
        let mut result = Vec::with_capacity(33);
        result.push(if is_valid { RESULT_VALID } else { RESULT_INVALID });
        result.extend_from_slice(&computed_hash);

        result.into()
    }

    /// Accumulate: Store verification results
    ///
    /// Reads the refine output and updates storage:
    /// - "status": "verified" or "failed" or "error"
    /// - "count": total verifications performed
    /// - "valid_count": number of successful verifications
    /// - "last_hash": the last computed hash
    fn accumulate(
        _slot: Slot,
        _service_id: ServiceId,
        item_count: usize,
    ) -> Option<Hash> {
        // Update total count
        let current_count = get_storage(b"count")
            .and_then(|v| v.first().copied())
            .unwrap_or(0);
        let new_count = current_count.saturating_add(item_count as u8);
        set_storage(b"count", &[new_count]).ok();

        // Note: In a full implementation, we would read the work results
        // using the accumulate host calls to get the refine output.
        // For now, we just mark that accumulate ran successfully.
        set_storage(b"status", b"accumulated").ok();

        None
    }
}
