# XRPL DEX Offer Tracker

Real-time dashboard for monitoring XRPL DEX trading activity. Connects to the XRP Ledger via WebSocket, ingests offer transactions, stores them in PostgreSQL, and renders live order books, market depth, and trading pair analytics in a React UI.

## Architecture

```
┌──────────────┐     WebSocket      ┌──────────────┐     PostgreSQL     ┌──────────────┐
│  XRPL Mainnet│────────────────────│  Node/Express │────────────────────│  PostgreSQL   │
│  (public)    │  transactions      │  Server :3001 │  offers, history   │  (Docker)     │
└──────────────┘                    └──────┬───────┘                    └──────────────┘
                                          │ REST API
                                   ┌──────┴───────┐
                                   │  React Client │
                                   │  (MUI) :3000  │
                                   └──────────────┘
```

- **Server** — Node.js / Express 5. Subscribes to XRPL `transactions` stream, parses OfferCreate/OfferCancel, upserts into Postgres, exposes 15 REST endpoints. Includes `TradingPairsTracker` for in-memory time-window analytics (10m / 1h / 24h).
- **Client** — React 18, MUI v7, Zustand state management, React Query for data fetching, Recharts + D3 for charts, Framer Motion for animations.
- **Database** — PostgreSQL 13 via Docker Compose. Three tables: `offers`, `offer_history`, `tracked_pairs`.

## Prerequisites

| Requirement | Notes |
|---|---|
| Docker / Colima | For running PostgreSQL |
| Node.js 18+ | Server and client |
| npm | Dependency management |

## Quick Start

```bash
# 1. Start PostgreSQL
docker-compose up -d postgres_test

# 2. Start the server
cd server
npm install
XRPL_NET=mainnet PGPORT=5433 node index.js

# 3. Start the client (new terminal)
cd client
npm install
npm start
```

The client opens at `http://localhost:3000` and the API is at `http://localhost:3001`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `XRPL_NET` | `mainnet` | `mainnet`, `testnet`, or a direct WebSocket URL (`wss://...`) |
| `PGHOST` | `localhost` | PostgreSQL host |
| `PGPORT` | `5433` | PostgreSQL port (mapped from Docker) |
| `PGUSER` | `xrpl` | PostgreSQL user |
| `PGPASSWORD` | `xrplpass` | PostgreSQL password |
| `PGDATABASE` | `xrpl_dex_test` | PostgreSQL database name |
| `PORT` | `3001` | Express server port |
| `REFRESH_CURRENCIES_INTERVAL` | `60` | Seconds between tracked-pair refresh cycles |
| `LOG_FULL_TX` | — | Set to log full transaction payloads |

## API Endpoints

### Core

| Method | Path | Description |
|---|---|---|
| `GET` | `/offers` | List current offers (filter by account, currency; sort, paginate) |
| `GET` | `/offer-history` | Offer history log (filter by offer_id, account, event_type) |
| `GET` | `/health` | Health check (DB, XRPL WS, backfill status) |
| `GET` | `/rippled-status` | XRPL connection details (server state, rate limiting, ledger index) |

### Trading Pairs

| Method | Path | Description |
|---|---|---|
| `GET` | `/trading-pairs` | Distinct trading pairs from tracked_pairs or offers |
| `GET` | `/tracked-pairs` | Active tracked pairs with issuer details |
| `GET` | `/top-trading-pairs` | Top-k pairs by volume for a time window (10m/1h/24h) |
| `GET` | `/trading-pairs/realtime` | Real-time pairs with volume and rank |
| `GET` | `/trading-stats` | Comprehensive trading statistics + memory usage |
| `GET` | `/pair-stats/:c1/:c2` | Stats for a specific currency pair |
| `GET` | `/xrp-pairs/flashy` | XRP pairs with bid/ask breakdown for trader view |

### Analytics

| Method | Path | Description |
|---|---|---|
| `GET` | `/analytics/volume` | Total traded volume for a pair over a period |
| `GET` | `/analytics/price-trend` | Price stats (avg, min, max, median) for a pair |
| `GET` | `/analytics/orderbook` | Order book depth (bids + asks) for a pair |
| `GET` | `/analytics/offer-counts` | Offer creation/cancellation counts for a pair |
| `GET` | `/analytics/account-orders` | Per-account order counts for a pair |

## Database Schema

### `offers` — current live offers
| Column | Type | Notes |
|---|---|---|
| `offer_id` | `VARCHAR(64)` | Unique |
| `account` | `VARCHAR(64)` | |
| `taker_gets_currency` | `VARCHAR(42)` | Human-readable (never hex) |
| `taker_gets_issuer` | `VARCHAR(64)` | Nullable for XRP |
| `taker_gets_value` | `NUMERIC(38,18)` | |
| `taker_pays_currency` | `VARCHAR(42)` | |
| `taker_pays_issuer` | `VARCHAR(64)` | |
| `taker_pays_value` | `NUMERIC(38,18)` | |
| `price` | `NUMERIC(38,18)` | Generated: `pays / gets` |
| `flags` | `INTEGER` | |
| `expiration` | `TIMESTAMP` | |

### `offer_history` — append-only event log
Same columns as `offers` plus `event_type` (`created`, `modified`, `cancelled`, `filled`) and `event_time`.

### `tracked_pairs` — currency pairs to track
| Column | Type |
|---|---|
| `taker_gets_currency` | `VARCHAR(42)` |
| `taker_gets_issuer` | `VARCHAR(64)` |
| `taker_pays_currency` | `VARCHAR(42)` |
| `taker_pays_issuer` | `VARCHAR(64)` |
| `active` | `BOOLEAN` |

## Client Components

| Component | Description |
|---|---|
| `Header` | App bar with pair selector dropdown and connection status |
| `OrderBook` | Live order book for selected pair |
| `MarketDepth` | Depth chart visualization |
| `OrderBookHeatmap` | D3 heatmap of order book levels |
| `OfferChart` | Recharts price/volume charts |
| `RecentOffers` | Recent offer feed |
| `TopTradingPairs` | Ranked trading pairs by volume (time-window selector) |
| `StatsCards` | Summary stat cards |
| `SectionCard` | Reusable card wrapper |

State is managed with **Zustand** (`useAppStore`) and server data is fetched via **React Query**.

## Project Structure

```
xrpl-dex-offer-tracker/
├── client/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── store/            # Zustand store (useAppStore.ts)
│   │   ├── styles/           # MUI sx helpers
│   │   ├── theme.ts          # MUI theme config
│   │   ├── App.tsx           # Root layout + React Query provider
│   │   └── index.tsx         # Entry point
│   └── package.json
├── server/
│   ├── index.js              # Entry point, XRPL WS connect, backfill
│   ├── app.js                # Express routes
│   ├── db.js                 # PostgreSQL pool
│   ├── schema.sql            # Database DDL
│   ├── tradingPairsTracker.js # In-memory time-window pair analytics
│   ├── *.test.js             # Jest tests
│   └── package.json
├── memory-bank/              # Project documentation
├── docker-compose.yml        # PostgreSQL + optional server container
└── README.md
```

## Testing

```bash
# Server unit + integration tests
cd server && npm test

# Client tests
cd client && npm test
```

## License

ISC
