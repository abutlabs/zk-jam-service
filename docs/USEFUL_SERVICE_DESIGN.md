# Making zk-jam-service genuinely useful — design decision

> Status: **decision made** (Aiden, 2026-06-30, "master of the domain"). Grounded
> in a host-ABI + gas feasibility study. Implementation gated on one de-risking
> spike (see §5). Nothing here is built yet; the current hash-verify service is
> untouched until this is ready.

## 1. The problem with what we have

Today the service hashes a string in `refine()` and checks the hash matches in
`accumulate()` (which doesn't even read the verdict — it just bumps a `u8`
counter). The fatal flaw is **the verifier already holds the preimage**, so
"prove this text hashes to this value" demonstrates nothing a local `sha256` on
your laptop doesn't. It's a wiring demo, not a use case. To WOW, the service must
verify something the chain *cannot already see* and *could not compute itself*.

## 2. What JAM uniquely unlocks (and what we're actually allowed to do)

Two hard facts from the feasibility study (`docs/FEASIBILITY.md`):

1. **No crypto host calls.** The JAM guest ABI (lasair `lib/pvm_host.ml`, 27 host
   calls) exposes *zero* cryptographic primitives — no hash, signature, or
   pairing host function. Every primitive must be compiled into the `.jam` blob
   as pure `no_std` Rust and paid for in gas.
2. **A ~500× compute asymmetry.** `refine()` gets G_R ≈ **5,000,000,000** gas
   (full spec) in a ~6 s slot; `accumulate()` gets G_A ≈ **10,000,000**. Blob
   code ≤ 4 MB.

That asymmetry *is* the JAM superpower and it dictates the shape of every good
JAM service: **do the expensive verification in `refine()`, off the global state
path; commit only a tiny result in `accumulate()`.** A service that verifies an
expensive proof and writes one 32-byte commitment is JAM working as designed.

## 3. The decision: **Verifiable Private Claims** (anonymous membership + nullifiers)

We pivot the service from "hash a string" to a **privacy primitive**: prove you
belong to a committed set and perform a one-time action, **without revealing
which member you are**. This is the Semaphore / Tornado pattern, and it is the
single most useful, most "wow", and most *feasible-today* thing this architecture
supports.

Headline use case (what the demo will show): **anonymous, sybil-resistant
voting.**

- **Setup.** An organiser publishes on-chain a Merkle root `R` over a set of
  identity commitments `{ commit_i = H(secret_i) }` (the eligible voters /
  allowlist / airdrop set).
- **Cast.** A member submits a work-item `(membership_witness, nullifier N,
  vote V)`. `refine()` verifies the witness proves a commitment under `R` and
  derives the nullifier `N = H(secret ‖ R)`. `accumulate()` rejects the item if
  `N` was already used, otherwise records `N` and folds `V` into the on-chain
  tally.
- **Result on chain.** Only `{ R, set of spent nullifiers, vote tally }`. The
  chain never learns *who* voted or *which* commitment a vote came from, and
  nobody can vote twice (the nullifier is deterministic per identity per poll).

Why this is the right call:

- **Genuinely useful, not a toy.** Anonymous voting, private airdrop claims,
  proof-of-uniqueness / anti-sybil gating, whistleblower signalling — all are the
  *same* primitive and all are things people actually want on a chain.
- **Feasible today.** It needs only hashing + Merkle-path verification +
  nullifier derivation — feasibility ranks 1–2 (trivially within G_R). No
  unproven cryptography required to ship v1.
- **Showcases JAM exactly.** Heavy membership/nullifier verification in `refine`;
  a tiny `{nullifier, tally}` commit in `accumulate`. Textbook refine/accumulate.
- **A clean PolkaJam differential.** The same `.jam` blob runs on PolkaJam and
  lasair; "anonymous vote tallied identically on both" is a sharp blackbox A/B.

## 4. Honest privacy tiers (no overclaiming)

The name is "zk" so we must be precise about what is and isn't zero-knowledge:

| Tier | Membership proof | Who learns the identity? | Status |
|---|---|---|---|
| **A — on-chain private** (ship first) | Merkle inclusion path verified in `refine` | The **chain/observers learn nothing** (only `R`, `N`, `V` go on-chain). The validator's `refine` transiently sees the witness. | Feasible now (ranks 1–2) |
| **B — fully zero-knowledge** | Groth16 circuit proving "I know a secret whose commitment is under `R`" — Semaphore-style | **Nobody** learns the identity, not even the validator | Gated on the §5 gas spike |

Tier A already delivers the product (the chain is the adversary in most threat
models). Tier B is the true-ZK upgrade and the reason the SNARK spike matters —
we build B **only if** it's proven to fit the gas budget.

## 5. The one thing we must measure before promising Tier B

Full ZK needs an in-blob Groth16 pairing verifier (no host pairing exists). The
feasibility study rates this "plausible but **unvalidated** — needs a gas
measurement". So the **next concrete step is a de-risking spike**, not a build:

1. Compile an `ark-groth16` + `ark-bn254` (BN254) `verify()` to
   `riscv64imac-unknown-none-elf`, `no_std`.
2. Measure actual gas for one proof verification under lasair / `polkavm-gp07`'s
   gas tooling against the production cost model.
3. **Decision gate:** if one verify ≪ G_R (5e9) with comfortable margin → build
   Tier B (true anonymous voting). If it blows the budget → ship Tier A now and
   revisit ZK when a pairing host call or a cheaper proof system lands.

Either branch yields a genuinely useful service; the spike only decides *how
private* v1 can honestly claim to be.

## 6. Implementation sketch (slots into the existing stack)

The client/web stack is already generic (`submitItem(serviceId, payloadHex)` →
read storage), so only the service body and the UX copy change.

- **Work-item payload (cast a vote):**
  `[version(1)][poll_id(32)][vote(1)][nullifier(32)][merkle_depth(1)][path…(depth·33)]`
- **`refine()`** — verify the Merkle path from `H(secret)` (recomputed from the
  witness) up to the poll's root `R`; recompute and check the nullifier binds to
  `(secret, R)`; output `[ok][poll_id][nullifier][vote]`.
- **`accumulate()`** — keyed storage: `root:<poll_id>`, `nullifier:<poll_id>:<N>`
  (presence = spent), `tally:<poll_id>:<option>` (incremented). Reject double-spend
  by checking the nullifier key. This is the first version where `accumulate`
  *actually consumes the refine verdict* — fixing the current stub.
- **Web UX:** "Create poll" (publish a root over a small allowlist), "Cast
  anonymous vote", "Live tally + spent-nullifier set" — replacing the
  hash/tamper toy with a real, legible privacy demo.

## 7. Why not the alternatives

- **Plain signature notary (ed25519 attestation).** Feasible and useful, but no
  privacy story and far less "wow" than anonymous voting — it's a lateral move.
- **Full zkVM (RISC Zero / SP1) receipt verification.** Maximal wow, but the
  verifier blobs and gas cost are heavier and even less validated than Groth16;
  same spike risk, larger. Park behind Tier B's result.
- **Generic SNARK-verifier-as-a-service with no use case.** Verifying arbitrary
  proofs with nothing to *do* with the result is the same "wiring demo" trap we're
  escaping. The nullifier/tally gives the proof a *consequence*.

---

**Next action:** run the §5 Groth16-on-PVM gas spike, record the number here,
then build Tier A or Tier B accordingly. Build is paused until the lasair-node /
testnet images are validated against the live compose.
