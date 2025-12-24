# ZK Proof Testing Plan for JAM Service

## Overview

This document outlines the plan to evolve `my-jam-service` from a minimal demo into a functional ZK proof verification service running on JAM.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (TypeScript)                              │
│  client/                                                                 │
│  ├── submit-proof.ts    - Submit ZK proofs to the service               │
│  ├── query-state.ts     - Query verification results                    │
│  └── generate-proof.ts  - Generate test proofs (for development)        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ WebSocket RPC (ws://localhost:19800)
┌─────────────────────────────────────────────────────────────────────────┐
│                         JAM NETWORK (PolkaJam)                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  my-jam-service (Service ID: 0x...)                             │    │
│  │                                                                  │    │
│  │  refine():                                                       │    │
│  │    - Deserialize proof from WorkPayload                         │    │
│  │    - Verify ZK proof using no_std verifier                      │    │
│  │    - Return verification result as WorkOutput                   │    │
│  │                                                                  │    │
│  │  accumulate():                                                   │    │
│  │    - Store verification result in service state                 │    │
│  │    - Emit events / update counters                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Project Cleanup & Client Setup

**Goal:** Clean up legacy code and establish the TypeScript client infrastructure.

### Tasks

- [ ] **1.1** Delete `deploy.ts` (superseded by `jamt create-service`)
- [ ] **1.2** Create `client/` directory structure:
  ```
  client/
  ├── package.json
  ├── tsconfig.json
  ├── src/
  │   ├── config.ts          # RPC endpoints, service ID config
  │   ├── submit-proof.ts    # Submit ZK proofs as work items
  │   ├── query-state.ts     # Query service storage
  │   ├── monitor.ts         # Monitor work package lifecycle
  │   └── utils/
  │       ├── rpc.ts         # WebSocket RPC client wrapper
  │       └── encoding.ts    # Hex/binary encoding helpers
  └── README.md
  ```
- [ ] **1.3** Set up client dependencies:
  - `ws` or `@polkadot/api` for WebSocket RPC
  - `commander` for CLI interface
  - TypeScript tooling

### Deliverables
- Clean project structure
- Working RPC client that can query `jamt inspect` equivalent data

---

## Phase 2: Simple Proof-of-Concept (Hash Verification)

**Goal:** Establish the end-to-end flow before introducing real ZK proofs.

### Tasks

- [ ] **2.1** Update `src/lib.rs` to implement hash verification:
  ```rust
  // refine(): Verify that hash(preimage) == expected_hash
  // Input payload: [32 bytes expected_hash] + [N bytes preimage]
  // Output: 1 byte (0x01 = valid, 0x00 = invalid)
  ```
- [ ] **2.2** Update `accumulate()` to store results:
  ```rust
  // Store: verification_count, last_result, last_hash
  ```
- [ ] **2.3** Implement `client/src/submit-proof.ts`:
  ```typescript
  // CLI: npx ts-node submit-proof.ts --preimage "hello" --hash 0x...
  ```
- [ ] **2.4** Implement `client/src/query-state.ts`:
  ```typescript
  // CLI: npx ts-node query-state.ts --key verification_count
  ```
- [ ] **2.5** End-to-end test:
  1. Start testnet
  2. Deploy updated service
  3. Submit hash verification request via client
  4. Query result via client

### Deliverables
- Working hash verification service
- Client can submit and query
- Documented test procedure

---

## Phase 3: ZK Proof Integration (RISC Zero or SP1)

**Goal:** Integrate a real ZK proving system.

### Option A: RISC Zero (Recommended for JAM)
- Mature `no_std` verifier support
- Active development for RISC-V targets
- Good documentation

### Option B: SP1 (Succinct)
- Rust-native
- Growing ecosystem

### Tasks

- [ ] **3.1** Research ZK verifier compatibility:
  - Must compile to `no_std` + `riscv64` target
  - Must fit within JAM's 6-second refine limit
  - Evaluate proof size constraints

- [ ] **3.2** Add ZK verifier dependency to `Cargo.toml`:
  ```toml
  [dependencies]
  risc0-zkvm = { version = "x.x", default-features = false, features = ["verify"] }
  # OR
  sp1-verifier = { version = "x.x", default-features = false }
  ```

- [ ] **3.3** Update `src/lib.rs` for ZK verification:
  ```rust
  fn refine(..., payload: WorkPayload, ...) -> WorkOutput {
      let proof_data = payload.take();
      // Deserialize proof
      // Verify against expected program hash
      // Return result
  }
  ```

- [ ] **3.4** Create proof generation tooling:
  - `client/src/generate-proof.ts` - Generate test proofs off-chain
  - Or separate `prover/` Rust crate for proof generation

- [ ] **3.5** Update client to handle ZK proof format:
  - Serialize proofs correctly
  - Handle larger payload sizes

### Deliverables
- JAM service that verifies real ZK proofs
- Client tooling for proof submission
- Example proof generation workflow

---

## Phase 4: Production Hardening

**Goal:** Make the service robust and production-ready.

### Tasks

- [ ] **4.1** Error handling:
  - Graceful handling of malformed proofs
  - Clear error codes in WorkOutput

- [ ] **4.2** Gas optimization:
  - Profile refine() gas usage
  - Optimize verification hot paths

- [ ] **4.3** State management:
  - Efficient storage schema
  - Proof registry / history

- [ ] **4.4** Client improvements:
  - Retry logic for failed submissions
  - Transaction monitoring
  - Web UI (optional)

- [ ] **4.5** Documentation:
  - API documentation
  - Integration guide
  - Example applications

### Deliverables
- Production-ready ZK verification service
- Comprehensive documentation
- Example integrations

---

## Phase 5: Advanced Features (Future)

- [ ] **5.1** Batch proof verification
- [ ] **5.2** Proof aggregation
- [ ] **5.3** Cross-service communication
- [ ] **5.4** Token-gated verification (require payment)
- [ ] **5.5** Verification receipts / attestations

---

## Technical Considerations

### JAM Constraints

| Constraint | Limit | Implication |
|------------|-------|-------------|
| Refine time | ~6 seconds | ZK verification must complete within this |
| Refine memory | TBD | Proof size and verifier memory usage |
| Accumulate time | <10ms | State updates must be fast |
| Work payload size | TBD | May limit proof size |

### ZK Verifier Requirements

- **Must support `no_std`** - JAM runs without standard library
- **Must compile to RISC-V** - PolkaVM target architecture
- **Deterministic execution** - Same proof must verify identically across validators

### Proof Systems Comparison

| System | no_std Support | Proof Size | Verification Time | Notes |
|--------|---------------|------------|-------------------|-------|
| RISC Zero | Yes | ~200KB | ~100ms | Best JAM compatibility |
| SP1 | Partial | ~50KB | ~50ms | Newer, less tested |
| Groth16 | Yes | ~200B | ~10ms | Requires trusted setup |
| Plonk | Yes | ~500B | ~20ms | Universal setup |

---

## File Structure (Final)

```
my-jam-service/
├── Cargo.toml              # Rust service dependencies
├── src/
│   └── lib.rs              # ZK verification service logic
├── client/                 # TypeScript client tooling
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── config.ts
│   │   ├── submit-proof.ts
│   │   ├── query-state.ts
│   │   ├── generate-proof.ts
│   │   ├── monitor.ts
│   │   └── utils/
│   │       ├── rpc.ts
│   │       └── encoding.ts
│   └── README.md
├── prover/                 # (Optional) Off-chain proof generation
│   ├── Cargo.toml
│   └── src/
│       └── main.rs
├── polkajam-nightly/       # PolkaJam binaries (gitignored)
├── my-jam-service.jam      # Compiled service blob
├── README.md               # Project documentation
├── zk-proof-testing-plan.md # This plan
└── .gitignore
```

---

## Next Steps

1. **Immediate:** Complete Phase 1 (cleanup + client setup)
2. **This week:** Complete Phase 2 (hash verification PoC)
3. **Next:** Evaluate RISC Zero vs SP1 for Phase 3
4. **Milestone:** First successful ZK proof verification on local JAM testnet

---

## Resources

- [JAM Graypaper](https://graypaper.com) - JAM specification
- [RISC Zero Docs](https://dev.risczero.com) - ZK proving system
- [SP1 Docs](https://docs.succinct.xyz) - Alternative ZK system
- [jam-pvm-common](https://docs.rs/jam-pvm-common) - JAM Rust SDK
- [PolkaJam Releases](https://github.com/parity-tech/polkajam/releases) - Node binaries
