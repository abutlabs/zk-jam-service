# zk-jam-service

**A ZK proof verification service for [JAM](https://graypaper.com) (Join-Accumulate Machine) — enabling trustless off-chain computation verification on Polkadot's next-generation architecture.**

We are building `zk-jam-service` as a **public good** for the Kusama/Polkadot ecosystem. Our goal is to bring zero-knowledge proof verification to JAM, unlocking privacy-preserving applications, rollup settlement, and verifiable computation for the next generation of Polkadot infrastructure.

This project serves dual purposes: delivering production-ready ZK verification infrastructure, and creating educational resources that help developers understand JAM's unique architecture. We deploy on Parity's PolkaJam testnet and document our learnings to lower the barrier for future JAM service developers.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Phase](https://img.shields.io/badge/Phase-2%20Complete-green.svg)](#development-status)
[![JAM](https://img.shields.io/badge/Platform-JAM%20%7C%20Polkadot-E6007A.svg)](https://graypaper.com)

## Overview

zk-jam-service demonstrates how JAM's unique **Refine → Accumulate** architecture enables verification of computationally expensive proofs on-chain. By separating heavy computation (6 seconds on validator cores) from fast state updates (<10ms on all validators), JAM allows verification workloads that are impossible on traditional blockchains.

**Current Implementation:** Blake2s-256 hash verification (proof-of-concept)
**Target Implementation:** Full ZK proof verification (RISC Zero, SP1, or Groth16)

```
┌─────────────────┐         ┌─────────────────────────────────┐         ┌──────────────┐
│   Off-Chain     │         │         JAM Network              │         │   On-Chain   │
│   Computation   │  submit │  ┌─────────┐    ┌────────────┐  │ finalize│    State     │
│                 │ ───────>│  │ REFINE  │───>│ ACCUMULATE │  │────────>│              │
│  Generate proof │  work   │  │  (6s)   │    │  (<10ms)   │  │         │  Immutable   │
│  (minutes/hours)│  item   │  │ Verify  │    │  Update    │  │         │   Receipt    │
└─────────────────┘         │  └─────────┘    └────────────┘  │         └──────────────┘
                            └─────────────────────────────────┘
```

## Problem Statement

**The Verification Bottleneck:** ZK proof verification typically requires 100ms–2s of computation. Traditional blockchains execute all code on every validator, making ZK verification prohibitively expensive or impossible at scale.

**JAM's Solution:** Only a small subset of validators run the expensive `refine()` computation, while all validators run the fast `accumulate()` state update. This 1000x reduction in redundant computation enables practical ZK verification on-chain.

**Why This Matters:**
- **Privacy-preserving applications** can prove statements without revealing data
- **Rollups and L2s** can settle proofs on Polkadot without full re-execution
- **AI/ML verification** can attest to model outputs trustlessly
- **Cross-chain bridges** can verify external chain state with ZK proofs

## Development Status

| Phase | Status | Description |
|-------|--------|-------------|
| **1. Infrastructure** | ✅ Complete | Project setup, CLI tooling, deployment pipeline |
| **2. Hash Verification** | ✅ Complete | Blake2s-256 verification demonstrating full pipeline |
| **2.5. Web Dashboard** | ✅ Complete | Interactive UI for demos and education |
| **3. ZK Integration** | 🔄 Next | Real ZK proof verification (RISC Zero/SP1) |
| **4. Production** | 📋 Planned | Error handling, benchmarking, security audit |
| **5. Advanced** | 🔮 Future | Batching, aggregation, cross-service proofs |

See [zk-proof-testing-plan.md](./zk-proof-testing-plan.md) for detailed technical roadmap.

## Technical Architecture

### Service Implementation (Rust, `no_std`)

```rust
// src/lib.rs - JAM Service Entry Points

fn refine(payload: WorkPayload) -> WorkOutput {
    // Runs on ONE validator core (up to 6 seconds)
    // ─────────────────────────────────────────────
    let expected_hash = &payload[..32];      // Extract claim
    let preimage = &payload[32..];           // Extract witness

    let computed = blake2s256(preimage);     // Heavy computation
    let is_valid = computed == expected_hash; // Verification

    return [is_valid, computed...];          // Result for accumulate
}

fn accumulate(results: Vec<WorkOutput>) {
    // Runs on ALL validators (<10 milliseconds)
    // ─────────────────────────────────────────────
    let count = get_storage(b"count") + results.len();
    set_storage(b"count", count);            // Fast state update
}
```

### Payload Format

```
┌──────────────────────────────────────────────────────────────────┐
│                         Work Payload                              │
├────────────────────────────────┬─────────────────────────────────┤
│   Expected Hash (32 bytes)     │      Preimage (N bytes)         │
│   "I claim hash(x) = H"        │      "Here is x"                │
└────────────────────────────────┴─────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Work Output                               │
├────────────────────────────────┬─────────────────────────────────┤
│   Result Code (1 byte)         │      Computed Hash (32 bytes)   │
│   0x01=valid, 0x00=invalid     │      Proof of computation       │
└────────────────────────────────┴─────────────────────────────────┘
```

### Project Structure

```
zk-jam-service/
├── src/lib.rs              # JAM service (Rust, no_std, PolkaVM target)
├── client/                 # CLI tooling (TypeScript)
│   └── src/
│       ├── hash-verify.ts  # Submit verifications
│       ├── query-state.ts  # Read service storage
│       └── monitor.ts      # Network monitoring
├── client/web/             # Web dashboard (Next.js 14)
│   └── src/app/
│       ├── verify/         # Interactive verification UI
│       ├── explorer/       # Block & history browser
│       └── learn/          # Educational content
└── zk-proof-testing-plan.md
```

## Quick Start

### Prerequisites

```bash
# Rust with RISC-V target
rustup target add riscv64imac-unknown-none-elf
cargo install jam-pvm-build

# Node.js 18+
node --version
```

### Build & Deploy

```bash
# 1. Build the service blob
jam-pvm-build

# 2. Start local 6-validator testnet
./polkajam-nightly/polkajam-testnet

# 3. Deploy service (returns Service ID)
./polkajam-nightly/jamt create-service zk-jam-service.jam

# 4. Submit a verification
cd client && npx tsx src/hash-verify.ts "hello world"
```

### Web Dashboard

```bash
cd client/web
npm install
npm run dev
# Open http://localhost:3000
```

| Page | Purpose |
|------|---------|
| `/` | Network status, pipeline visualization |
| `/verify` | Interactive hash verification with tamper testing |
| `/explorer` | Slot browser, verification history |
| `/learn` | JAM architecture education |

#### Web Dashboard screenshots

 <!-- Centered -->
  <p align="center">
    <img src="./docs/images/HashVerify.png" alt="HashVerify" width="800">
  </p>

 <!-- Centered -->
  <p align="center">
    <img src="./docs/images/Explorer.png" alt="Explorer" width="800">
  </p>

   <!-- Centered -->
  <p align="center">
    <img src="./docs/images/Learn.png" alt="Learn" width="800">
  </p>


## Research: ZK Proof Integration Approaches

JAM's PolkaVM environment presents unique constraints: services compile to RISC-V in a `no_std` Rust environment with deterministic execution requirements. This rules out naive integration of existing ZK libraries, but opens several promising research directions.

**Our research goal:** Determine the optimal path to bring production-grade ZK verification to JAM, evaluating trade-offs between proof systems, verification costs, and developer experience.

### Approach 1: Native Rust ZK Verifiers (Primary Focus)

Leverage Rust-native ZK libraries with `no_std` support that can compile directly to PolkaVM.

| Library | Proof System | `no_std` | Verification Time | Status |
|---------|--------------|----------|-------------------|--------|
| **RISC Zero** | STARK | ✅ Full | ~100ms | Evaluating |
| **SP1 (Succinct)** | STARK | Partial | ~50ms | Evaluating |
| **Arkworks** | Groth16/PLONK | ✅ Full | ~10ms | Evaluating |
| **Plonky2** | PLONK | Partial | ~20ms | Watching |

**Why this approach:** RISC Zero and SP1 use RISC-V internally, creating natural alignment with PolkaVM's architecture. Arkworks provides battle-tested Groth16 verification with full `no_std` support.

### Approach 2: Optimized Verification Circuits

For maximum efficiency, implement custom verification logic optimized for JAM's constraints:

- **Groth16 verifier** — ~200 byte proofs, ~10ms verification, ideal for fixed circuits
- **KZG verification** — Enables data availability proofs and polynomial commitments
- **Recursive proof aggregation** — Batch multiple proofs into single verification

This approach requires more development effort but yields the smallest proof sizes and fastest verification times.

### Approach 3: Cross-Ecosystem Proof Portability

Enable proofs generated by any ecosystem to be verified on JAM:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Aztec Noir     │     │   Circom/       │     │   Cairo/        │
│  (Ethereum)     │────>│   SnarkJS       │────>│   Starknet      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │   zk-jam-service        │
                    │   Universal Verifier    │
                    │   (JAM/Polkadot)        │
                    └─────────────────────────┘
```

**Research questions:**
- Can we build a universal verifier that accepts proofs from multiple systems?
- What's the overhead of proof format translation?
- How do we handle different elliptic curves and hash functions?

### Approach 4: C++/Rust FFI Integration (Experimental)

Some best-in-class ZK implementations (like Aztec's Barretenberg) are written in C++. While direct execution in PolkaVM isn't currently possible, we're exploring:

- **LLVM → RISC-V compilation** — Compile C++ directly to PolkaVM-compatible bytecode
- **Verification-only extraction** — Port only the verifier (simpler than full prover) to Rust
- **WASM intermediate** — Compile C++ → WASM → PolkaVM (emerging toolchain support)

This is higher-risk research but could unlock access to mature, audited cryptographic implementations.

### Phase 3 Deliverables

Based on our research findings, Phase 3 will deliver:

1. **ZK Verifier Integration** — Implement chosen verification approach in `refine()`
2. **Proof Generation Toolkit** — Off-chain CLI for generating compatible proofs
3. **Benchmarking Suite** — Verification time, gas costs, proof size analysis
4. **Dashboard Updates** — ZK-specific UI (proof upload, verification visualization)
5. **Integration Guide** — Documentation for developers building on zk-jam-service
6. **Research Report** — Published findings on ZK/JAM integration patterns

## Use Cases

### Enabled by ZK + JAM

| Use Case | Description |
|----------|-------------|
| **ZK-Rollup Settlement** | Verify rollup state transitions on Polkadot |
| **Private Voting** | Prove vote eligibility without revealing identity |
| **AI Model Attestation** | Prove specific model produced specific output |
| **Credential Verification** | Prove age/citizenship without revealing documents |
| **Gaming** | Verify complex game state transitions off-chain |

### Why JAM (vs. Smart Contracts)

| Feature | Traditional Blockchain | JAM |
|---------|----------------------|-----|
| Verification time | ~10ms (all validators) | ~6s (few validators) |
| ZK verification | Impractical | Native support |
| Computation model | Every node executes | Compute once, verify many |
| Cost scaling | O(validators × computation) | O(computation) |

## Grant Objectives & Ecosystem Impact

This project directly advances Polkadot's technical capabilities and aligns with Web3 Foundation priorities:

### What Grant Funding Enables

| Milestone | Deliverable | Ecosystem Benefit |
|-----------|-------------|-------------------|
| **Research Phase** | Evaluate ZK libraries for PolkaVM compatibility | De-risk ZK integration for all JAM developers |
| **Core Integration** | Working ZK verifier in JAM service | First production ZK verification on JAM |
| **Tooling** | Proof generation CLI + SDK | Lower barrier for ZK application development |
| **Education** | Tutorials, documentation, example code | Accelerate JAM ecosystem growth |
| **Benchmarking** | Performance analysis and optimization | Inform future JAM protocol decisions |

### Why This Matters for Polkadot

1. **First-mover advantage** — Positions Polkadot as the first ecosystem with native JAM-based ZK verification
2. **Rollup readiness** — Enables ZK-rollups to settle on Polkadot without Ethereum dependency
3. **Privacy infrastructure** — Foundation for privacy-preserving applications across parachains
4. **Developer education** — Comprehensive learning resources accelerate JAM adoption
5. **Open source public good** — All code, research, and documentation freely available

### Prior Work Demonstrated

We have already delivered Phases 1, 2, and 2.5 without external funding:

- ✅ Complete JAM service deployment pipeline
- ✅ Working hash verification (proof-of-concept for ZK)
- ✅ Interactive web dashboard with educational content
- ✅ CLI tooling for service interaction
- ✅ Documentation and technical architecture

This demonstrates our capability to execute and our commitment to delivering value to the ecosystem.

### Team

We are experienced blockchain developers passionate about advancing Polkadot's ZK capabilities. Our backgrounds span cryptography research, Rust systems programming, and full-stack development.

## Resources

- **[JAM Graypaper](https://graypaper.com)** — Technical specification
- **[Polkadot Wiki](https://wiki.polkadot.network/docs/learn-jam-chain)** — JAM overview
- **[jam-pvm-common](https://docs.rs/jam-pvm-common)** — Rust SDK documentation
- **[PolkaJam Releases](https://github.com/parity-tech/polkajam/releases)** — Node binaries

## Contributing

We welcome contributions! See individual module READMEs for development setup:
- [client/README.md](./client/README.md) — CLI tools
- [client/web/README.md](./client/web/README.md) — Web dashboard

## License

Apache-2.0 — See [LICENSE](./LICENSE)

---

<p align="center">
  <sub>Built as a public good for the Polkadot ecosystem</sub><br>
  <sub>ZK integration roadmap aligned with <a href="https://grants.web3.foundation/">Web3 Foundation grant priorities</a></sub>
</p>
