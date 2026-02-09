# System Patterns: XRPL DEX Offer Tracker
*Version: 1.1*
*Last Updated: 2025-06*

## Architecture Overview
A backend service (Express 5) connects to XRPL mainnet via WebSocket, processes transactions/offers, updates a PostgreSQL store, and exposes REST endpoints for the React + MUI client. A `TradingPairsTracker` maintains in-memory aggregate metrics for active pairs across multiple time windows.

## Key Components

### Server
- **Express API (app.js):** 15 REST endpoints — offers, history, health, rippled-status, trading pairs, analytics
- **XRPL Connector (index.js):** xrpl client subscribing to `transactions`; handles backfill on startup
- **TradingPairsTracker:** EventEmitter-based in-memory analytics with 10m/1h/24h sliding windows, top-k pair ranking, bid/ask volume breakdown, XRP-pair heat levels
- **handleTransaction:** Parses OfferCreate/OfferCancel, converts hex currencies to ISO, upserts offers + history. Only writes to DB if pair is in `tracked_pairs`
- **PostgreSQL (db.js):** Connection pool via `pg`; schema in `schema.sql`

### Client
- **Header:** MUI AppBar with tracked-pair dropdown (from `/tracked-pairs`), connection status indicator
- **OrderBook:** Live order book table for selected pair
- **MarketDepth:** Depth chart (Recharts)
- **OrderBookHeatmap:** D3-rendered heatmap of order book levels
- **OfferChart:** Price/volume charts (Recharts)
- **RecentOffers:** Streaming recent offer feed
- **TopTradingPairs:** Ranked pairs by volume with time-window selector (10m/1h/24h)
- **StatsCards:** Summary metric cards
- **SectionCard:** Reusable MUI card wrapper

## Design Patterns in Use

### Observer / Subscription
XRPL WS subscription for real-time transaction events. TradingPairsTracker extends EventEmitter to notify on pair updates.

### Zustand Store
Centralized client state (`useAppStore`): selected pair, connection status, tracked pairs, rippled status. Actions fetch from server and update atomically.

### React Query (TanStack)
Server data fetching with automatic caching, stale-while-revalidate, and refetch intervals for offer data, analytics, and trading stats.

### Tracked Pair Filtering
DB writes are gated by the `tracked_pairs` table. `handleTransaction` checks each offer against loaded tracked pairs before inserting into `offers` / `offer_history`. Pairs are refreshed periodically (`REFRESH_CURRENCIES_INTERVAL`).

### TradingPairsTracker Time-Window Architecture
- Maintains three Maps (10m, 1h, 24h) keyed by `currency1/currency2`
- Each entry stores volume, count, bid/ask breakdown, last price, trend
- Periodic cleanup removes expired entries per window
- `getTopKPairs(window, k)` returns sorted top-k by volume
- `getTopKXRPPairs` filters for XRP-involving pairs with heat level calculation

### Repository / Gateway
DB access through `pg` pool with parameterized queries. Generated `price` column avoids application-level computation.

### Circuit-Breaker-esque Handling
Reconnect backoff on WS disconnect; rate limiting detection propagated to UI via `/rippled-status` endpoint. Health endpoint reports degraded status when subsystems fail.

## Data Flow
1. XRPL WS events arrive via xrpl client subscription
2. `handleTransaction` parses OfferCreate/OfferCancel transactions
3. Currency codes converted from hex to human-readable
4. If pair is tracked: upsert into `offers` table, append to `offer_history`
5. TradingPairsTracker updated with volume/count regardless of tracking
6. REST endpoints serve data to client
7. Client uses React Query for periodic refetch, Zustand for UI state

## Key Technical Decisions
- Use public XRPL endpoints (no local rippled) to reduce ops burden
- Treat rate limiting as first-class status; expose to UI
- Process both proposed and validated transactions for activity signals
- MUI v7 for component library (migrated from earlier approach)
- Zustand over Redux for simpler, lighter state management
- Only persist offers for tracked pairs to control DB growth

## Component Relationships
```
XRPL Mainnet ──WS──> index.js (handleTransaction) ──> PostgreSQL
                           │                              │
                    TradingPairsTracker              app.js (REST)
                           │                              │
                           └──────── REST API ────────────┘
                                       │
                                React Client (MUI + Zustand + React Query)
```

---

*This document captures the system architecture and design patterns used in the project.*
