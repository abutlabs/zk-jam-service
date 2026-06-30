# Gas spike: a full Groth16 SNARK verify inside a JAM `refine()`

**Question (BLUEPRINT.md §5):** can a JAM service verify a real zk-SNARK in `refine`,
or does it blow the gas budget? JAM has **zero crypto host calls**, so the verifier
must compile into the `.jam` blob as pure `no_std` Rust and pay out of refine gas
(G_R = 5e9 full / 1e9 tiny).

**Answer: YES, comfortably.** Measured in lasair's PVM:

| | |
|---|---|
| Groth16/BN254 verify, **untrusted** proof (subgroup-checked) | **56,149,565 gas** |
| … as fraction of G_R (5e9 full) | **1.12 %** |
| … as fraction of tiny (1e9) | 5.6 % |
| verifies per refine | ~89 full / ~17 tiny |
| `.jam` blob size | **78 KB** (limit W_C = 4 MB) |
| compiles to PVM `no_std`? | yes (arkworks `ark-bn254` + `ark-groth16` 0.5) |
| in-PVM verdict | `valid` ✓ |

→ **Tier B (full zero-knowledge: verify a client-generated proof in refine) is
feasible.** Build it.

## What's here

- `gen-proof/` — host (std) binary. Builds a trivial circuit `a*b=c` (c public),
  runs Groth16 setup+prove on BN254, writes compressed `vk.bin` / `proof.bin` /
  `public.bin`.
- `groth16-service/` — the `no_std` JAM service. Embeds those artifacts and
  verifies in `refine()` (VK unchecked = trusted/embedded; **proof checked** =
  untrusted user input). `min_stack_size!(4 MiB)` — the BN254 pairing overflows
  the default polkavm stack.

## Reproduce

```sh
cd gen-proof && cargo run --release          # -> ../artifacts/{vk,proof,public}.bin
cd ../groth16-service && cp ../artifacts/*.bin . && jam-pvm-build   # -> groth16-service.jam
# deploy to a lasair-node and read refine_gas:
#   POST /v1/service {jam_hex}          -> service_id
#   POST /v1/service/<id>/item {payload_hex:"00"}  -> {verdict:"valid", refine_gas: ~56,000,000}
```

## Two lasair fixes this surfaced (committed separately)

Both are needed for *any* heavy refine (not just this spike):
1. **PVM guest stack** — BN254 pairing needs a bigger stack than polkavm's default
   (`min_stack_size!` in the service; a panic mid-pairing without it).
2. **lasair refine caps were below G_R** — `conformance/refine.ml` hard-capped refine
   at 10M steps, and `node_rpc` defaulted the work-item refine budget to 10M gas.
   Both raised to the real gas budget (steps now bounded by `ri_gas_limit`; node
   refine budget defaults to G_R-full, env `LASAIR_REFINE_GAS`).

## Caveats / honesty

- Measured via the single-node in-process refine path (lasair's real PVM + gas
  model), tiny spec. A 1-public-input circuit; more public inputs add a small MSM
  cost per input (cheap relative to the 3 pairings that dominate).
- `gen-proof` uses a fixed RNG seed for reproducibility — **not** for any real key
  (a real deployment needs a proper trusted setup / a universal-setup system).
- This proves *verification* is cheap on JAM. The user still generates the proof
  client-side (as on Aztec); JAM's edge is that verification lives in a cheap,
  abundant in-protocol lane instead of scarce L1 blockspace.
