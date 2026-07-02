#![no_std]
#![no_main]

extern crate alloc;

use alloc::vec;
use alloc::vec::Vec;

use jam_pvm_common::accumulate::{accumulate_items, get_storage, set_storage};
use jam_pvm_common::jam_types::*;
use jam_pvm_common::{declare_service, Service};

use ark_bn254::{Bn254, Fr};
use ark_groth16::{Groth16, Proof, VerifyingKey};
use ark_serialize::CanonicalDeserialize;
use ark_snark::SNARK;

// BN254 pairing needs a bigger stack than polkavm's default (see spikes/groth16-gas).
polkavm_derive::min_stack_size!(4 * 1024 * 1024);

declare_service!(Fba);
struct Fba;

// The verifying key for the FBA-clearing circuit (one circuit per deployment).
const VK_BYTES: &[u8] = include_bytes!("../vk.bin");

const PROOF_LEN: usize = 128; // compressed Groth16/BN254 proof
const FR_LEN: usize = 32; // compressed BN254 scalar
// payload = proof(128) ++ orders_commitment(32) ++ price(32) ++ volume(32) ++ fills_commitment(32)
const IN_LEN: usize = PROOF_LEN + 4 * FR_LEN;
// output = [valid] ++ price(32) ++ volume(32) ++ orders_commitment(32) ++ fills_commitment(32)
const OUT_LEN: usize = 1 + 4 * FR_LEN;

fn invalid() -> WorkOutput {
    vec![0u8].into()
}
fn le_u64(b: &[u8]) -> u64 {
    let mut x = [0u8; 8];
    let n = core::cmp::min(8, b.len());
    x[..n].copy_from_slice(&b[..n]);
    u64::from_le_bytes(x)
}

impl Service for Fba {
    /// refine: verify ONE Groth16 proof that a whole batch cleared validly, then emit the
    /// constant-size settlement (price, volume, and the order/fill commitments). This is the
    /// zk-rollup matcher: refine cost is independent of the order count — a batch of 4 or 4000
    /// is the same ~56M-gas verify — and the individual orders never appear on-chain.
    fn refine(
        _core_index: CoreIndex,
        _item_index: usize,
        _service_id: ServiceId,
        payload: WorkPayload,
        _package_hash: WorkPackageHash,
    ) -> WorkOutput {
        let data = payload.take();
        if data.len() < IN_LEN {
            return invalid();
        }
        let proof = match Proof::<Bn254>::deserialize_compressed(&data[..PROOF_LEN]) {
            Ok(p) => p,
            Err(_) => return invalid(),
        };
        // the four public inputs, in the circuit's order: [oc, price, volume, fc]
        let mut publics = Vec::with_capacity(4);
        for i in 0..4 {
            let off = PROOF_LEN + i * FR_LEN;
            match Fr::deserialize_compressed(&data[off..off + FR_LEN]) {
                Ok(f) => publics.push(f),
                Err(_) => return invalid(),
            }
        }
        let vk = VerifyingKey::<Bn254>::deserialize_compressed_unchecked(VK_BYTES).unwrap();
        let ok = Groth16::<Bn254>::verify(&vk, &publics, &proof).unwrap_or(false);
        if !ok {
            return invalid();
        }
        // echo the proven public inputs (price, volume, oc, fc) for accumulate to record
        let mut out = Vec::with_capacity(OUT_LEN);
        out.push(1u8);
        out.extend_from_slice(&data[PROOF_LEN + FR_LEN..PROOF_LEN + 2 * FR_LEN]); // price
        out.extend_from_slice(&data[PROOF_LEN + 2 * FR_LEN..PROOF_LEN + 3 * FR_LEN]); // volume
        out.extend_from_slice(&data[PROOF_LEN..PROOF_LEN + FR_LEN]); // orders_commitment
        out.extend_from_slice(&data[PROOF_LEN + 3 * FR_LEN..PROOF_LEN + 4 * FR_LEN]); // fills_commitment
        out.into()
    }

    /// accumulate: record the verified batch's settlement on-chain (O(1) per batch — the whole
    /// point of the zk-rollup shape). Prices/volumes are little-endian-lo of the BN254 scalar
    /// (values are small). Only a proof-verified batch reaches here.
    fn accumulate(_slot: Slot, _service_id: ServiceId, _item_count: usize) -> Option<Hash> {
        for item in accumulate_items() {
            let rec = match item {
                AccumulateItem::WorkItem(r) => r,
                _ => continue,
            };
            let out = match rec.result {
                Ok(o) => o.0,
                Err(_) => continue,
            };
            if out.len() < OUT_LEN || out[0] != 1u8 {
                continue;
            }
            let price = le_u64(&out[1..1 + 8]);
            let volume = le_u64(&out[1 + FR_LEN..1 + FR_LEN + 8]);
            let oc = &out[1 + 2 * FR_LEN..1 + 3 * FR_LEN];
            set_storage(b"last_price", &price.to_le_bytes()).ok();
            set_storage(b"last_volume", &volume.to_le_bytes()).ok();
            let cum = get_storage(b"cum_volume").map(|v| le_u64(&v)).unwrap_or(0);
            set_storage(b"cum_volume", &(cum + volume).to_le_bytes()).ok();
            let rounds = get_storage(b"rounds").map(|v| le_u64(&v)).unwrap_or(0);
            set_storage(b"rounds", &(rounds + 1).to_le_bytes()).ok();
            set_storage(b"last_batch", oc).ok(); // commitment to the batch's hidden orders
        }
        None
    }
}
