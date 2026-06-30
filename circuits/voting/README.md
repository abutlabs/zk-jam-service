# Anonymous-voting circuit (Semaphore-lite)

The cryptographic heart of the zk-jam-service pivot (see `../../docs/BLUEPRINT.md`):
a Groth16/BN254 circuit that lets an eligible voter cast a vote **without revealing
which voter they are**, while making double-voting impossible.

## What it proves (in zero knowledge)

> "I know a secret `s` whose commitment `leaf = H(s)` is a leaf of the Merkle tree
> with public root `R`, and the public nullifier `N = H(s, poll_id)` is correctly
> derived" — without revealing `s` or which leaf.

- **Public inputs:** `[root, nullifier, poll_id, vote]` (`vote` is constrained to be
  a boolean — a yes/no ballot).
- **Private witness:** the voter's secret `s`, and the Merkle path (siblings + index
  bits) from `H(s)` to `root`.
- **Hash:** Poseidon over BN254 (rate 2), used for the commitment, the Merkle nodes,
  and the nullifier — SNARK-friendly (blake2 in-circuit would be enormous).

## Why it's anonymous + sybil-resistant

- **Merkle membership** proves the voter is in the eligibility set without revealing
  *which* member → anonymity within the set.
- **The nullifier** `N = H(s, poll_id)` is deterministic per (voter, poll): the same
  voter always produces the same `N` for a poll, so the on-chain registry rejects a
  second vote — but `N` is unlinkable to the voter's commitment without `s`.
- Only `{root, nullifier, vote}` ever go on chain; the identity never does.

## Status — host roundtrip verified

`cargo run --release` builds a 16-member eligibility tree, has member 5 cast a "yes"
vote in poll 42, runs Groth16 setup + prove + verify, and asserts:
- `anonymous vote proof verifies: true`
- `tampered-nullifier proof verifies: false` — soundness: a forged nullifier
  (double-vote attempt) is rejected.

Verify cost is the same ~56M gas the gas spike measured (`../../spikes/groth16-gas/`),
≈1.1% of the JAM refine budget — so this verifies comfortably in a JAM `refine()`.

## Next phases (the service + UX)

1. **`no_std` JAM service** — `refine()` verifies the proof (as the spike does) and
   outputs `[valid][nullifier][poll_id][vote]`; `accumulate()` reads that, rejects a
   re-used nullifier, records it, and increments the tally. (This needs the
   accumulate→refine-output plumbing the current stub lacks.)
2. **Client prover** — wasm/native helper: given the voter's secret + path, generate
   the proof in the browser (client-side, like Aztec — JAM's edge is the cheap
   in-protocol *verification*).
3. **Web UX** — create poll (publish a root over an eligibility set) / cast anonymous
   vote / live tally + spent-nullifier set, replacing the hash/tamper toy.
