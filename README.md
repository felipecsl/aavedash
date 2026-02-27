# Aave Loan Monitor

A React + Vite dashboard that auto-loads Aave loan positions from a wallet address and computes risk/health metrics.

## Goals

- Use a single wallet address as input.
- Fetch live position data from public blockchain indexers.
- Show all detected loans across supported Aave markets.
- Compute practical monitoring metrics (HF, LTV, liquidation, leverage, carry/net APY).

## Features

- Wallet-only input UX.
- Optional query-string wallet input (`wallet`, `address`, or `walletAddress`) with auto-fetch on load when valid.
- Multi-market support:
  - `proto_mainnet_v3`
  - `proto_lido_v3`
- Tabs for multiple loans/borrowed assets.
- Top-level portfolio metrics across all active loans (average health factor, weighted APYs, total debt/collateral/net worth).
- Auto-fetched collateral/borrow amounts and market metadata.
- Price enrichment with CoinGecko.
- Dashboard analytics:
  - Health Factor
  - Liquidation price (primary-collateral approximation)
  - LTV, leverage, borrow headroom
  - Carry / Net APY summary
  - Monitoring checklist + sensitivity cards

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui-style components
- Lucide icons

## Requirements

- Node.js 18+
- npm

## Environment Variables

Create `.env` in project root.

```bash
# Required for reliable multi-market Graph access (especially proto_lido_v3)
VITE_THE_GRAPH_API_KEY=your_the_graph_api_key

# Optional but recommended to avoid CoinGecko rate limits
VITE_COINGECKO_API_KEY=your_coingecko_demo_api_key
```

Notes:

- Without `VITE_THE_GRAPH_API_KEY`, some markets may fail to load depending on endpoint availability.
- CoinGecko pricing still works without `VITE_COINGECKO_API_KEY`, but may be rate-limited.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Add `.env` (see above).

3. Start development server:

```bash
npm run dev
```

4. Open the local URL shown by Vite (usually `http://localhost:5173`).

5. Optional: prefill wallet from query string:

```text
http://localhost:5173/?wallet=0xYourEthereumAddress
```

Supported query params: `wallet`, `address`, `walletAddress`.

## Scripts

```bash
npm run dev         # start local dev server
npm run typecheck   # TypeScript checks
npm run lint        # ESLint
npm run build       # production build
npm run preview     # preview production build
```

## How It Works

1. User enters an Ethereum wallet address, or provides it via query string (`wallet`, `address`, or `walletAddress`).
2. App queries Aave subgraph data for supported markets.
3. Reserves are grouped into loan positions per market.
4. Token prices are fetched from CoinGecko.
5. Portfolio-level aggregate metrics are computed across all active loans.
6. Detailed metrics are computed and rendered per selected loan tab.

## Limitations

- Liquidation price is shown as a primary-collateral approximation for multi-collateral positions.
- Coverage depends on the supported market list and indexer availability.
- Metrics are simplified monitoring estimates, not a substitute for protocol-native risk engines.
