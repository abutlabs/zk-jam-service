# my-jam-service

A minimal JAM (Join-Accumulate Machine) service demonstrating the new Polkadot compute paradigm.

## Project Structure

```
my-jam-service/
├── .gitignore              # Ignores /target/, /node_modules/, etc.
├── Cargo.toml              # Rust dependencies & metadata
├── src/
│   └── lib.rs              # JAM service logic (refine + accumulate)
├── client/                 # TypeScript client tooling
│   ├── src/
│   │   ├── submit-proof.ts # Submit work items to the service
│   │   ├── query-state.ts  # Query service state
│   │   └── monitor.ts      # Monitor network activity
│   └── README.md           # Client documentation
├── my-jam-service.jam      # Compiled PVM blob (after build)
├── zk-proof-testing-plan.md # Roadmap for ZK integration
└── README.md
```

## What is JAM?

JAM is Polkadot's next-generation architecture that separates **computation** from **state updates**:

- **Refine** (Off-chain): Heavy computation runs on a small set of validator cores (~6 seconds limit)
- **Accumulate** (On-chain): Fast state updates run on all validators (<10ms limit)

This enables a "World Judge" model where you can run expensive computation off-chain (or on your own servers) and use JAM to **verify** the results trustlessly.

## The Breakthrough

Traditional blockchains: "Every node runs every computation"

JAM: "A few nodes compute, everyone else validates"

This means you can:
- Run a ZK proof aggregator for 10 minutes on your server
- Submit the result to JAM
- JAM verifies it in milliseconds and finalizes on-chain


## Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add the RISC-V target
rustup target add riscv64imac-unknown-none-elf

# Install the JAM PVM build tool
cargo install jam-pvm-build

# Install required nightly components
rustup component add rust-src --toolchain nightly-2025-05-10
```

## Getting Started

### Step 1: Build the JAM Service

```bash
# Build the .jam blob (compiles Rust to PolkaVM bytecode)
jam-pvm-build
```

This produces `my-jam-service.jam` (~19KB) - your compiled service.

### Step 2: Download PolkaJam

Download the PolkaJam binary for your system from [PolkaJam Releases](https://github.com/parity-tech/polkajam/releases):

```bash
# Example for macOS ARM64
curl -LO https://github.com/parity-tech/polkajam/releases/download/nightly/polkajam-nightly-macos-aarch64.tar.gz
tar -xzf polkajam-nightly-macos-aarch64.tar.gz
mv polkajam-nightly-* polkajam-nightly
```

### Step 3: Run a Local Testnet

The `jamt` tool requires a multi-validator network. Use `polkajam-testnet` to spin up a 6-validator local testnet:

```bash
# Terminal 1: Start the testnet (spawns 6 validators)
./polkajam-nightly/polkajam-testnet
```

This starts 6 validator nodes (node0-node5) that automatically discover each other. Wait until you see:
- `Sync complete` messages
- `Net status: 5 peers (5 vals)` on each node
- Blocks being authored and finalized

The first node exposes:
- **RPC endpoint**: `ws://localhost:19800`
- **Additional nodes**: ports 19801-19805

### Step 4: Deploy Your Service

Open a new terminal and use `jamt` to deploy:

```bash
# Terminal 2: Create the service on-chain
./polkajam-nightly/jamt create-service my-jam-service.jam
```

**Options:**
```bash
# With initial token endowment
./polkajam-nightly/jamt create-service my-jam-service.jam 1000000

# With custom gas limits
./polkajam-nightly/jamt create-service my-jam-service.jam \
  --min-item-gas 2000000 \
  --min-memo-gas 1000000
```

On success, you'll receive a **Service ID** (e.g., `0c7bb62b`). Save this!

### Step 5: Submit a Work Item

Test your service by sending a work item:

```bash
# Submit payload "hello" to your service (use your service ID)
./polkajam-nightly/jamt item <service_id> "hello"

# Or with hex payload
./polkajam-nightly/jamt item <service_id> 0x48656c6c6f
```

**What happens:**
1. Your payload enters the **Refine** stage (off-chain computation)
2. The `refine()` function processes it (increments each byte by 1)
3. Results move to **Accumulate** stage (on-chain state update)
4. The `accumulate()` function runs, setting `status = "processed"`

### Step 6: Monitor with jamtop (Optional)

```bash
# Real-time node monitoring
./polkajam-nightly/jamtop
```



## Quick Reference

| Command | Description |
|---------|-------------|
| `polkajam-testnet` | Start 6-validator local testnet |
| `jamt create-service <code.jam>` | Deploy a new service |
| `jamt item <service_id> <payload>` | Submit work to a service |
| `jamt transfer <to> <amount>` | Transfer tokens |
| `jamt inspect` | Get block information |
| `jamtop` | Real-time monitoring dashboard |

## TypeScript Client

The `client/` directory contains TypeScript tooling for interacting with your deployed service.

```bash
cd client
npm install

# Query your service
JAM_SERVICE_ID=0c7bb62b npm run query

# Query specific storage
JAM_SERVICE_ID=0c7bb62b npm run query -- --key status

# Monitor network
npm run monitor
```

See [`client/README.md`](./client/README.md) for full documentation.


## Architecture: The Coprocessor Model

For heavy workloads (like ZK proof aggregation), use JAM as a **verifier**:

```
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1: Your Server (True Off-Chain)                          │
│  - Unlimited time and RAM                                       │
│  - Run heavy computation (ZK aggregation, ML training)          │
│  - Generate proof/result                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 2: JAM Refine (Verifier)                                  │
│  - 6 second limit, RISC-V environment                           │
│  - Verify the proof (fast operation)                            │
│  - Pass receipt to Accumulate                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 3: JAM Accumulate (Settlement)                            │
│  - Update global state                                          │
│  - Finality achieved                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Use Cases

- **ZK-Rollup Verification**: Verify aggregated proofs from Aztec, zkSync, etc.
- **AI Inference Verification**: Prove an LLM ran correctly
- **Data Processing**: Verify large dataset transformations
- **Game State**: Process complex game logic off-chain, settle on-chain

## Key Concepts

### `#![no_std]` Environment
JAM services run without the standard library - no filesystem, no networking, no OS. Use `alloc` for dynamic memory.

### Core Verification

  Refine (lines 35-70) - The Heavy Lifting

```
  fn refine(..., payload: WorkPayload, ...) -> WorkOutput {
      let data = payload.take();

      // 1. Validate payload size
      if data.len() < HASH_SIZE + 1 {
          return error_response();  // Need at least 33 bytes
      }

      // 2. Split the payload
      let expected_hash = &data[..32];      // First 32 bytes
      let preimage = &data[32..];           // Everything after

      // 3. Re-compute the hash
      let mut hasher = Blake2s256::new();
      hasher.update(preimage);
      let computed_hash = hasher.finalize();

      // 4. Compare!
      let is_valid = computed_hash.as_slice() == expected_hash;

      // 5. Return: [result_code] + [computed_hash]
      //    0x01 = valid, 0x00 = invalid
      [is_valid as u8, ...computed_hash]
  }
```

  Accumulate (lines 79-97) - State Update

```
  fn accumulate(..., item_count: usize, ...) -> Option<Hash> {
      // Increment verification counter
      let count = get_storage(b"count").unwrap_or(0);
      set_storage(b"count", count + item_count);

      set_storage(b"status", b"accumulated");
      None
  }

  The Flow

  Client sends: [0x1a213b... (corrupted hash)] + ["hello"]
                            ↓
               ┌────────────────────────────┐
     REFINE    │ hash("hello") = 0x19213b... │  ← runs on 1 validator core
               │ 0x19213b ≠ 0x1a213b         │    (up to 6 seconds)
               │ return [0x00, 0x19213b...]  │
               └────────────────────────────┘
                            ↓
               ┌────────────────────────────┐
   ACCUMULATE  │ count += 1                  │  ← runs on ALL validators
               │ status = "accumulated"      │    (must be <10ms)
               └────────────────────────────┘
```

  The key insight: refine does the actual hash computation and comparison (expensive), while accumulate just records the result (cheap and fast).

### Host Calls
Interact with the blockchain via host calls in the `accumulate` module:
- `set_storage()` / `get_storage()` - Read/write persistent state
- `transfer()` - Send tokens to other services

### Work Packages
Data submitted to your service arrives as a `WorkPayload`. Your `refine` function processes it and returns a `WorkOutput`.

## Resources

- [JAM Graypaper](https://graypaper.com) - The technical specification
- [jam-pvm-common docs](https://docs.rs/jam-pvm-common) - Rust SDK documentation
- [PolkaJam Releases](https://github.com/parity-tech/polkajam/releases) - Node binaries


## License

Apache-2.0
