# Gas spike: in-PVM ed25519 verify + Blake2s hash cost inside a JAM `refine()`

**Question:** JAM has **zero crypto host calls** (confirmed —
`jamswap/docs/LASAIR_INTERNALS.md` Q1), so a service pays for every signature
check and hash out of its own refine gas at 1 gas/instruction. What does that
actually cost? The team carried a remembered figure of "~195k gas per ed25519
verify" that had never been committed to a benchmark. This spike measures it.

**Answer (measured in lasair's PVM, 2026-07-02):**

| Operation (production library) | gas/op | at G_R full (5e9) | at G_R tiny (1e9) |
|---|---|---|---|
| **ed25519-compact verify** (v2, `no_std`) | **1,312,932** | ~3,808 verifies | ~762 verifies |
| **Blake2s256 hash** (64-byte msg, `blake2` 0.10) | **2,759** | ~1.8M hashes | ~362k hashes |

> **Correction:** the real ed25519 verify cost is **~1.31M gas, ~6.7× the
> remembered ~195k**. The old figure was never sourced; treat 1.31M as the number.
> For scale: an ed25519 verify costs ~23× a Groth16/BN254 verify's *per-op*… no —
> the other way: Groth16 verify is 56.1M gas, so **one Groth16 verify ≈ 43 ed25519
> verifies**. Signature checking is cheap relative to a SNARK, but not free.

These are the **same libraries jamswap uses in production** (`ed25519-compact`
for account auth, `blake2` for order commitments), so the numbers are the real
per-op costs a JAM service pays — not a proxy.

## Method (why the numbers are trustworthy)

`crypto-service` runs `count` iterations of one op in `refine`, where `count`
comes from the payload. For ed25519 the keygen + sign happen **once, outside the
loop**, so diffing `refine_gas` across two counts cancels all fixed setup
(deserialize, keygen, sign, loop scaffolding) and isolates the **pure per-op
cost**:

```
per_op = (gas(n2) - gas(n1)) / (n2 - n1)
```

Reproduced three ways, all agreeing on 1,312,932 gas/verify exactly:
- n=10 → 15,771,931 gas; n=110 → 147,065,131 gas  → (Δ/100) = 1,312,932
- n=1 → 3,955,543 gas;   n=3 → 6,581,407 gas       → (Δ/2)  = 1,312,932

The verify genuinely succeeds (not a fast-fail that would understate cost): the
service outputs `count` when every verify returns `Ok`, and `refine_output_hex`
is `01` for count=1, `03` for count=3. Linear scaling (clean 100× / 1000× deltas)
confirms the loop body is the only variable.

## Reproduce

```sh
cd crypto-service && jam-pvm-build            # -> crypto-service.jam
docker run -d --name gasbench -p 19901:19900 ghcr.io/abutlabs/lasair-node:latest
JAM=crypto-service/crypto-service.jam LASAIR_RPC=http://127.0.0.1:19901 python3 bench.py
docker rm -f gasbench
```

Payload wire: `[op:u8][count:u32 LE]`, op 0 = ed25519 verify, op 1 = Blake2s.

## What this means for jamswap / sealed-order trading

- **Per-order signature verification in refine is affordable at batch scale but
  not the free lunch we assumed.** A batch of N signed orders costs N × 1.31M gas
  just for signature checks: ~3,800 orders exhausts the full refine budget on
  signatures alone. The batch is still ultimately **input-bound** (~25k–69k orders
  by bundle size — LASAIR_INTERNALS.md Q9), so signatures become the binding
  constraint somewhere between ~3,800 and the input ceiling.
- **This is the strongest argument for the zk-rollup-matcher direction (option 1):**
  fold signature validity into the off-chain proof and verify **one** Groth16
  proof (56.1M gas) instead of thousands of ed25519 verifies. Break-even is ~43
  orders: above that, a single SNARK is cheaper than per-order signatures.
- **Blake2s commitments are effectively free** (2,759 gas) — the commit–reveal
  path's hashing is not a cost concern at any realistic batch size.

## Caveats / honesty

- Measured via lasair's single-node in-process refine path (real PVM + gas model),
  the `lasair-node` published image, default (tiny→full G_R) budget. Same rig as
  the Groth16 spike.
- ed25519-compact's `verify` does full curve arithmetic regardless of validity, so
  the cost of a *failing* verify is the same order of magnitude (it's not a
  short-circuit). Batch-reject logic can't dodge the gas by feeding bad sigs.
- 64-byte hash message for Blake2s; longer messages add ~per-block cost but the
  commitment path hashes small fixed-size reveals, so 2,759 is representative.
