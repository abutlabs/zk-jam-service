# ZK Proof Testing Plan for JAM Service

## Overview

This document tracks the evolution of `zk-jam-service` from a minimal demo into a functional ZK proof verification service running on JAM (Join-Accumulate Machine).

**Current Status:** Phase 2 Complete - Hash verification working end-to-end with web dashboard.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WEB DASHBOARD                                   │
│  client/web/                 (Next.js 14 + shadcn/ui)                       │
│  ├── /              Dashboard with network status & pipeline visualization  │
│  ├── /verify        Interactive hash verification with tamper testing       │
│  ├── /explorer      Slot browser & verification history                     │
│  └── /learn         Educational content about JAM & ZK proofs               │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼ Server Actions (calls jamt CLI)
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLI CLIENT (TypeScript)                              │
│  client/src/                                                                 │
│  ├── hash-verify.ts    Submit hash verifications (with --tamper flag)       │
│  ├── query-state.ts    Query service storage                                │
│  ├── monitor.ts        Watch network activity                               │
│  └── submit-proof.ts   (Future) Submit ZK proofs                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼ jamt CLI (WebSocket RPC to localhost:9944)
┌─────────────────────────────────────────────────────────────────────────────┐
│                         JAM NETWORK (PolkaJam Testnet)                       │
│  6 validators running locally via `polkajam-testnet`                        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  zk-jam-service (Service ID: 99fbfec5)                              │    │
│  │                                                                      │    │
│  │  REFINE (off-chain, 6s limit, runs on validator cores):             │    │
│  │    1. Extract expected_hash (bytes 0-31) and preimage (bytes 32+)   │    │
│  │    2. Compute blake2s256(preimage)                                  │    │
│  │    3. Compare: computed_hash == expected_hash                       │    │
│  │    4. Return: [result_code] + [computed_hash]                       │    │
│  │                                                                      │    │
│  │  ACCUMULATE (on-chain, <10ms, runs on all validators):              │    │
│  │    1. Increment verification count                                  │    │
│  │    2. Update status storage                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Project Cleanup & Client Setup ✅ COMPLETE

**Goal:** Clean up legacy code and establish the TypeScript client infrastructure.

### Completed Tasks

- [x] **1.1** Deleted `deploy.ts` (superseded by `jamt create-service`)
- [x] **1.2** Created `client/` directory structure:
  ```
  client/
  ├── package.json
  ├── tsconfig.json
  ├── src/
  │   ├── config.ts          # RPC endpoints, service ID config
  │   ├── hash-verify.ts     # Submit hash verifications
  │   ├── submit-proof.ts    # (Placeholder for ZK proofs)
  │   ├── query-state.ts     # Query service storage
  │   ├── monitor.ts         # Monitor network activity
  │   └── utils/
  │       ├── rpc.ts         # jamt CLI wrapper
  │       └── encoding.ts    # Hex/binary encoding helpers
  └── README.md
  ```
- [x] **1.3** Set up client dependencies (TypeScript, tsx runner)
- [x] **1.4** Updated `.gitignore` for proper project structure
- [x] **1.5** Updated `README.md` with deployment guide

### Key Learnings

- `jamt` CLI requires 6-validator testnet (`polkajam-testnet`), not single dev node
- Service IDs are 8 hex chars without `0x` prefix for jamt commands
- `--chain dev` flag must come BEFORE the subcommand: `polkajam --chain dev run`

---

## Phase 2: Hash Verification Proof-of-Concept ✅ COMPLETE

**Goal:** Establish the end-to-end refine→accumulate flow before introducing real ZK proofs.

### Completed Tasks

- [x] **2.1** Updated `src/lib.rs` with Blake2s-256 hash verification:
  ```rust
  // Payload format: [32 bytes expected_hash] + [N bytes preimage]
  // Result codes: 0x01 = valid, 0x00 = invalid, 0xE1 = payload too short

  fn refine(payload: WorkPayload) -> WorkOutput {
      let expected_hash = &payload[..32];
      let preimage = &payload[32..];
      let computed = blake2s256(preimage);
      let is_valid = computed == expected_hash;
      return [result_code, computed_hash...];
  }
  ```

- [x] **2.2** Updated `accumulate()` to store results:
  ```rust
  fn accumulate(item_count: usize) -> Option<Hash> {
      let count = get_storage(b"count") + item_count;
      set_storage(b"count", count);
      set_storage(b"status", b"accumulated");
      None
  }
  ```

- [x] **2.3** Implemented `client/src/hash-verify.ts`:
  ```bash
  # Submit valid verification
  npx tsx src/hash-verify.ts "hello world"

  # Submit tampered verification (intentionally fails)
  npx tsx src/hash-verify.ts "hello world" --tamper
  ```

- [x] **2.4** Implemented `client/src/query-state.ts`:
  ```bash
  npx tsx src/query-state.ts count
  npx tsx src/query-state.ts status
  ```

- [x] **2.5** Deployed and tested end-to-end:
  1. Started testnet: `./polkajam-nightly/polkajam-testnet`
  2. Deployed service: `./polkajam-nightly/jamt create-service zk-jam-service.jam`
  3. Submitted verifications via CLI
  4. Observed pipeline in `jamtop`

### Deliverables

- ✅ Working hash verification service (ID: `99fbfec5`)
- ✅ CLI client for submission and queries
- ✅ Tamper flag for testing failure paths

---

## Phase 2.5: Web Dashboard ✅ COMPLETE (Bonus)

**Goal:** Create a visual interface for demonstration and education.

### Completed Tasks

- [x] **2.5.1** Set up Next.js 14 with App Router
- [x] **2.5.2** Integrated shadcn/ui components (dark theme)
- [x] **2.5.3** Created server actions wrapping jamt CLI (`src/app/actions/jam.ts`)
- [x] **2.5.4** Built four pages:

| Route | Purpose |
|-------|---------|
| `/` | Dashboard with network status, service info, JAM pipeline visualization |
| `/verify` | Interactive hash verification form with tamper checkbox |
| `/explorer` | Slot browser, clickable blocks with verification badges, full history |
| `/learn` | Educational content explaining JAM, Refine/Accumulate, ZK proofs |

- [x] **2.5.5** Implemented local verification history:
  - Stores submissions in localStorage
  - Expandable cards showing payload breakdown
  - Educational display: "bytes 0-31 = expected hash, bytes 32+ = preimage"
  - Stats: total/valid/invalid/pending counts

- [x] **2.5.6** Added pipeline visualization component showing:
  Submit → Refine → Audit → Accumulate flow with animated progress

### Key Features

```
client/web/
├── src/app/
│   ├── page.tsx              # Dashboard
│   ├── verify/page.tsx       # Hash verification form
│   ├── explorer/page.tsx     # Block explorer + history
│   ├── learn/page.tsx        # Educational content
│   ├── actions/jam.ts        # Server actions (jamt wrapper)
│   └── api/network/route.ts  # Network status API
├── src/components/
│   ├── Pipeline.tsx          # Visual pipeline stages
│   ├── VerificationHistory.tsx # Expandable submission cards
│   └── layout/Header.tsx     # Navigation
└── src/lib/
    └── history.ts            # localStorage history store
```

### Running the Dashboard

```bash
cd client/web
npm install
npm run dev
# Open http://localhost:3000
```

---

## Phase 3: ZK Proof Integration 🔄 NEXT

**Goal:** Replace hash verification with real ZK proof verification.

### Research Required

- [ ] **3.1** Evaluate ZK verifier compatibility with JAM:
  - Must compile to `no_std` + PolkaVM (RISC-V 64-bit)
  - Must complete verification within 6-second refine limit
  - Must have deterministic execution across validators

### Option A: RISC Zero (Recommended)

```toml
[dependencies]
risc0-zkvm = { version = "1.0", default-features = false, features = ["verify"] }
```

**Pros:**
- Mature `no_std` verifier
- Active RISC-V development
- Good documentation
- ~100ms verification time

**Cons:**
- Larger proof sizes (~200KB)
- Heavier dependencies

### Option B: SP1 (Succinct)

```toml
[dependencies]
sp1-verifier = { version = "x.x", default-features = false }
```

**Pros:**
- Smaller proofs (~50KB)
- Faster verification (~50ms)
- Rust-native

**Cons:**
- Newer, less battle-tested
- Partial `no_std` support

### Option C: Groth16/SNARK Verifier

```toml
[dependencies]
ark-groth16 = { version = "0.4", default-features = false }
ark-bn254 = { version = "0.4", default-features = false }
```

**Pros:**
- Tiny proofs (~200 bytes)
- Very fast verification (~10ms)
- Well-understood cryptography

**Cons:**
- Requires trusted setup
- More complex circuit development

### Tasks

- [ ] **3.2** Create test ZK circuit (e.g., "I know x such that hash(x) = y")
- [ ] **3.3** Add ZK verifier to `Cargo.toml` with `no_std` features
- [ ] **3.4** Update `src/lib.rs` for ZK proof verification:
  ```rust
  fn refine(payload: WorkPayload) -> WorkOutput {
      let proof_bytes = payload.take();
      let proof = deserialize_proof(&proof_bytes)?;
      let public_inputs = extract_public_inputs(&proof);
      let is_valid = verify_proof(&proof, &public_inputs)?;
      // Return verification result
  }
  ```
- [ ] **3.5** Create proof generation tooling:
  - Off-chain prover in separate crate or TypeScript
  - Test vectors for verification
- [ ] **3.6** Update web dashboard for ZK proof submission:
  - File upload for proof data
  - Display public inputs
  - Show verification gas/time

### Deliverables

- [ ] JAM service verifying real ZK proofs
- [ ] Proof generation tooling
- [ ] Updated dashboard with ZK-specific UI

---

## Phase 4: Production Hardening 📋 PLANNED

**Goal:** Make the service robust and production-ready.

### Tasks

- [ ] **4.1** Error handling:
  - Graceful handling of malformed proofs
  - Detailed error codes in WorkOutput
  - Client-side error parsing

- [ ] **4.2** Performance optimization:
  - Profile refine() gas usage
  - Optimize verification hot paths
  - Benchmark against 6-second limit

- [ ] **4.3** State management:
  - Efficient storage schema (avoid unbounded growth)
  - Proof registry with expiration
  - Query historical verifications

- [ ] **4.4** Monitoring & observability:
  - Verification success/failure metrics
  - Gas usage tracking
  - Alert on anomalies

- [ ] **4.5** Security audit:
  - Review proof deserialization for panics
  - Ensure deterministic behavior
  - Fuzz testing with malformed inputs

### Deliverables

- [ ] Production-ready ZK verification service
- [ ] Comprehensive test suite
- [ ] Security documentation

---

## Phase 5: Advanced Features 🔮 FUTURE

- [ ] **5.1** Batch proof verification (multiple proofs per work item)
- [ ] **5.2** Proof aggregation (combine multiple proofs into one)
- [ ] **5.3** Cross-service communication (verify proofs for other services)
- [ ] **5.4** Token-gated verification (require payment/stake)
- [ ] **5.5** Verification receipts (on-chain attestation of valid proof)
- [ ] **5.6** Recursive proofs (proofs that verify other proofs)

---

## Technical Reference

### JAM Constraints

| Constraint | Limit | Implication |
|------------|-------|-------------|
| Refine time | ~6 seconds | ZK verification must complete within this |
| Refine memory | ~2GB | Limits proof size and verifier memory |
| Accumulate time | <10ms | State updates must be fast, no heavy computation |
| Work payload size | ~5MB | May limit proof size for larger proof systems |
| Storage per key | ~4KB | Efficient encoding required |

### Proof Systems Comparison

| System | no_std | Proof Size | Verify Time | Trusted Setup | Best For |
|--------|--------|------------|-------------|---------------|----------|
| RISC Zero | ✅ | ~200KB | ~100ms | No | General computation |
| SP1 | Partial | ~50KB | ~50ms | No | General computation |
| Groth16 | ✅ | ~200B | ~10ms | Yes | Known circuits |
| Plonk | ✅ | ~500B | ~20ms | Universal | Known circuits |
| STARKs | ✅ | ~50KB | ~50ms | No | Large computations |

### Payload Format (Current: Hash Verification)

```
┌──────────────────────────────────────────────────────────────┐
│                      Work Payload                             │
├───────────────────────────────┬──────────────────────────────┤
│     Expected Hash (32 bytes)  │      Preimage (N bytes)      │
│        bytes 0-31             │         bytes 32+            │
└───────────────────────────────┴──────────────────────────────┘

Example: "hello" → payload = 0x19213b... (32 bytes) + 0x68656c6c6f (5 bytes)
```

### Payload Format (Future: ZK Proof)

```
┌──────────────────────────────────────────────────────────────┐
│                      Work Payload                             │
├────────────────┬─────────────────────┬───────────────────────┤
│  Version (1B)  │  Public Inputs (N)  │    Proof Data (M)     │
└────────────────┴─────────────────────┴───────────────────────┘
```

### Result Codes

| Code | Meaning |
|------|---------|
| `0x01` | Valid - verification passed |
| `0x00` | Invalid - verification failed |
| `0xE1` | Error - payload too short |
| `0xE2` | Error - malformed proof (future) |
| `0xE3` | Error - unsupported proof type (future) |

---

## Current File Structure

```
zk-jam-service/
├── Cargo.toml                    # Rust dependencies (blake2)
├── Cargo.lock
├── src/
│   └── lib.rs                    # JAM service: refine + accumulate
├── zk-jam-service.jam            # Compiled PolkaVM blob
│
├── client/                       # CLI tooling
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── config.ts
│   │   ├── hash-verify.ts        # Submit hash verifications
│   │   ├── submit-proof.ts       # (Future) Submit ZK proofs
│   │   ├── query-state.ts        # Query service storage
│   │   ├── monitor.ts            # Watch network activity
│   │   └── utils/
│   │       ├── rpc.ts
│   │       └── encoding.ts
│   └── README.md
│
├── client/web/                   # Web dashboard
│   ├── package.json
│   ├── next.config.ts
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Dashboard
│   │   │   ├── verify/page.tsx   # Hash verification
│   │   │   ├── explorer/page.tsx # Block explorer
│   │   │   ├── learn/page.tsx    # Educational content
│   │   │   ├── actions/jam.ts    # Server actions
│   │   │   └── api/network/      # API routes
│   │   ├── components/
│   │   │   ├── Pipeline.tsx
│   │   │   ├── VerificationHistory.tsx
│   │   │   └── ui/               # shadcn components
│   │   └── lib/
│   │       ├── history.ts        # localStorage store
│   │       └── utils.ts
│   └── README.md
│
├── polkajam-nightly/             # PolkaJam binaries (gitignored)
│   ├── polkajam                  # Single-node runner
│   ├── polkajam-testnet          # 6-validator testnet
│   ├── jamt                      # CLI tool
│   └── jamtop                    # TUI monitor
│
├── README.md                     # Project documentation
├── zk-proof-testing-plan.md      # This file
└── .gitignore
```

---

## Quick Commands Reference

```bash
# Start 6-validator testnet
./polkajam-nightly/polkajam-testnet

# Monitor network (separate terminal)
./polkajam-nightly/jamtop

# Deploy/update service
./polkajam-nightly/jamt create-service zk-jam-service.jam

# Submit hash verification (CLI)
cd client && npx tsx src/hash-verify.ts "your message"
cd client && npx tsx src/hash-verify.ts "your message" --tamper

# Query storage
cd client && npx tsx src/query-state.ts count

# Run web dashboard
cd client/web && npm run dev
```

---

## Resources

- [JAM Graypaper](https://graypaper.com) - JAM specification
- [Polkadot Wiki - JAM](https://wiki.polkadot.network/docs/learn-jam-chain) - Overview
- [RISC Zero Docs](https://dev.risczero.com) - ZK proving system
- [SP1 Docs](https://docs.succinct.xyz) - Alternative ZK system
- [jam-pvm-common](https://docs.rs/jam-pvm-common) - JAM Rust SDK
- [blake2 crate](https://docs.rs/blake2) - Hash function used

---

## Changelog

| Date | Phase | Summary |
|------|-------|---------|
| 2024-12-24 | 1 | Project cleanup, CLI client setup |
| 2024-12-24 | 2 | Blake2s hash verification implemented |
| 2024-12-24 | 2.5 | Web dashboard with history tracking |
| TBD | 3 | ZK proof integration |
