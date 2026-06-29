# CLI Client

TypeScript tools for interacting with the zk-jam-service on JAM.

## Setup

```bash
npm install
```

## Hash Verification

Submit a preimage for on-chain verification:

```bash
# Valid verification (hash matches)
npx tsx src/hash-verify.ts "hello world"

# Tampered verification (hash intentionally corrupted - will fail)
npx tsx src/hash-verify.ts "hello world" --tamper

# With custom service ID
npx tsx src/hash-verify.ts "hello" --service-id abc12345
```

**What happens:**
1. Computes `blake2s256("hello world")` locally
2. Builds payload: `[32-byte hash] + [preimage bytes]`
3. Submits to JAM via `jamt item <service_id> <payload>`
4. Service re-computes hash in `refine()` and compares

## Query Storage

```bash
# Query verification count
npx tsx src/query-state.ts count

# Query last status
npx tsx src/query-state.ts status

# With service ID
npx tsx src/query-state.ts count --service-id abc12345
```

## Monitor Network

```bash
# Watch for new slots
npx tsx src/monitor.ts

# Custom interval (ms)
npx tsx src/monitor.ts --interval 2000
```

## Backend: PolkaJam or Lasair

The client talks to either backend via the same commands — pick with `JAM_BACKEND`:

```bash
# default: PolkaJam (bundled jamt CLI)
JAM_SERVICE_ID=99fbfec5 npx tsx src/hash-verify.ts --preimage "hello" --submit

# Lasair node (HTTP operator RPC) — service id is the decimal id from deploy
JAM_BACKEND=lasair LASAIR_RPC=http://localhost:19900 JAM_SERVICE_ID=1729 \
  npx tsx src/hash-verify.ts --preimage "hello" --submit
```

The Lasair backend deploys with `POST /v1/service`, submits with
`POST /v1/service/<id>/item`, and reads with `GET /v1/service/<id>/storage/<key>`
(see the lasair `lasair-node` image). The PolkaJam path is unchanged.

## Configuration

| Env Variable | Description | Default |
|--------------|-------------|---------|
| `JAM_BACKEND` | `polkajam` or `lasair` | `polkajam` |
| `JAM_SERVICE_ID` | Service ID (PolkaJam: hex; Lasair: decimal) | `99fbfec5` |
| `LASAIR_RPC` | Lasair node operator RPC (when backend=lasair) | `http://localhost:19900` |
| `JAMT_PATH` | Path to jamt binary (PolkaJam) | `../polkajam-nightly/jamt` |

## File Structure

```
client/
├── src/
│   ├── config.ts         # Service ID, paths
│   ├── hash-verify.ts    # Submit hash verifications
│   ├── query-state.ts    # Read service storage
│   ├── monitor.ts        # Watch network activity
│   └── utils/
│       ├── rpc.ts        # jamt CLI wrapper
│       └── encoding.ts   # Hex encoding helpers
└── package.json
```

## See Also

- [Web Dashboard](./web/README.md) - Visual interface
- [Main README](../README.md) - Project overview
