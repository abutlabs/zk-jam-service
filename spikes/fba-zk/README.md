# Spike: zk FBA matcher — verify a batch clearing in `refine` (option 1)

**Question:** options 2/3 run the match on-chain (or per-order verifiable decryption), so cost
grows with the order count — encrypt-until-batch is ~n·5.6M gas/order, bounding a batch to
~880/n orders (`spikes/vdec-gas`). The zk-rollup answer: run the auction **off-chain**, prove
it cleared correctly, and have `refine` verify **one Groth16 proof** regardless of batch size.
Does an FBA-clearing proof verify on lasair, and at what cost?

**Answer: yes — one proof settles the whole batch at 60.1M gas (1.20% of G_R full),
independent of order count. Measured e2e 2026-07-02.**

| | |
|---|---|
| FBA-clearing proof verify (N=4 batch, 4 public inputs) | **~60.08M gas** |
| … as fraction of G_R full (5e9) | **1.20 %** |
| cost vs batch size | **flat** — 4 orders or 4000, same one verify |
| on-chain footprint per batch | commitments + price + volume (orders never appear) |
| tampered settlement (inflated volume, same proof) | **rejected** ✓ |

Contrast: per-order verifiable decryption (option 2) costs ~n·5.6M gas *per order*. A single
batch proof beats it above ~10–20 orders, and stays flat where option 2 scales linearly — this
is the crossover the vdec spike predicted.

## What the circuit proves

Statement (fixed batch of N orders), in zero knowledge:

> "I know N orders (side, price, qty) hashing to the public `orders_commitment`, and N fills
> hashing to `fills_commitment`, such that at the public uniform price `p*`: every filled order
> is **marketable** (buys with price ≥ p*, sells with price ≤ p*), every fill is **within its
> order's qty**, and total buy fills == total sell fills == public `volume`."

Public inputs: `[orders_commitment, price, volume, fills_commitment]` — the chain (and any
front-runner) sees only these; the individual orders stay hidden, so the prover is a dark-pool
matcher. Comparisons use a bit-decomposition gadget (`ge`) sound for values < 2^40.

**Proven — settlement validity:** a prover CANNOT fabricate fills (they must hash to the
committed fills), fill an unmarketable order (`fill·(1−marketable)=0`), exceed an order's qty,
or break base conservation (`Σ buy fills = Σ sell fills = volume`). These are the properties
that let a chain trust an off-chain match.

**Proven — price optimality:** `p*` achieves the **maximum matchable volume** (the FBA
uniqueness property), so a matcher cannot under-fill to favour anyone. `V(p) = min(demand(p),
supply(p))` changes value only at order limit prices, so its global maximum over all prices
equals its maximum over the order prices. The circuit enforces `volume >= V(p_j)` for every
order price `p_j` (an O(N²) pass computing each candidate's demand/supply and their min inside
the circuit); combined with `volume <= V(p*)` (which marketability + conservation already give),
this forces `volume == max_p V(p)`. Verified two ways: the honest optimal clearing satisfies the
circuit, and a **suboptimal** clearing (e.g. `p*=105` filling only 5 when 8 was matchable at 100)
is **unsatisfiable** — asserted directly against the ConstraintSystem in `circuit/`. The optimality
pass adds constraints (off-chain proving time) but **not public inputs**, so the refine verify
gas is unchanged (~60M, measured before and after).

## Architecture (the JAM-side win)

`refine` verifies **one** proof and emits a constant-size output `[valid, price, volume,
orders_commitment, fills_commitment]`; `accumulate` records the settlement **O(1) per batch**
(`last_price`, `last_volume`, `cum_volume`, `rounds`, `last_batch` commitment). Nothing scales
with the number of orders — the batch bound becomes work-package **input size** (~25k–69k
orders, `jamswap/docs/LASAIR_INTERNALS.md` Q9), not gas. This is also **option 2's scaling
answer**: fold the committee decryption *and* the matching into one proof and the per-order
verifiable-decryption cost disappears.

To wire this into jamswap: bind `orders_commitment` to the on-chain sealed-order set (the same
consume-or-reject check the `ENC_ROUND`/`REVEAL` paths already do), so the proof is over exactly
the committed orders. That integration is the follow-up; this spike proves the verify + cost.

## Layout & reproduce

- `circuit/` — the R1CS circuit + host prover (arkworks Groth16/BN254, Poseidon commitments).
  `cargo run --release` proves the sample batch, checks an inflated-volume lie fails, and writes
  `artifacts/{vk,submission,submission_bad}.bin`.
- `fba-service/` — the no_std JAM service; `refine` verifies + emits the settlement, `accumulate`
  records it. Embeds `vk.bin`. `min_stack_size!(4 MiB)` for the BN254 pairing.

```sh
cd circuit && cargo run --release && cp artifacts/vk.bin ../fba-service/vk.bin
cd ../fba-service && jam-pvm-build          # -> fba-service.jam
docker run -d --name fbabench -p 19904:19900 ghcr.io/abutlabs/lasair-node:latest
JAM=fba-service/fba-service.jam ART=circuit/artifacts LASAIR_RPC=http://127.0.0.1:19904 python3 bench.py
docker rm -f fbabench
```

## Caveats / honesty

- Measured via lasair's single-node in-process refine path (real PVM + gas model), published
  `lasair-node` image — same rig as the Groth16/vdec spikes.
- N=4 fixed batch for the spike; a production circuit fixes a larger N (padding empty slots) or
  uses a recursive/aggregation layer. Verify cost is ~flat in N (public inputs grow slightly).
- Fixed-seed trusted setup (demo) — a real deployment needs a proper ceremony or a
  universal-setup system (a PLONK gas spike is the open item for that).
- Optimality, settlement-validity, and conservation are all enforced (see above). The open circuit work is larger N (batch size) and a universal setup (PLONK) — not correctness.
