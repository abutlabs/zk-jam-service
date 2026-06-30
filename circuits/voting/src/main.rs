// Anonymous-voting circuit (Semaphore-lite) — host prove/verify roundtrip.
//
// Statement proven in zero knowledge:
//   "I know a secret s whose commitment leaf=H(s) is in the Merkle tree with the
//    public root R, and the public nullifier N = H(s, poll_id) is correctly
//    derived" — without revealing s or which leaf.
// Public inputs: [root, nullifier, poll_id, vote]; vote is constrained boolean.
// The nullifier makes a voter spend exactly once per poll; the Merkle membership
// hides WHICH eligible voter cast it.

use ark_bn254::{Bn254, Fr};
use ark_crypto_primitives::sponge::poseidon::{
    find_poseidon_ark_and_mds, PoseidonConfig, PoseidonSponge,
};
use ark_crypto_primitives::sponge::poseidon::constraints::PoseidonSpongeVar;
use ark_crypto_primitives::sponge::CryptographicSponge;
use ark_crypto_primitives::sponge::constraints::CryptographicSpongeVar;
use ark_ff::{One, Zero};
use ark_groth16::Groth16;
use ark_r1cs_std::{
    alloc::AllocVar, boolean::Boolean, eq::EqGadget, fields::fp::FpVar,
    fields::FieldVar,
};
use ark_relations::r1cs::{ConstraintSynthesizer, ConstraintSystemRef, SynthesisError};
use ark_snark::SNARK;
use ark_serialize::CanonicalSerialize;
use ark_std::rand::SeedableRng;

const DEPTH: usize = 4; // 16-leaf eligibility tree for the demo

// ---- Poseidon params (BN254, rate 2, width 3) -----------------------------
fn poseidon_config() -> PoseidonConfig<Fr> {
    let full_rounds = 8u64;
    let partial_rounds = 57u64;
    let alpha = 5u64;
    let rate = 2usize;
    let capacity = 1usize;
    let (ark, mds) =
        find_poseidon_ark_and_mds::<Fr>(254, rate, full_rounds, partial_rounds, 0);
    PoseidonConfig::new(
        full_rounds as usize,
        partial_rounds as usize,
        alpha,
        mds,
        ark,
        rate,
        capacity,
    )
}

fn hash_native(cfg: &PoseidonConfig<Fr>, inputs: &[Fr]) -> Fr {
    let mut s = PoseidonSponge::new(cfg);
    s.absorb(&inputs.to_vec());
    s.squeeze_field_elements(1)[0]
}

fn hash_gadget(
    cfg: &PoseidonConfig<Fr>,
    cs: ConstraintSystemRef<Fr>,
    inputs: &[FpVar<Fr>],
) -> Result<FpVar<Fr>, SynthesisError> {
    let mut s = PoseidonSpongeVar::new(cs, cfg);
    s.absorb(&inputs.to_vec())?;
    Ok(s.squeeze_field_elements(1)?[0].clone())
}

// ---- circuit --------------------------------------------------------------
#[derive(Clone)]
struct VoteCircuit {
    cfg: PoseidonConfig<Fr>,
    // public
    root: Fr,
    nullifier: Fr,
    poll_id: Fr,
    vote: Fr,
    // private
    secret: Fr,
    siblings: [Fr; DEPTH],
    path_bits: [bool; DEPTH], // true = current node is the RIGHT child
}

impl ConstraintSynthesizer<Fr> for VoteCircuit {
    fn generate_constraints(self, cs: ConstraintSystemRef<Fr>) -> Result<(), SynthesisError> {
        let root_v = FpVar::new_input(cs.clone(), || Ok(self.root))?;
        let null_v = FpVar::new_input(cs.clone(), || Ok(self.nullifier))?;
        let poll_v = FpVar::new_input(cs.clone(), || Ok(self.poll_id))?;
        let vote_v = FpVar::new_input(cs.clone(), || Ok(self.vote))?;

        let secret_v = FpVar::new_witness(cs.clone(), || Ok(self.secret))?;

        // leaf = H(secret)
        let mut cur = hash_gadget(&self.cfg, cs.clone(), &[secret_v.clone()])?;

        // walk up to the root
        for i in 0..DEPTH {
            let sib = FpVar::new_witness(cs.clone(), || Ok(self.siblings[i]))?;
            let bit = Boolean::new_witness(cs.clone(), || Ok(self.path_bits[i]))?;
            // bit=true => current is right child => (left,right)=(sib,cur)
            let left = bit.select(&sib, &cur)?;
            let right = bit.select(&cur, &sib)?;
            cur = hash_gadget(&self.cfg, cs.clone(), &[left, right])?;
        }
        cur.enforce_equal(&root_v)?;

        // nullifier = H(secret, poll_id)
        let null_calc = hash_gadget(&self.cfg, cs.clone(), &[secret_v, poll_v])?;
        null_calc.enforce_equal(&null_v)?;

        // vote ∈ {0,1}
        let one = FpVar::one();
        (&vote_v * (&vote_v - &one)).enforce_equal(&FpVar::zero())?;

        Ok(())
    }
}

// ---- host driver: build a tree, prove a membership vote, verify ------------
fn merkle_root_and_path(
    cfg: &PoseidonConfig<Fr>,
    leaves: &[Fr],
    index: usize,
) -> (Fr, [Fr; DEPTH], [bool; DEPTH]) {
    let mut level: Vec<Fr> = leaves.to_vec();
    let mut siblings = [Fr::zero(); DEPTH];
    let mut bits = [false; DEPTH];
    let mut idx = index;
    for d in 0..DEPTH {
        let sib_idx = idx ^ 1;
        siblings[d] = level[sib_idx];
        bits[d] = (idx & 1) == 1; // current node is right child if idx odd
        let mut next = Vec::with_capacity(level.len() / 2);
        for pair in level.chunks(2) {
            next.push(hash_native(cfg, &[pair[0], pair[1]]));
        }
        level = next;
        idx /= 2;
    }
    (level[0], siblings, bits)
}

fn main() {
    let cfg = poseidon_config();
    let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(7);

    // eligibility set: 16 members, each commitment = H(secret_i)
    let n = 1usize << DEPTH;
    let secrets: Vec<Fr> = (0..n).map(|i| Fr::from((1000 + i) as u64)).collect();
    let leaves: Vec<Fr> = secrets.iter().map(|s| hash_native(&cfg, &[*s])).collect();

    // member 5 casts a "yes" vote in poll 42
    let voter = 5usize;
    let poll_id = Fr::from(42u64);
    let vote = Fr::one();
    let (root, siblings, path_bits) = merkle_root_and_path(&cfg, &leaves, voter);
    let nullifier = hash_native(&cfg, &[secrets[voter], poll_id]);

    let circuit = VoteCircuit {
        cfg: cfg.clone(),
        root,
        nullifier,
        poll_id,
        vote,
        secret: secrets[voter],
        siblings,
        path_bits,
    };

    let (pk, vk) =
        Groth16::<Bn254>::circuit_specific_setup(circuit.clone(), &mut rng).unwrap();
    let proof = Groth16::<Bn254>::prove(&pk, circuit, &mut rng).unwrap();

    let public = vec![root, nullifier, poll_id, vote];
    let ok = Groth16::<Bn254>::verify(&vk, &public, &proof).unwrap();
    println!("anonymous vote proof verifies: {ok}");
    assert!(ok);

    // a tampered nullifier (double-vote attempt with a different N) must fail
    let bad = Groth16::<Bn254>::verify(
        &vk,
        &vec![root, nullifier + Fr::one(), poll_id, vote],
        &proof,
    )
    .unwrap();
    println!("tampered-nullifier proof verifies: {bad} (must be false)");
    assert!(!bad);

    // ---- emit artifacts for the no_std service --------------------------------
    // The service embeds {vk, root, poll_id} (one poll per deployment) and a voter
    // submits payload = proof(compressed) ++ nullifier(32) ++ vote(1). Fixed-seed
    // setup => reproducible demo (NOT a real trusted setup).
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("artifacts");
    std::fs::create_dir_all(&dir).unwrap();
    let ser = |x: &dyn Fn(&mut Vec<u8>)| { let mut b = Vec::new(); x(&mut b); b };
    let vk_b = ser(&|b| vk.serialize_compressed(&mut *b).unwrap());
    let root_b = ser(&|b| root.serialize_compressed(&mut *b).unwrap());
    let poll_b = ser(&|b| poll_id.serialize_compressed(&mut *b).unwrap());
    std::fs::write(dir.join("vk.bin"), &vk_b).unwrap();
    std::fs::write(dir.join("root.bin"), &root_b).unwrap();
    std::fs::write(dir.join("poll_id.bin"), &poll_b).unwrap();

    let mut submission = Vec::new();
    proof.serialize_compressed(&mut submission).unwrap();
    let null_b = ser(&|b| nullifier.serialize_compressed(&mut *b).unwrap());
    submission.extend_from_slice(&null_b);
    submission.push(1u8); // vote = yes
    std::fs::write(dir.join("submission.bin"), &submission).unwrap();

    println!(
        "artifacts: vk={}B root={}B poll_id={}B submission={}B -> artifacts/",
        vk_b.len(), root_b.len(), poll_b.len(), submission.len()
    );
    println!("OK depth={DEPTH} leaves={n}");
}
