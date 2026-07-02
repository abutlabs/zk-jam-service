#![no_std]
#![no_main]

extern crate alloc;

use alloc::vec::Vec;
use jam_pvm_common::jam_types::*;
use jam_pvm_common::{declare_service, Service};

// BN254 G1 scalar mults use deep stack frames (same reason the Groth16 spike needs it).
polkavm_derive::min_stack_size!(4 * 1024 * 1024);

declare_service!(Vdec);
struct Vdec;

// This spike measures the refine gas of verifiable committee decryption. The payload IS
// the batch builder's input: the committee key set + one ciphertext + one proven partial
// per member. refine verifies every Chaum-Pedersen proof and recovers the plaintext order
// WITHOUT any secret — exactly what an encrypt-until-batch round needs.
//
// Payload wire:
//   [n:u8]
//   [C1: 32]
//   [body_len:u8][body: body_len]
//   [committee_pks: n*32]         (the committed committee keys, in order)
//   [partials: n*96]              (S_i ‖ e ‖ z per member, same order)
//
// Output: [1 ‖ order] if every proof verifies and the plaintext is recovered, else [0].
impl Service for Vdec {
    fn refine(
        _core_index: CoreIndex,
        _item_index: usize,
        _service_id: ServiceId,
        payload: WorkPayload,
        _package_hash: WorkPackageHash,
    ) -> WorkOutput {
        let data = payload.take();
        match run(&data) {
            Some(order) => {
                let mut out = Vec::with_capacity(1 + order.len());
                out.push(1u8);
                out.extend_from_slice(&order);
                out.into()
            }
            None => alloc::vec![0u8].into(),
        }
    }

    fn accumulate(_slot: Slot, _service_id: ServiceId, _item_count: usize) -> Option<Hash> {
        None
    }
}

fn run(data: &[u8]) -> Option<Vec<u8>> {
    use vdec_core::{POINT_LEN, PARTIAL_LEN};
    if data.is_empty() {
        return None;
    }
    let n = data[0] as usize;
    if n == 0 {
        return None;
    }
    let mut off = 1;
    let c1 = data.get(off..off + POINT_LEN)?;
    off += POINT_LEN;
    let body_len = *data.get(off)? as usize;
    off += 1;
    let body = data.get(off..off + body_len)?;
    off += body_len;
    // committee keys
    let mut pks: Vec<[u8; POINT_LEN]> = Vec::with_capacity(n);
    for _ in 0..n {
        let p = data.get(off..off + POINT_LEN)?;
        let mut a = [0u8; POINT_LEN];
        a.copy_from_slice(p);
        pks.push(a);
        off += POINT_LEN;
    }
    let partials = data.get(off..off + n * PARTIAL_LEN)?;
    vdec_core::verify_and_decrypt(c1, body, &pks, partials)
}
