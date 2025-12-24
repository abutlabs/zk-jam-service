# my-jam-service

A minimal JAM (Join-Accumulate Machine) service demonstrating the new Polkadot compute paradigm.

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

## Project Structure

```
my-jam-service/
├── Cargo.toml          # Rust dependencies and build config
├── src/
│   └── lib.rs          # The JAM service implementation
└── my-jam-service.jam  # Compiled PVM blob (after build)
```

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

## Building

```bash
# Build the .jam blob
jam-pvm-build
```

Output: `my-jam-service.jam` (~19KB)

## The Service API

JAM services implement the `Service` trait with two core functions:

### `refine()` - The Heavy Lifting

```rust
fn refine(
    _core_index: CoreIndex,
    _item_index: usize,
    _service_id: ServiceId,
    payload: WorkPayload,
    _package_hash: WorkPackageHash,
) -> WorkOutput {
    // Off-chain computation (up to 6 seconds)
    // Example: Verify a ZK proof, process data, run ML inference
    payload.take().iter().map(|b| b.wrapping_add(1)).collect::<Vec<u8>>().into()
}
```

### `accumulate()` - The State Update

```rust
fn accumulate(
    _slot: Slot,
    _service_id: ServiceId,
    _item_count: usize,
) -> Option<Hash> {
    // On-chain state update (must be fast, <10ms)
    set_storage(b"status", b"processed").ok();
    None
}
```

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
