# voting-service — anonymous, sybil-resistant voting on JAM

The `no_std` JAM service that turns the [voting circuit](../../circuits/voting) into
a real on-chain application: a voter proves, in zero knowledge, that they belong to
an eligibility set and casts a yes/no vote **without revealing who they are**, and
the chain maintains a tally that **cannot be double-voted**.

This is the genuinely-useful replacement for the old hash-verify toy (see
[`../../docs/BLUEPRINT.md`](../../docs/BLUEPRINT.md)).

## How it works

**One poll per deployment.** The verifying key, the eligibility Merkle root, and the
poll id are baked into the blob (`vk.bin` / `root.bin` / `poll_id.bin`, produced by
`circuits/voting`).

- **`refine(payload)`** — `payload = proof(128) ++ nullifier(32) ++ vote(1)`. Verifies
  the Groth16/BN254 proof against the **embedded** root + poll_id and the submitted
  nullifier + vote (the circuit's public inputs). Emits `[valid][nullifier][vote]`.
  Cost: **~60M gas** (~1.2% of the refine budget — see `../../spikes/groth16-gas`).
- **`accumulate()`** — reads each work-item's refine output via `accumulate_items()`,
  and for each *valid* vote: rejects a re-used nullifier (spent-nullifier registry at
  `nf:<nullifier>` in storage), then increments the `yes`/`no` tally and `total`. This
  is where the verified vote becomes durable on-chain state.

On chain you only ever see `{root, spent nullifiers, tally}` — never a voter's
identity, and never which eligible member cast which vote.

## Build

jam-pvm-build infers the module type from the **directory** name, so pass it
explicitly (the dir is `voting`, not `*-service`):

```sh
cd services/voting
jam-pvm-build -m service        # -> voting-service.jam  (~80 KB)
```

The embedded `vk.bin`/`root.bin`/`poll_id.bin` come from the circuit:

```sh
cd ../../circuits/voting && cargo run --release   # writes artifacts/*.bin + a sample submission.bin
cp artifacts/{vk,root,poll_id}.bin ../../services/voting/
```

## Verified end-to-end (on a lasair-node)

```
deploy voting-service           -> service_id 1729
cast vote (submission.bin)      -> verdict: valid, refine_gas: 59,855,977
  storage: total=1, yes=1, nf:<nullifier>=01
double-vote (same proof)        -> tally stays yes=1   (nullifier already spent)
```

So: a valid anonymous vote is counted once; a replay is silently ignored by the
nullifier registry; the tally is readable over the operator RPC
(`GET /v1/service/<id>/storage/<key_hex>` for `yes`/`no`/`total`).

## Honest scope / next

- **Fixed-seed trusted setup** (the circuit's Groth16 setup uses a deterministic RNG
  for a reproducible demo) — a real deployment needs a proper ceremony or a
  universal setup.
- **One poll per deployment** (root + poll_id embedded). Multi-poll = register roots
  on-chain in `accumulate` and validate the payload's root against state.
- **Client prover** (next) — a wasm/native helper so a voter generates their proof in
  the browser from their secret + Merkle path (client-side, like Aztec; JAM's edge is
  the cheap in-protocol *verification*).
- **Web UX** (next) — create poll / cast anonymous vote / live tally + spent-nullifier
  set, replacing the hash/tamper toy.
