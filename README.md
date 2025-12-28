# zk-jam-service

**ZK proof verification for [JAM](https://graypaper.com) (Join-Accumulate Machine) — enabling trustless computation verification on Polkadot's next-generation architecture.**

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![JAM](https://img.shields.io/badge/Platform-JAM%20%7C%20Polkadot-E6007A.svg)](https://graypaper.com)

```
┌─────────────────┐         ┌─────────────────────────────────┐         ┌──────────────┐
│   Off-Chain     │         │         JAM Network              │         │   On-Chain   │
│   Prover        │  submit │  ┌─────────┐    ┌────────────┐  │ finalize│    State     │
│                 │ ───────>│  │ REFINE  │───>│ ACCUMULATE │  │────────>│              │
│  Generate proof │  work   │  │  (6s)   │    │  (<10ms)   │  │         │  Immutable   │
│                 │  item   │  │ Verify  │    │  Update    │  │         │   Receipt    │
└─────────────────┘         │  └─────────┘    └────────────┘  │         └──────────────┘
                            └─────────────────────────────────┘
```

**Why JAM?** Traditional blockchains run all code on every validator (~10ms budget). JAM runs heavy computation on a few validators (6s budget), then all validators update state (<10ms). This 1000x reduction in redundant computation makes ZK verification practical.

## Core Logic

```rust
// src/lib.rs — The "Aha!" moment

fn refine(payload: WorkPayload) -> WorkOutput {
    // Runs on ONE validator core (up to 6 seconds)
    let expected_hash = &payload[..32];
    let preimage = &payload[32..];

    let computed = blake2s256(preimage);  // Heavy computation here
    let is_valid = computed == expected_hash;

    [is_valid as u8, computed...].into()
}

fn accumulate(results: Vec<WorkOutput>) {
    // Runs on ALL validators (<10 milliseconds)
    let count = get_storage(b"count") + results.len();
    set_storage(b"count", count);  // Fast state update
}
```

## ZK Verification Strategy

**The challenge:** The best ZK implementations (Barretenberg, libsnark) are in C++, but JAM requires `no_std` Rust for PolkaVM.

**Our approach:**

| Path | Library | Status |
|------|---------|--------|
| **Primary** | Arkworks (Rust) | Groth16, full `no_std`, ~5ms verification |
| **Research** | Barretenberg (C++) | Investigating RISC-V compilation for PVM |

We're not building new ZK systems—we're building the PVM-compatible wrapper that lets JAM verify proofs from battle-tested ecosystems. See [grant-proposal.md](./grant-proposal.md) for the full integration strategy.

## Quick Start

```bash
# Prerequisites
rustup target add riscv64imac-unknown-none-elf
cargo install jam-pvm-build

# Build
jam-pvm-build

# Start local testnet
./polkajam-nightly/polkajam-testnet

# Deploy service
./polkajam-nightly/jamt create-service zk-jam-service.jam

# Submit verification
cd client && npx tsx src/hash-verify.ts "hello world"
```

### Web Dashboard

```bash
cd client/web && npm install && npm run dev
# Open http://localhost:3000
```

| Page | Purpose |
|------|---------|
| `/` | Network status, pipeline visualization |
| `/verify` | Interactive hash verification |
| `/explorer` | Slot browser, verification history |
| `/learn` | JAM architecture education |

<p align="center">
  <img src="./docs/images/HashVerify.png" alt="HashVerify" width="700">
</p>

## Testing & Benchmarking

**Dual-tier testing strategy:**

| Tier | Tool | Purpose |
|------|------|---------|
| **Execution** | Rust `criterion` | Measure `refine()` cycle counts, memory in PVM |
| **Load** | k6 | Simulate concurrent submissions, end-to-end latency |

**Target metrics:**

| Proof System | Native | PVM | Fits 6s? |
|--------------|--------|-----|----------|
| Groth16 | ~5ms | TBD | TBD |
| PLONK | ~30ms | TBD | TBD |

## Project Structure

```
zk-jam-service/
├── src/lib.rs              # JAM service (Rust, no_std, PolkaVM)
├── client/                 # CLI tooling (TypeScript)
│   └── src/
│       ├── hash-verify.ts  # Submit verifications
│       └── query-state.ts  # Read service storage
├── client/web/             # Web dashboard (Next.js)
└── grant-proposal.md       # Web3 Foundation grant application
```

## Development Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Infrastructure | ✅ | Project setup, deployment pipeline |
| 2. Hash Verification | ✅ | Blake2s-256 verification (proof-of-concept) |
| 2.5. Web Dashboard | ✅ | Interactive UI, educational content |
| 3. ZK Integration | 🔄 | Real ZK proof verification |
| 4. Benchmarking | 📋 | Performance analysis, optimization |

## Use Cases

| Use Case | Description |
|----------|-------------|
| **ZK-Rollup Settlement** | Verify rollup state transitions on Polkadot |
| **Private Voting** | Prove eligibility without revealing identity |
| **Credential Verification** | Prove age/citizenship without documents |
| **AI Attestation** | Prove specific model produced specific output |

## Resources

- [JAM Graypaper](https://graypaper.com) — Technical specification
- [Polkadot Wiki](https://wiki.polkadot.network/docs/learn-jam-chain) — JAM overview
- [Arkworks](https://arkworks.rs/) — ZK library documentation
- [zk-proof-testing-plan.md](./zk-proof-testing-plan.md) — Detailed technical roadmap

## License

Apache-2.0 — See [LICENSE](./LICENSE)

---

<p align="center">
  <sub>Built as a public good for the Polkadot ecosystem</sub>
</p>
