# What's actually feasible inside a JAM service (host ABI + gas)

Feasibility study for running real cryptography / ZK inside a JAM `refine()` (a
`.jam` PVM blob), Graypaper v0.7.2, measured against the lasair implementation
(`submodules/lasair`). This is the ground truth the service design
(`USEFUL_SERVICE_DESIGN.md`) is built on.

## 1. Host functions available to a service: no crypto

The JAM guest ABI is **27 host calls (IDs 0–26) + a debug `log` (100)**
(lasair `lib/pvm_host.ml:50-77`, dispatch at `:1774-1798`):

```
0 gas   1 fetch   2 lookup   3 read   4 write   5 info   6 historical_lookup
7 export   8 machine  9 peek  10 poke  11 pages  12 invoke  13 expunge
14 bless  15 assign  16 designate  17 checkpoint  18 new  19 upgrade
20 transfer  21 eject  22 query  23 solicit  24 forget  25 yield  26 provide
100 log
```

**None are cryptographic.** No blake2/keccak, no ed25519/bandersnatch, no
BLS/BN254/pairing, no ecrecover. The host's only hashing is internal (export /
segment commitments) and not guest-reachable. `lookup`/`solicit`/`query` take a
hash as a *key*, they don't compute one. lasair's `bandersnatch_ffi` / `ed25519_ffi`
are consensus-side internals, not guest ECALLIs.

**Consequence:** every primitive a service uses must be compiled into the blob as
pure `no_std` Rust and paid for in gas — exactly as the current service does with
the in-blob `blake2` crate (no host call).

## 2. Gas budgets (GP 0.7.2)

From lasair `lib/spec.ml:37-38,55-56,74-76` and `lib/pvm_host.ml:101-102,113`:

| Constant | Symbol | tiny | full (production) |
|---|---|---|---|
| Max refine gas | G_R | 1,000,000,000 | **5,000,000,000** |
| Max accumulate gas / service | G_A | 10,000,000 | 10,000,000 |
| Max accumulate gas / block | G_T | 20,000,000 | 3,500,000,000 |
| Max service code size | W_C | — | 4,000,000 bytes |

PolkaVM charges per instruction (naive model = 1 gas/instr,
`polkavm-gp07/crates/polkavm/src/gas.rs:103-109`); host calls cost ~10 gas
baseline. So `refine` ≈ **5 billion instruction-equivalents** vs `accumulate`
≈ **10 million** — a ~500× asymmetry. Heavy verification must live in `refine`;
`accumulate` should do nothing but a `write`/`yield` of a small result.

## 3. Feasibility ranking (in-blob, no host crypto, ≤4 MB)

| Rank | Capability | Verdict |
|---|---|---|
| 1 | Hash-preimage / commitment | ✅ trivial (already shipped) |
| 2 | Merkle-inclusion proof verify | ✅ easy — N hashes up a path, well within G_R |
| 3 | ed25519 / Schnorr verify | ✅ feasible in refine (curve25519 lighter than BLS) |
| 4 | Batch verifiable-compute / rollup | ⚠️ scales linearly with batch size vs G_R |
| 5 | Full zk-SNARK (Groth16/PLONK pairings) | ⚠️ plausible but **unvalidated** — needs a gas spike |

The §5 (rank 5) uncertainty: a Groth16 verify is ~3 pairings + a few MSMs; on the
naive model it likely fits G_R by 2–3 orders of magnitude and fits the 4 MB blob,
but 384-bit (BLS12-381) / 254-bit (BN254) Montgomery arithmetic on RV64IMAC plus
the *production* (weighted) cost model could erode the margin. **No benchmark
exists yet** — hence the spike before we promise true ZK (Tier B).

## Bottom line

Real ZK *verification* in a JAM service is feasible because `refine`'s budget is
huge and the blob can carry pure-Rust arkworks — but the host ABI gives **zero**
crypto help, so everything is in-blob compute, and the full-SNARK tier is
"probable, not proven" until measured.
