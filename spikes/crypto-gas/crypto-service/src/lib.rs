#![no_std]
#![no_main]

extern crate alloc;

use alloc::vec::Vec;
use jam_pvm_common::jam_types::*;
use jam_pvm_common::{declare_service, Service};

use blake2::{Blake2s256, Digest};
use ed25519_compact::{KeyPair, Seed};

// ed25519 field arithmetic overflows polkavm's default guest stack (same reason
// jamswap sets 1 MiB). Give it room so a verify never traps mid-op.
polkavm_derive::min_stack_size!(1024 * 1024);

declare_service!(Bench);
struct Bench;

// Payload = [op:u8][count:u32 LE].
//   op 0 -> run `count` ed25519 verifies of one fixed (pk,msg,sig)
//   op 1 -> run `count` Blake2s256 hashes of one fixed 64-byte message
// The keygen + sign (op 0) happen ONCE, outside the loop, so diffing refine_gas
// across two counts isolates the PURE per-op cost with all fixed setup cancelled.
impl Service for Bench {
    fn refine(
        _core_index: CoreIndex,
        _item_index: usize,
        _service_id: ServiceId,
        payload: WorkPayload,
        _package_hash: WorkPackageHash,
    ) -> WorkOutput {
        let data = payload.take();
        if data.len() < 5 {
            return Vec::new().into();
        }
        let op = data[0];
        let count = u32::from_le_bytes([data[1], data[2], data[3], data[4]]);

        // Fixed 64-byte message, deterministic — same bytes every run.
        let msg: [u8; 64] = {
            let mut m = [0u8; 64];
            let mut i = 0;
            while i < 64 {
                m[i] = i as u8;
                i += 1;
            }
            m
        };

        // acc prevents the optimizer from eliding the loop body (results feed output).
        let mut acc: u8 = 0;

        match op {
            0 => {
                // one keygen + one sign, OUTSIDE the measured loop
                let kp = KeyPair::from_seed(Seed::new([7u8; 32]));
                let sig = kp.sk.sign(&msg, None);
                let pk = kp.pk;
                for _ in 0..count {
                    // verify() curve-checks the signature — the realistic cost.
                    // acc=1 iff EVERY verify returned Ok, so a fast-fail path
                    // (which would falsify the gas measurement) is detectable.
                    let ok = pk.verify(&msg, &sig).is_ok();
                    acc = acc.wrapping_add(ok as u8);
                }
            }
            1 => {
                for _ in 0..count {
                    let mut h = Blake2s256::new();
                    h.update(&msg);
                    let out = h.finalize();
                    acc ^= out[0];
                }
            }
            _ => return Vec::new().into(),
        }

        let mut out = Vec::with_capacity(1);
        out.push(acc);
        out.into()
    }

    fn accumulate(_slot: Slot, _service_id: ServiceId, _item_count: usize) -> Option<Hash> {
        None
    }
}
