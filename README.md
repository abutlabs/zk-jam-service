# zk-jam-service

A ZK proof verification service for [JAM](https://graypaper.com) (Join-Accumulate Machine) - Polkadot's next-generation compute platform.

**Current Phase:** Hash verification working end-to-end with web dashboard. ZK integration next.

## What It Does

Submit cryptographic proofs to the JAM network for trustless verification:

```
Your Server                    JAM Network                    Result
┌──────────┐    submit     ┌─────────────────┐    verify    ┌──────────┐
│ Generate │ ─────────────>│ zk-jam-service  │─────────────>│ On-chain │
│  proof   │   work item   │ (6s compute)    │   finality   │  receipt │
└──────────┘               └─────────────────┘              └──────────┘
```

**Currently implements:** Blake2s-256 hash verification (proving you know a preimage)

**Coming soon:** Real ZK proof verification (RISC Zero, SP1, or Groth16)

## Quick Start

```bash
# 1. Build the service
jam-pvm-build

# 2. Start local testnet (6 validators)
./polkajam-nightly/polkajam-testnet

# 3. Deploy service
./polkajam-nightly/jamt create-service zk-jam-service.jam

# 4. Run the web dashboard
cd client/web && npm install && npm run dev
```

Open http://localhost:3000 to interact with the service.

## Project Structure

```
zk-jam-service/
├── src/lib.rs              # JAM service (Rust, no_std)
├── client/                 # CLI tools (TypeScript)
├── client/web/             # Web dashboard (Next.js)
├── polkajam-nightly/       # Node binaries (gitignored)
└── zk-proof-testing-plan.md
```

| Module | Purpose | Docs |
|--------|---------|------|
| `src/` | Rust service with `refine()` and `accumulate()` functions | [Architecture](#architecture) |
| `client/` | CLI tools for submitting proofs and querying state | [client/README.md](./client/README.md) |
| `client/web/` | Visual dashboard for demos and learning | [client/web/README.md](./client/web/README.md) |

## Architecture

JAM separates computation from state updates:

| Stage | Where | Time Limit | Purpose |
|-------|-------|------------|---------|
| **Refine** | 1 validator core | 6 seconds | Heavy computation (verify proofs) |
| **Accumulate** | All validators | 10ms | Update on-chain state |

```rust
// src/lib.rs - Simplified

fn refine(payload: WorkPayload) -> WorkOutput {
    let expected_hash = &payload[..32];
    let preimage = &payload[32..];
    let computed = blake2s256(preimage);
    let is_valid = (computed == expected_hash);
    return [is_valid, computed...];
}

fn accumulate(item_count: usize) {
    let count = get_storage(b"count") + item_count;
    set_storage(b"count", count);
}
```

## Web Dashboard

The dashboard at `client/web/` provides:

| Page | URL | Purpose |
|------|-----|---------|
| Dashboard | `/` | Network status, pipeline visualization |
| Verify | `/verify` | Submit hash verifications interactively |
| Explorer | `/explorer` | Browse slots, view verification history |
| Learn | `/learn` | Educational content about JAM |

## CLI Tools

```bash
cd client

# Submit a hash verification
npx tsx src/hash-verify.ts "your secret message"

# Submit with intentionally wrong hash (test failure)
npx tsx src/hash-verify.ts "message" --tamper

# Query storage
npx tsx src/query-state.ts count
```

## Prerequisites

```bash
# Rust + RISC-V target
rustup target add riscv64imac-unknown-none-elf

# JAM build tool
cargo install jam-pvm-build

# Node.js for client tools
node --version  # v18+
```

## Roadmap

See [zk-proof-testing-plan.md](./zk-proof-testing-plan.md) for detailed progress.

- [x] **Phase 1:** Project setup, CLI client
- [x] **Phase 2:** Blake2s hash verification
- [x] **Phase 2.5:** Web dashboard
- [ ] **Phase 3:** ZK proof integration (RISC Zero / SP1)
- [ ] **Phase 4:** Production hardening
- [ ] **Phase 5:** Advanced features (batching, aggregation)

## Resources

- [JAM Graypaper](https://graypaper.com) - Technical specification
- [Polkadot Wiki](https://wiki.polkadot.network/docs/learn-jam-chain) - JAM overview
- [jam-pvm-common](https://docs.rs/jam-pvm-common) - Rust SDK docs

## License

Apache-2.0 - See [LICENSE](./LICENSE)
