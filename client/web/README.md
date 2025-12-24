# Web Dashboard

Visual interface for the zk-jam-service. Built with Next.js 14 and shadcn/ui.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard with network status and JAM pipeline visualization |
| `/verify` | Interactive hash verification form with tamper testing |
| `/explorer` | Block browser, slot history, verification tracking |
| `/learn` | Educational content about JAM architecture and ZK proofs |

## Features

### Hash Verification (`/verify`)
- Enter any text to compute its Blake2s-256 hash
- Submit to the JAM service for on-chain verification
- Toggle "tamper" to test failure paths
- Watch the pipeline progress: Submit → Refine → Audit → Accumulate

### Explorer (`/explorer`)
- Real-time slot/block display
- Click slots to see verifications submitted at that block
- Full verification history with expandable details
- Payload breakdown showing byte structure

### Verification History
- Stored locally in browser (localStorage)
- Expandable cards with educational payload breakdown
- Stats: total/valid/invalid/pending counts

## Configuration

Create `.env.local`:

```bash
# Service ID (8 hex chars, no 0x prefix)
NEXT_PUBLIC_JAM_SERVICE_ID=99fbfec5
```

The dashboard calls the `jamt` CLI via server actions. Ensure `polkajam-testnet` is running.

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── verify/page.tsx       # Verification form
│   ├── explorer/page.tsx     # Block explorer
│   ├── learn/page.tsx        # Educational content
│   ├── actions/jam.ts        # Server actions (jamt wrapper)
│   └── api/network/route.ts  # Network status API
├── components/
│   ├── Pipeline.tsx          # Visual stage indicator
│   ├── VerificationHistory.tsx
│   └── ui/                   # shadcn components
└── lib/
    ├── history.ts            # localStorage store
    └── utils.ts
```

## Development

```bash
# Development with hot reload
npm run dev

# Production build
npm run build
npm start

# Type check
npx tsc --noEmit
```

## See Also

- [CLI Tools](../README.md) - Command-line client
- [Main README](../../README.md) - Project overview
