// Host-side proof generator for the JAM gas spike.
// Builds a trivial circuit (a * b = c, c public), runs Groth16 setup + prove on
// BN254, and writes compressed VK / proof / public-input bytes to artifacts/.
// The no_std JAM service then deserializes these and verifies — and we read the
// real refine_gas the verify consumes.

use ark_bn254::{Bn254, Fr};
use ark_groth16::Groth16;
use ark_relations::r1cs::{ConstraintSynthesizer, ConstraintSystemRef, SynthesisError};
use ark_serialize::CanonicalSerialize;
use ark_snark::SNARK;
use ark_std::rand::SeedableRng;

#[derive(Clone)]
struct MulCircuit {
    a: Option<Fr>,
    b: Option<Fr>,
    c: Option<Fr>,
}

impl ConstraintSynthesizer<Fr> for MulCircuit {
    fn generate_constraints(self, cs: ConstraintSystemRef<Fr>) -> Result<(), SynthesisError> {
        use ark_relations::lc;
        let a = cs.new_witness_variable(|| self.a.ok_or(SynthesisError::AssignmentMissing))?;
        let b = cs.new_witness_variable(|| self.b.ok_or(SynthesisError::AssignmentMissing))?;
        let c = cs.new_input_variable(|| self.c.ok_or(SynthesisError::AssignmentMissing))?;
        cs.enforce_constraint(lc!() + a, lc!() + b, lc!() + c)?;
        Ok(())
    }
}

fn main() {
    let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(42);

    let a = Fr::from(3u64);
    let b = Fr::from(4u64);
    let c = Fr::from(12u64); // public input

    let setup_circuit = MulCircuit { a: None, b: None, c: None };
    let (pk, vk) =
        Groth16::<Bn254>::circuit_specific_setup(setup_circuit, &mut rng).unwrap();

    let prove_circuit = MulCircuit { a: Some(a), b: Some(b), c: Some(c) };
    let proof = Groth16::<Bn254>::prove(&pk, prove_circuit, &mut rng).unwrap();

    // sanity-check on the host
    let ok = Groth16::<Bn254>::verify(&vk, &[c], &proof).unwrap();
    assert!(ok, "host verify failed");

    // write compressed artifacts
    let mut vk_bytes = Vec::new();
    vk.serialize_compressed(&mut vk_bytes).unwrap();
    let mut proof_bytes = Vec::new();
    proof.serialize_compressed(&mut proof_bytes).unwrap();
    let mut pub_bytes = Vec::new();
    c.serialize_compressed(&mut pub_bytes).unwrap();

    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("artifacts");
    std::fs::write(dir.join("vk.bin"), &vk_bytes).unwrap();
    std::fs::write(dir.join("proof.bin"), &proof_bytes).unwrap();
    std::fs::write(dir.join("public.bin"), &pub_bytes).unwrap();

    println!(
        "OK host-verify=true  vk={}B proof={}B public={}B  -> artifacts/",
        vk_bytes.len(),
        proof_bytes.len(),
        pub_bytes.len()
    );
}
