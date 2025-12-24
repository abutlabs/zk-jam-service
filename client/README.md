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

## Configuration

| Env Variable | Description | Default |
|--------------|-------------|---------|
| `JAM_SERVICE_ID` | Service ID (8 hex chars) | `99fbfec5` |
| `JAMT_PATH` | Path to jamt binary | `../polkajam-nightly/jamt` |

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
