# Running everything from source

All of our docker-compose stacks **build from source for your machine's
architecture** (Apple Silicon builds native arm64, x86 builds amd64). No prebuilt
images are pulled, so there's never an arch mismatch and you're always running the
exact code in the tree. (A PolkaJam-style nightly that publishes multi-arch images
for every platform is a future nicety — overkill for now; building from source is
the right move.)

Prereqts: Docker + Docker Compose. The two repos are sibling submodules under
`Aiden/submodules/` (`lasair/` and `zk-jam-service/`), which the relative build
contexts rely on.

## 1. The full demo — zk-jam-service on a live 6-validator testnet

The headline experience: six separate Lasair validators gossiping blocks with
colour-coded logs, the service deployed onto the network, and the web dashboard.

```sh
cd Aiden/submodules/zk-jam-service
docker compose up --build
```

What you get:
- **`node0`..`node5`** — six Lasair validators (built from `../lasair`,
  `Dockerfile.testnet`). Every ~6s one node prints `🚀 authored slot N` and the
  other five print `⬇ imported slot N from nodeK`, each in its own colour, crossing
  epoch boundaries. Slots free-run off the JAM Common Era wall clock (~7.8M).
- **`node0`** additionally hosts the operator RPC, so the service runs **on** the
  testnet. The deploy step posts `zk-jam-service.jam` to it (service id **1729**).
- **web** — the Next.js dashboard at <http://localhost:3000> (`JAM_BACKEND=lasair`,
  pointed at node0). Set service id 1729, go to `/verify`.

Observe any node's chain head over HTTP — node0 on `:19900`, node1..5 on
`:19901..:19905`:

```sh
curl localhost:19900/v1/head     # {slot, height, head_hex, root_hex, node_index, services}
```

Rebuild after code changes: `docker compose up --build` (or
`docker compose build` then `up`). Tear down: `docker compose down`.

## 2. Just the testnet (no service / web) — watch a live JAM network

From the lasair repo, the standalone 6-node testnet:

```sh
cd Aiden/submodules/lasair
docker compose -f docker-compose.testnet.yml up --build
```

Same colour-coded gossip + leader rotation, head on `localhost:19900` (node0).
Runbook: `lasair/docs/TESTNET.md`.

## 3. Just a single node — lightweight operator RPC + free-running clock

If you only need one node hosting the service (no multi-node visuals), build the
single `lasair-node` image from source and run it:

```sh
cd Aiden/submodules/lasair
docker build -f Dockerfile.node -t lasair-node:local .
docker run --rm -p 19900:19900 lasair-node:local
curl localhost:19900/v1/head     # slot free-runs ~7.8M, advances every 6s
```

This is the same operator RPC (`deploy` / `item` / `storage` / `head` / `healthz`)
that node0 serves in the testnet — they share the `node_rpc` library — so the
zk-jam-service backend behaves identically against either.

## Notes

- **One image, six nodes.** The compose builds `lasair-testnet-node:local` once and
  all six services share it; only `NODE_INDEX` differs. node0 is the published RPC.
- **Architecture.** Everything compiles for the host arch at build time, so Apple
  Silicon runs native (no amd64 emulation). The GHCR publish workflows
  (`node-v*` / `testnet-v*` tags) build `linux/amd64,linux/arm64` for distribution,
  but local development never needs them.
- **Service execution today is node-local (Phase 1a)** on node0: the refine →
  work-report → accumulate lifecycle runs in-process on the host node while the
  chain itself is the live gossiped multi-node network. Folding work-items into the
  gossiped blocks (so every node imports the service's state transitions) is the
  next integration layer.
