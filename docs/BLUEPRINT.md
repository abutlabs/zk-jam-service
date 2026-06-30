# Blueprint: ZK on JAM vs Aztec — where a JAM service wins

> Decision doc for "what should zk-jam-service actually do" (ralph point #1),
> benchmarked against Aztec (the best-in-class ZK privacy platform). Grounded in
> (a) the JAM host-ABI + gas feasibility study (`FEASIBILITY.md`) and (b) sourced
> research on Aztec's architecture and live use cases (`research/AZTEC_FINDINGS.md`).
> The pick at the end is Aiden's call; the reasoning is laid out so Aodh can veto.

## 0. TL;DR

- **Don't out-Aztec Aztec at private programmable state on a phone.** That's their
  5-year moat (encrypted notes + client-side proving + Noir/PXE SDK), and JAM has
  none of that machinery. Copying it means adopting client-side proving too, which
  throws away JAM's one structural advantage.
- **Play JAM's structural strength instead: `refine` is a cheap, abundant,
  in-protocol *verification / heavy-compute lane*.** Aztec spends enormous
  complexity making on-chain verification cheap (recursive aggregation, Goblin
  Plonk, the "squisher", one epoch proof) because L1 blockspace is scarce. JAM
  hands every work-package ~5,000,000,000 gas of parallel in-core compute. **Heavy
  verification that is painful on Aztec is native on JAM.**
- **Recommendation:** make zk-jam-service a **"verifiable claims" service** — the
  showcase of JAM-as-a-verification-lane — with **anonymous voting / sybil-resistant
  claims** as the v1 headline (real crypto, feasible today, a legible demo), and a
  clean upgrade path to verifying *arbitrary* client-generated ZK proofs (the "ZK
  attestation oracle") once the gas spike confirms in-blob SNARK verification fits.
  This also sets up point #2 (the DEX) to reuse the exact same pattern.

## 1. The structural inversion (the whole point)

| | **Aztec** | **JAM service** |
|---|---|---|
| Where heavy ZK work happens | **Client device** generates the proof (ClientIVC/UltraHonk in the PXE) | **In-protocol**: `refine()` runs the heavy verification/compute on the guarantor |
| What goes on-chain | One small recursive proof per epoch, verified by an L1 `HonkVerifier` | A small `accumulate()` state write (the result/commitment) |
| Cost model | Client proving is slow/heavy (their #1 UX pain); L1 verification is scarce & must be minimized | `refine` ≈ 5e9 gas/work-package, parallel across cores; `accumulate` ≈ 1e7 gas |
| Privacy from validators? | **Yes** — witness never leaves the device | **No, by default** — the guarantor executes `refine` over the inputs |
| Programmable-private-state SDK | Mature (notes, nullifier tree, Noir, PXE, account abstraction) | None — you build any crypto yourself, in-blob `no_std` |

The consequences:

1. **Verification is cheap and abundant on JAM.** Aztec's architecture is largely a
   monument to making *one* proof cheap to verify on L1. A JAM service can verify a
   SNARK — or a thousand Merkle proofs, or a whole batch — directly in `refine`
   without recursion gymnastics. *Verification-heavy* use cases are JAM's home turf.
2. **JAM can run heavy *public* compute Aztec structurally cannot.** Aztec forces
   all logic that must be private through client-side proving, so anything too heavy
   to prove on a phone is off the table. `refine` runs heavy deterministic compute
   in-protocol (a matching engine, a batch verifier, a simulation) and commits the
   result — **no client proving at all.**
3. **For "trustless compute" (not "hide from validators"), JAM has far better UX.**
   Many things labelled "zk" are really *verifiable computation*, not *privacy*. For
   those, the JAM user just submits inputs; `refine` does the trusted work. No
   minutes-long phone proving, no PXE, no anonymity-set bootstrapping.

Where **Aztec stays ahead, honestly:** true privacy-from-everyone for arbitrary
private state. If the requirement is "not even the validator may learn the
witness," a JAM service must *also* use client-side proving (user makes a SNARK,
`refine` verifies it) — same privacy as Aztec, but now leaning on JAM's cheap
verification lane instead of congested L1. We get parity, not a free lunch, on
pure privacy; we get a real edge on *verification cost* and *heavy compute*.

## 2. What Aztec teaches us (from the research)

- **Demand for on-chain privacy is real but unmet.** zk.money shielded ETH/DAI hit
  8,000 users in 3 days (2021) and ~$17M TVL / 100k wallets at peak — then Aztec
  *sunset it* (2024) because the shared-state design **couldn't decentralize and
  blocked composability** with third-party programs. Five years on, Aztec's new
  network still runs **empty blocks**; consumer apps don't switch on until ~2026.
  The category is wide open.
- **Their recurring primitives** (which any privacy use case reduces to): **note
  commitments** (hash hides the value), **nullifiers** (deterministic, app-siloed,
  prove "consumed" without revealing what), **Merkle membership** over a global
  note tree + **non-membership** over an indexed nullifier tree (double-spend
  prevention), **encrypted note logs** + tagging for discovery, and **viewing/
  tagging keys** for selective disclosure to auditors.
- **Their use-case map** (all testnet/PoC today): shielded tokens (Taurus private
  stablecoin), private DeFi (mostly *bridge to existing DeFi privately*, not native
  — Uniswap portal, OTC desk), private identity (**ZKPassport**, ZKEmail,
  Semaphore-in-Noir), private voting (**zk-POPVOTE / NounsDAO**, EasyPrivateVoting),
  selective-disclosure compliance (PrivPNL "prove your PnL to an auditor").

Every one of those reduces to **commitments + nullifiers + Merkle membership +
(optionally) a SNARK** — primitives we can implement in-blob. The question is only
*which* maximises JAM's edge.

## 3. Candidate use cases, ranked

Scored on **Feasibility** (from `FEASIBILITY.md`: in-blob `no_std`, refine 5e9 /
accumulate 1e7, no crypto host calls), **Usefulness**, and **JAM-edge vs Aztec**.

| # | Use case | Feasible today? | Usefulness | JAM edge vs Aztec | Verdict |
|---|---|---|---|---|---|
| 1 | **Anonymous voting / sybil-resistant claims** (Merkle membership + nullifier) | ✅ Yes (hash+Merkle, rank 1–2) | High — DAOs, airdrops, polls | Medium: cheap in-protocol verification, no client proving for Tier A; legible "wow" demo | **Build first (v1)** |
| 2 | **ZK attestation oracle** — verify *any* client-made SNARK in `refine`, commit the attested claim (proof-of-solvency, proof-of-reserves, ZKPassport-style identity, ML-inference proof) | ⚠️ Gated on gas spike (Groth16 in-blob, rank 5) | Very high — a *general* primitive other apps consume | **Large** — this is the verification-lane play; Aztec pays scarce L1 gas, JAM has an abundant lane | **Build second (if spike passes)** |
| 3 | **Verifiable heavy compute** — e.g. a frequent-batch-auction **matching engine** over sealed orders (≡ point #2's DEX) | ✅ Yes (deterministic compute, no exotic crypto) | Very high — a real product | **Largest** — Aztec *cannot* run a matching engine in client-side proving; refine is built for it | **Point #2 flagship; reuse this service's primitives** |
| 4 | Shielded token / private payments (full note+nullifier+client-proving stack) | ⚠️ Needs client proving + a note/PXE stack we'd build from scratch | High but crowded | **Negative** — Aztec's moat, JAM has no SDK | Avoid leading with this |
| 5 | Selective-disclosure compliance (prove a fact to an auditor) | ⚠️ Needs SNARK (spike) | Medium-high | Medium | Folds into #2 as a feature |

## 4. The recommendation (Aiden's call)

**Reframe zk-jam-service from "a hash demo" into "the verifiable-claims service" —
the reference showcase that JAM's `refine` is a verification lane — and ship it in
two tiers:**

- **v1 (build now): anonymous voting / one-time anonymous claims.** On-chain Merkle
  root over an eligibility set; a voter submits `(membership_witness, nullifier,
  vote)`; `refine` verifies membership + derives the nullifier; `accumulate` rejects
  a re-used nullifier and folds the vote into a public tally. Real crypto
  (commitments + Merkle + nullifiers — Aztec's exact primitives, reimplemented in
  ~200 lines of `no_std` Rust), feasible today, and the first version where
  `accumulate` *actually consumes the refine verdict* (today's stub ignores it).
  Privacy tier honest-labelled: **on-chain-private** (the chain learns only
  `{root, nullifier, vote}`); the validator transiently sees the witness.

- **v2 (build if the gas spike passes): the ZK attestation oracle.** Swap the
  Merkle witness for a **client-generated Groth16 proof** that `refine` verifies —
  giving *full* zero-knowledge (validator learns nothing, Aztec parity) AND turning
  the service into a general "bring any proof, get an on-chain attestation" engine.
  This is the part Aztec is structurally worst at (scarce L1 verification) and JAM
  is best at (abundant refine verification).

Why this and not, say, a shielded token: it **leads with JAM's strength** (cheap
verification, no mandatory client proving), it's **feasible without betting the
project on the unproven SNARK tier**, it produces a **sharp PolkaJam differential**
(same `.jam` blob, identical anonymous tally on both clients), and it **sets up
point #2** — the orderbook DEX is just candidate #3 (verifiable matching) standing
on the same commitment/nullifier primitives this service establishes.

## 5. The gate — RESOLVED ✅ (spike passed, build Tier B)

**Measured 2026-06-30** (`spikes/groth16-gas/`): a full Groth16/BN254 verify of an
**untrusted** (subgroup-checked) proof costs **56,149,565 gas in lasair's PVM =
1.12% of G_R (5e9 full), 5.6% of tiny** — ~89 verifies per full refine. The
verifier compiles to a **78 KB** `.jam` blob (limit 4 MB) and returned `valid`
in-PVM. **Tier B (full zero-knowledge) is feasible — we build it.** (Surfaced +
fixed two lasair caps that throttle any heavy refine: PVM guest stack size, and a
10M step / 10M gas refine cap below G_R — see the spike README.)

The original plan, kept for the record:

### 5b. The one gate before promising v2: the gas spike

Full-ZK (v2) needs an in-blob pairing verifier and **no JAM host crypto exists**, so
we must *measure* before promising it:

1. Compile an `ark-groth16` + `ark-bn254` `verify()` to `riscv64imac-unknown-none-elf`
   (`no_std`).
2. Run one verification under lasair / `polkavm-gp07`'s gas tooling; read the gas.
3. **Gate:** one verify ≪ 5e9 with margin → build v2 (true-ZK attestation oracle).
   Else → ship v1 (on-chain-private voting), and revisit when a pairing host call or
   a cheaper proof system lands.

Either outcome ships a genuinely useful service; the spike only decides how private
v1's successor can honestly claim to be.

## 6. Next steps

1. **Run the gas spike** (§5) — the single highest-information experiment; do it
   before committing to v1-vs-v2 scope.
2. Build v1 (anonymous voting): replace `refine`/`accumulate` with the
   membership+nullifier logic; rework the web UX from "hash a string" to "create
   poll / cast anonymous vote / live tally + spent-nullifier set".
3. Keep the client/web interface (`submitItem`/`readStorage`) unchanged — only the
   service body and UX copy move.
4. Carry the commitment/nullifier primitives forward into point #2 (the DEX).

> Paused pending: (a) Aodh's reaction to this direction, (b) the gas-spike result.
> Build does not start on the live service until the lasair-node/testnet images are
> validated against the running compose.
