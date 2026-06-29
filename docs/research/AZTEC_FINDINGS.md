# Aztec Network — consolidated research findings

Sourced research (2026-06-30) underpinning `../BLUEPRINT.md`. Compiled from four
parallel research sweeps over official Aztec docs, blog, forum, `aztec-packages`
source, L2BEAT, and credible third-party analyses. Confidence flags: **[F]** fact /
source quote, **[M]** medium / version-sensitive, **[I]** inference.

## 0. Status (read everything below in this light)
Aztec is a privacy L2 on Ethereum. **Pre-mainnet for apps.** Public testnet since
May 1 2025; "Ignition" mainnet (Nov 2025) produces a consensus chain **without the
contract execution layer** — real apps flip on ~early 2026. So essentially every
app today is testnet/demo/PoC. The **only** ever-live mainnet product was **Aztec
Connect / zk.money (2021–2024)** — shielded ETH/DAI, ~$17–20M TVL, ~100k wallets —
**sunset because the single-sequencer design couldn't decentralize and blocked
composability** (founders explicitly denied regulatory pressure). [F]

## 1. Privacy architecture (how it works)
- **Private state = encrypted UTXO "notes"**, not balances. The chain stores only a
  **note commitment** (hash); the preimage stays on the owner's device. Spending a
  note **nullifies** it and creates new notes (cash-like). [F]
- **Nullifiers**: deterministic, owner-secret-derived, app-siloed tags published to
  prove "consumed" without revealing *what*. Double-spend = duplicate nullifier =
  rejected. [F]
- **Private vs public split (two ordered phases):** private functions **run and are
  ZK-proven client-side** in the PXE (witness never leaves the device); public
  functions run later on the **sequencer** (AVM, EVM-like, not private). Flow is
  one-way: **private can enqueue public; public cannot call private.** Private
  cannot read *live* public state (executes over historical state); can't read its
  own *pending* same-tx state (transient-note bookkeeping instead). [F]
- **Proof system:** PLONK→UltraPlonk(legacy)→**UltraHonk** (sumcheck + multilinear
  PCS). Client stack = **ClientIVC / "CHONK"**: Protogalaxy folding of heterogeneous
  per-function circuits + **Goblin Plonk** ("lazy recursion" deferring non-native EC
  ops to one final step). Backend = **Barretenberg (bb)** over **BN254 + Grumpkin**.
  One recursive **epoch proof** (32 blocks) is verified on L1 by a **HonkVerifier**;
  state diffs posted as **EIP-4844 blobs**. L2BEAT classes the deployed contracts a
  Stage-2 ZK rollup. [F/M]
- **Five global Merkle trees** (domain-separated **Poseidon2**): note-hash (append,
  h42), nullifier (indexed, h42), public-data (indexed, h40), L1→L2 msg (h36),
  archive (h30). [F, from `constants.nr`]

## 2. Developer model
- **Noir** — Rust-like zkDSL (Aztec Labs), compiles to backend-agnostic **ACIR**;
  default backend Barretenberg/UltraHonk. `bb` can emit a **Solidity verifier** for
  any EVM chain → Noir proofs are portable. **Still beta (v1.0.0-beta.x), "expect
  bugs, not for production."** [F]
- **Aztec.nr** — the contract framework: `#[aztec]` contract, `#[private]`/`#[public]`
  (newer: `#[external("private"|"public")]`), `#[utility]`, `#[initializer]`.
  Storage taxonomy: `PrivateSet`/`PrivateMutable`/`PrivateImmutable` (notes),
  `PublicMutable`/`PublicImmutable`, `Map`, and `DelayedPublicMutable` (read public
  from private via historical proof + delay). [F]
- **Native account abstraction** — accounts *are* contracts (no EOAs); validation is
  client-proven so the sequencer checks a constant-size proof. **AuthWit** =
  action-scoped, single-use (nullifier-backed) authorization replacing blanket
  approvals. Keys on Grumpkin: nullifier, incoming/outgoing viewing, tagging;
  signing keys app-defined. [F]
- **DX pain:** dev runs with **proving OFF** (simulation) because real proving is
  slow; **no interactive circuit debugger** (`println`, opcode counts); **breaking
  changes every release**, state wiped between versions. [F]

## 3. Use-case catalogue (all testnet/PoC unless noted)
| Category | Named examples | Note |
|---|---|---|
| Shielded token / payments | Aztec.nr Token, **Taurus private stablecoin**, AIP-20 standard | balances = encrypted notes |
| Private DeFi | **Uniswap portal**, OTC Desk, Nemi (DEX), Shade (lending), Olla | model = *bridge to existing DeFi privately*, not native rebuilds |
| Private identity / PoP | **ZKPassport** (live mobile app), ZKEmail, **Semaphore-in-Noir** | client-side proof of a credential |
| Private voting / DAO | **zk-POPVOTE (NounsDAO)**, EasyPrivateVoting, StealthNote | prove membership + vote, public tally |
| Selective-disclosure compliance | **PrivPNL** (prove PnL to auditor), viewing keys, note tagging | read vs spend decoupled |
| Gaming / NFT / RWA | BattleZips, Dark Forest (Noir), Raven House, Taurus CMTAT | hidden-information games |
| **Historical (only real mainnet)** | **zk.money / Aztec Connect** | shielded ETH/DAI + DeFi bridges (Lido/Element/Curve/Liquity); sunset 2024 |

## 4. The three hardest problems (Aztec's own admissions)
1. **Client-side proving cost / UX** — simplest private call: ~**2.5 s laptop / ~5 s
   mobile / ~25 s browser** (fixed) + per-call cost; real DeFi txs are heavier;
   RAM cut 3.7 GB→**1.3 GB**; browser capped by 4 GB WASM; **GPU not yet merged**;
   testnet throttled to **~0.2 TPS**. This is *the* bottleneck. [F]
2. **Note discovery** — recipients must *find* their encrypted notes; **stranger
   discovery is unsolved** (need sender address first); OMR/PIR/FMD "impractical at
   scale." Aztec's own sharpest critique. [F]
3. **Anonymity-set bootstrapping** — "as the privacy set approaches 1, privacy
   approaches 0"; a low-throughput privacy L2 has a thin crowd; entry/exit points
   are the dominant real-world leak. [F]

Plus: **composability limits** (private↔public async, no live/pending public reads,
full-revert coupling); **why mainnet took years** (refusal to ship anything
centralized + from-scratch proving stack & language + ~60 GB prover circuits).

## 5. Primitive recipe — what a JAM reimplementation would need
*(from `aztec-packages` `next` branch; legacy Connect-era used Pedersen — ignore.)*
- **Hash:** Poseidon2 over BN254 scalar field; **u32 domain separator prepended** as
  first input: `P2([sep, ...inputs])`.
- **Note leaf:** `inner = P2([slot, ...data, randomness], NOTE_HASH)` →
  `siloed = P2([contract, inner], SILOED=3361878420)` →
  `unique = P2([nonce, siloed], UNIQUE=226850429)`,
  `nonce = P2([first_nullifier_in_tx, idx], NONCE=1721808740)`.
- **Nullifier:** `n = P2([note_hash, nhk_app], NOTE_NULLIFIER=50789342)` →
  silo `P2([contract, n], SILOED_NULLIFIER=57496191)`; `nhk_app` = owner's
  app-siloed nullifier secret (requires the owner secret → only owner can spend).
- **Note tree:** append-only Merkle, height **42**, per-tx subtree height 6 (≤64/tx).
- **Nullifier tree:** **indexed** Merkle, leaf `{value, nextIndex, nextValue}` sorted
  linked list; non-membership via **low-leaf** (value<n, nextValue>n||0) membership +
  range check; 7-step insert; ~8× cheaper than a sparse depth-254 tree.
- **Keys:** Grumpkin scalars from a master seed; app-silo
  `P2([msk.hi, msk.lo, app_addr], key_dom_sep)`. Viewing keys (read) are separate
  from nullifier keys (spend) → selective disclosure to auditors.
- **Encryption/discovery:** Grumpkin ECDH shared secret → symmetric encrypt note;
  staged **tag** derivation (DH → silo by contract → by recipient → by counter);
  recipient recomputes tags to scan logs.

## 6. Takeaways for the JAM blueprint
- **JAM's structural win = no client-side proving for verification-lane use cases**
  (Aztec's #1 pain) + a **cheap, abundant in-protocol verification lane** (vs Aztec's
  scarce, complexity-heavy L1 verification).
- **The privacy primitives above are reimplementable in-blob** (`no_std` Poseidon2 +
  Merkle/indexed-Merkle), so a JAM service can offer Aztec-style membership/nullifier
  privacy where it wants it — and pair it with client-side proofs only for the
  true-ZK tier (verified cheaply in `refine`).
- **Don't rebuild Aztec's note/PXE/Noir stack** (their moat, no JAM SDK). **Do** lead
  with verifiable compute + proof/membership verification, where JAM is structurally
  better. See `../BLUEPRINT.md` §3–4.
