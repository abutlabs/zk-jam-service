#![no_std]
#![no_main]

extern crate alloc;

use alloc::vec::Vec;
use jam_pvm_common::{declare_service, Service};
use jam_pvm_common::jam_types::*;

use ark_bn254::{Bn254, Fr};
use ark_groth16::{Groth16, Proof, VerifyingKey};
use ark_serialize::CanonicalDeserialize;
use ark_snark::SNARK;

// BN254 pairing (Miller loop + final exponentiation over Fq12) uses deep stack
// frames; the polkavm default stack is too small and overflows mid-verify. Give
// the guest a generous stack.
polkavm_derive::min_stack_size!(4 * 1024 * 1024);

declare_service!(Spike);
struct Spike;

// Real Groth16/BN254 artifacts generated off-chain (gen-proof): a proof that
// a*b=c for the public input c=12. The whole point of the spike is to measure
// the refine_gas this verify consumes inside lasair's PVM.
const VK_BYTES: &[u8] = include_bytes!("../vk.bin");
const PROOF_BYTES: &[u8] = include_bytes!("../proof.bin");
const PUBLIC_BYTES: &[u8] = include_bytes!("../public.bin");

impl Service for Spike {
    fn refine(
        _core_index: CoreIndex,
        _item_index: usize,
        _service_id: ServiceId,
        _payload: WorkPayload,
        _package_hash: WorkPackageHash,
    ) -> WorkOutput {
        // VK is trusted (embedded by us) -> unchecked is fine. The PROOF is the
        // untrusted user input -> CHECKED deserialize (subgroup membership) so a
        // forged off-curve point can't slip through. This is the realistic cost.
        let vk = VerifyingKey::<Bn254>::deserialize_compressed_unchecked(VK_BYTES).unwrap();
        let proof = Proof::<Bn254>::deserialize_compressed(PROOF_BYTES).unwrap();
        let public = Fr::deserialize_compressed(PUBLIC_BYTES).unwrap();

        let ok = Groth16::<Bn254>::verify(&vk, &[public], &proof).unwrap_or(false);

        let mut out = Vec::with_capacity(1);
        out.push(if ok { 1u8 } else { 0u8 });
        out.into()
    }

    fn accumulate(_slot: Slot, _service_id: ServiceId, _item_count: usize) -> Option<Hash> {
        None
    }
}
