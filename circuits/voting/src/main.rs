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

type Pk = ark_groth16::ProvingKey<Bn254>;

fn build_eligibility(cfg: &PoseidonConfig<Fr>, n: usize) -> (Vec<Fr>, Vec<Fr>) {
    let secrets: Vec<Fr> = (0..n).map(|i| Fr::from((1000 + i) as u64)).collect();
    let leaves: Vec<Fr> = secrets.iter().map(|s| hash_native(cfg, &[*s])).collect();
    (secrets, leaves)
}

// Deterministic setup (seed 7) — pk/vk match the embedded vk so any member's proof
// verifies against the deployed service. Structure-only; witness values don't matter.
fn setup(cfg: &PoseidonConfig<Fr>, leaves: &[Fr], secrets: &[Fr], poll_id: Fr) -> Pk {
    let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(7);
    let (root, siblings, path_bits) = merkle_root_and_path(cfg, leaves, 0);
    let nullifier = hash_native(cfg, &[secrets[0], poll_id]);
    let c = VoteCircuit {
        cfg: cfg.clone(), root, nullifier, poll_id, vote: Fr::one(),
        secret: secrets[0], siblings, path_bits,
    };
    Groth16::<Bn254>::circuit_specific_setup(c, &mut rng).unwrap().0
}

// A real ballot: proof ++ nullifier(32) ++ vote(1), hex. Fresh proof randomness
// per call (proper ZK). The nullifier is deterministic per (voter, poll).
fn make_submission(
    cfg: &PoseidonConfig<Fr>, pk: &Pk, leaves: &[Fr], secrets: &[Fr],
    poll_id: Fr, voter: usize, vote_byte: u8,
) -> String {
    // fresh-ish proof randomness per call (demo; a real deployment needs a CSPRNG)
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0)
        ^ ((voter as u64) << 8)
        ^ (vote_byte as u64);
    let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(seed);
    let (root, siblings, path_bits) = merkle_root_and_path(cfg, leaves, voter);
    let nullifier = hash_native(cfg, &[secrets[voter], poll_id]);
    let c = VoteCircuit {
        cfg: cfg.clone(), root, nullifier, poll_id, vote: Fr::from(vote_byte as u64),
        secret: secrets[voter], siblings, path_bits,
    };
    let proof = Groth16::<Bn254>::prove(pk, c, &mut rng).unwrap();
    let mut sub = Vec::new();
    proof.serialize_compressed(&mut sub).unwrap();
    let mut nb = Vec::new();
    nullifier.serialize_compressed(&mut nb).unwrap();
    sub.extend_from_slice(&nb);
    sub.push(vote_byte);
    sub.iter().map(|b| format!("{:02x}", b)).collect()
}

// ---- prover sidecar: a tiny HTTP server the web calls per ballot -----------
fn query_param(path: &str, key: &str) -> Option<String> {
    let q = path.split('?').nth(1)?;
    q.split('&').find_map(|kv| {
        let mut it = kv.splitn(2, '=');
        if it.next()? == key { Some(it.next()?.to_string()) } else { None }
    })
}

fn serve(addr: &str, cfg: &PoseidonConfig<Fr>, leaves: &[Fr], secrets: &[Fr], poll_id: Fr, n: usize) {
    use std::io::{BufRead, BufReader, Write};
    let pk = setup(cfg, leaves, secrets, poll_id);
    eprintln!("voting-prover: setup done; {n} eligible members; listening on {addr}");
    let listener = std::net::TcpListener::bind(addr).expect("bind");
    for stream in listener.incoming() {
        let mut stream = match stream { Ok(s) => s, Err(_) => continue };
        let mut line = String::new();
        if BufReader::new(&mut stream).read_line(&mut line).is_err() { continue; }
        let path = line.split_whitespace().nth(1).unwrap_or("/");
        let (status, body): (&str, String) = if path.starts_with("/healthz") {
            ("200 OK", "{\"status\":\"ok\"}".into())
        } else if path.starts_with("/members") {
            ("200 OK", format!("{{\"count\":{n}}}"))
        } else if path.starts_with("/prove") {
            match (query_param(path, "voter").and_then(|s| s.parse::<usize>().ok()),
                   query_param(path, "vote").and_then(|s| s.parse::<u8>().ok())) {
                (Some(v), Some(b)) if v < n && b <= 1 => {
                    let hex = make_submission(cfg, &pk, leaves, secrets, poll_id, v, b);
                    ("200 OK", format!("{{\"submission_hex\":\"{hex}\"}}"))
                }
                _ => ("400 Bad Request", "{\"error\":\"voter 0..n-1, vote 0|1\"}".into()),
            }
        } else {
            ("404 Not Found", "{\"error\":\"no route\"}".into())
        };
        let resp = format!(
            "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        let _ = stream.write_all(resp.as_bytes());
    }
}

fn main() {
    let cfg = poseidon_config();
    let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(7);

    // eligibility set: 16 members, each commitment = H(secret_i)
    let n = 1usize << DEPTH;
    let (secrets, leaves) = build_eligibility(&cfg, n);
    let poll_id = Fr::from(42u64);
    let argv: Vec<String> = std::env::args().collect();

    // `serve <addr>`: run the prover sidecar (HTTP) — what the web calls per ballot.
    if argv.len() >= 2 && argv[1] == "serve" {
        let addr = argv.get(2).map(String::as_str).unwrap_or("0.0.0.0:9090");
        serve(addr, &cfg, &leaves, &secrets, poll_id, n);
        return;
    }
    // `prove <voter 0..N-1> <vote 0|1>`: emit one real submission hex.
    if argv.len() >= 2 && argv[1] == "prove" {
        let voter: usize = argv.get(2).and_then(|s| s.parse().ok())
            .expect("usage: prove <voter 0..15> <vote 0|1>");
        let vote_byte: u8 = argv.get(3).and_then(|s| s.parse().ok()).filter(|v| *v <= 1)
            .expect("usage: prove <voter 0..15> <vote 0|1>");
        assert!(voter < n, "voter index out of range");
        let pk = setup(&cfg, &leaves, &secrets, poll_id);
        println!("{}", make_submission(&cfg, &pk, &leaves, &secrets, poll_id, voter, vote_byte));
        return;
    }

    // default mode: member 5 casts a "yes" vote in poll 42 (roundtrip + artifacts)
    let voter = 5usize;
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
