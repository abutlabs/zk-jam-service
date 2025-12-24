# JAM Service Client

TypeScript client for interacting with `my-jam-service` on the JAM network.

## Setup

```bash
cd client
npm install
```

## Configuration

Set your service ID via environment variable:

```bash
export JAM_SERVICE_ID=0c7bb62b
```

Or pass it directly with `--service-id`.

## Commands

### Query Service Info

```bash
# Get service metadata
npm run query

# With explicit service ID
npm run query -- --service-id 0c7bb62b
```

### Query Storage

```bash
# Query a specific storage key
npm run query -- --key status

# Query with hex key
npm run query -- --key 0x737461747573

# Raw output (no decoding)
npm run query -- --key status --raw
```

### Submit Payload

```bash
# Submit a string payload
npm run submit -- --payload "hello world"

# Submit hex payload
npm run submit -- --payload 0x48656c6c6f

# Submit from file
npm run submit -- --file proof.bin
```

> **Note:** Direct RPC submission is not yet implemented. The command will show the equivalent `jamt` command to run.

### Monitor Network

```bash
# Watch for new blocks
npm run monitor

# Custom polling interval
npm run monitor -- --interval 1000
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JAM_RPC` | WebSocket RPC endpoint | `ws://localhost:19800` |
| `JAM_SERVICE_ID` | Default service ID | (none) |

## Project Structure

```
client/
├── src/
│   ├── config.ts         # Configuration and constants
│   ├── submit-proof.ts   # Submit work items
│   ├── query-state.ts    # Query service state
│   ├── monitor.ts        # Monitor network activity
│   └── utils/
│       ├── rpc.ts        # WebSocket RPC client
│       └── encoding.ts   # Hex/string encoding
├── package.json
├── tsconfig.json
└── README.md
```

## Development

```bash
# Build TypeScript
npm run build

# Run directly with tsx
npx tsx src/query-state.ts --service-id 0c7bb62b
```

## Next Steps

1. **Phase 2:** Implement hash verification in the service
2. **Phase 3:** Integrate ZK proof verification
3. Add direct RPC submission (when PolkaJam API is documented)
4. Add WebSocket subscriptions for real-time updates
