# Spike: verifiable committee decryption in `refine` (encrypt-until-batch, option 2)

**Question:** jamswap's sealed orders today use commit–reveal (option 3): a hash goes
on-chain, then the owner *reveals* the order into the auction. That has a reveal round
and a non-reveal griefing vector. **Option 2 — encrypt-until-batch — removes both:**
traders encrypt orders to a committee key; at batch close the committee decrypts and
refine settles, with no per-owner reveal. But a JAM service can never hold a key
(`jamswap/docs/LASAIR_INTERNALS.md` Q5), so the hard part is: **can refine verify the
committee decrypted correctly, without knowing the secret — and what does it cost?**

**Answer: yes, and it's affordable for modest batches. Measured on lasair 2026-07-02.**

| committee n | honest refine_gas | per-member marginal | tampered (must reject) |
|---|---|---|---|
| 1 | 5,335,909 | — | 00 ✓ rejected (5.31M) |
| 2 | 10,930,635 | +5,594,726 | 00 ✓ rejected |
| 3 | 16,605,280 | +5,674,645 | 00 ✓ rejected |
| 5 | 27,539,976 | +5,467,348 | 00 ✓ rejected |

**Per-order cost ≈ n × 5.6M gas** (one Chaum-Pedersen verify per committee member).
At the full refine budget G_R = 5e9 that bounds a per-order-verified batch to roughly
**~880 orders with a 1-member decryptor, ~180 with a 5-member committee** — hundreds,
not the tens-of-thousands the input size allows. Verifiable decryption is the cost
driver, exactly as per-order signatures are in the plaintext path (Q7). For scale:
one order's 5-member decrypt (~28M) ≈ half a Groth16 verify (56M) — which is the
signpost to option 1 below.

## The scheme (sound, and proven e2e)

Additive n-of-n committee over BN254 G1 (`vdec-core/`):

- **setup** — member `i` holds `sk_i`, publishes `PK_i = sk_i·G`; joint `PK = Σ PK_i`.
- **encrypt** (trader) — `C1 = r·G`, shared `S = r·PK`, keystream `k = KDF(S)`,
  `body = order ⊕ k`. On-chain ciphertext = `(C1, body)`. Nothing else is ever public.
- **decrypt** (committee, off-protocol) — member `i` returns partial `S_i = sk_i·C1`
  **with a Chaum-Pedersen proof** that `(G, PK_i, C1, S_i)` is a DDH tuple
  (`dlog_G PK_i = dlog_C1 S_i`). Then `S = Σ S_i = sk·C1`, `order = body ⊕ KDF(S)`.
- **verify** (refine, in-PVM) — checks every partial's proof against the **committed**
  `PK_i`, sums the proven `S_i`, derives `k`, and recovers the order **itself**. No
  secret enters refine; a malicious committee cannot lie about the plaintext (the proof
  binds `S_i` to the committed key), and there is **no reveal round**.

Soundness is proven two ways:
- **Host unit tests** (`cargo test -p vdec-core`): honest roundtrip recovers the order
  (n=1..3); a tampered response is rejected; a share not matching the committed `PK_i`
  is rejected; fewer than n partials cannot decrypt (n-of-n liveness).
- **e2e on a fresh lasair-node** (`bench.py`): the honest payload outputs `01 ‖ order`
  (the real 17-byte order recovered); the tampered payload outputs `00` (round
  rejected) at every n. Same old-vs-new discipline as the builder-injection fix.

## What this proves for jamswap / the privacy ladder

1. **Option 2 is real and needs ZERO lasair changes** — all service + off-protocol
   sidecar, confirming LASAIR_INTERNALS.md Q4. The committee uses **fresh keys, not
   validator consensus keys**; refine stays a pure function of public inputs.
2. **It removes the reveal round and non-reveal griefing** of option 3: an order that
   is never decrypted simply stays encrypted (the committee didn't reach threshold or
   the builder didn't include it) — no wasted on-chain slot, no owner liveness needed
   at match time.
3. **Cost bounds batches to hundreds of orders per work-package** (n × 5.6M gas), vs the
   ~25k–69k the input size allows. To reach thousands you fold the decryption+matching
   into ONE off-chain proof (option 1): prove "these ciphertexts decrypt to these orders
   under the committee key, and clear at price p*" and verify a single Groth16 (~56M gas)
   — the convergence point of options 1 and 2. This spike measures the crossover: a ZK
   batch beats per-order verifiable decryption above ~10–20 orders (n≥3).
4. **t-of-n upgrade** is a drop-in: replace the additive `Σ S_i` with Lagrange-in-the-
   exponent over Shamir shares. The per-partial Chaum-Pedersen proof and this refine
   verify path are **identical**, so the measured per-member cost holds; only the
   sidecar's share generation changes. (This pilot is n-of-n for liveness simplicity.)

## Layout

- `vdec-core/` — no_std crypto shared by refine and the sidecar: encrypt, partial-decrypt
  + proof, `verify_and_decrypt`. Host tests prove soundness.
- `vdec-service/` — the no_std JAM service; refine calls `verify_and_decrypt` and outputs
  `01‖order` / `00`. `min_stack_size!(4 MiB)` for BN254 scalar mults.
- `committee/` — std sidecar (`gen-round <n>`): keygen, encrypt, produce proven partials,
  emit the honest + tampered refine payloads for the bench.

## Reproduce

```sh
cargo test -p vdec-core                         # soundness (host)
cd committee && cargo build --release           # -> target/release/gen-round
cd ../vdec-service && jam-pvm-build              # -> vdec-service.jam
docker run -d --name vdecbench -p 19902:19900 ghcr.io/abutlabs/lasair-node:latest
GEN=committee/target/release/gen-round JAM=vdec-service/vdec-service.jam \
  LASAIR_RPC=http://127.0.0.1:19902 python3 bench.py
docker rm -f vdecbench
```

## Caveats / honesty

- Measured via lasair's single-node in-process refine path (real PVM + gas model),
  published `lasair-node` image — same rig as the Groth16 and crypto-gas spikes.
- n-of-n (all members required) for the pilot; t-of-n is the noted drop-in for fault
  tolerance. The committee is trusted for **liveness** (it can withhold decryption =
  censorship) but NOT for **correctness** (the DDH proof forces honest plaintext).
- One order per payload here to isolate per-order cost; a batch is `Σ` over orders and
  is refine-gas-bound at ~880/n orders. The ciphertext `(C1, body)` = 32 + order_len
  bytes on-chain; the decryption bundle fed to refine is n × 96 bytes/order.
- KDF/Fiat-Shamir use Blake2s (measured 2,759 gas — negligible next to the scalar mults).
- This proves *decryption verification* is affordable. Order privacy still rests on the
  committee not colluding to decrypt early — the honest-majority (here honest-all)
  assumption inherent to every threshold-encryption MEV design (Shutter, Penumbra).
