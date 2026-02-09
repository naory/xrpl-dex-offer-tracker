# Technical Context: XRPL DEX Offer Tracker
*Version: 1.1*
*Last Updated: 2025-06*

## Technology Stack
- **Frontend:** React 18, TypeScript, Create React App
  - MUI v7 (`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`)
  - Zustand 5 (state management)
  - React Query / TanStack Query 5 (server data fetching)
  - Recharts 3 (charts)
  - D3 7 (heatmap)
  - Framer Motion 12 (animations)
  - lucide-react (icons)
  - react-router-dom 7
- **Backend:** Node.js 18, Express 5, xrpl 4.3 (WebSocket + RPC)
- **Database:** PostgreSQL 13 (Docker Compose), node-postgres (pg)
- **Testing:** Jest 29, Supertest, React Testing Library
- **Infrastructure:** Docker, Docker Compose, Colima (macOS)

## Development Environment Setup
1. **Prerequisites:** Docker or Colima, Node.js 18+
2. **Start Postgres:** `docker-compose up -d postgres_test`
3. **Start server:** `cd server && npm install && XRPL_NET=mainnet PGPORT=5433 node index.js`
4. **Start client:** `cd client && npm install && npm start` (localhost:3000)
5. **Server API:** localhost:3001
6. **XRPL endpoints:** Public mainnet `wss://s1.ripple.com/` and `https://s1.ripple.com:51234/`

## Environment Variables
| Variable | Default | Description |
|---|---|---|
| `XRPL_NET` | `mainnet` | Network: `mainnet`, `testnet`, or direct `wss://` URL |
| `PGHOST` | `localhost` | Postgres host |
| `PGPORT` | `5433` | Postgres port (Docker mapped) |
| `PGUSER` | `xrpl` | Postgres user |
| `PGPASSWORD` | `xrplpass` | Postgres password |
| `PGDATABASE` | `xrpl_dex_test` | Postgres database |
| `PORT` | `3001` | Express server port |
| `REFRESH_CURRENCIES_INTERVAL` | `60` | Seconds between tracked-pair refresh |
| `LOG_FULL_TX` | — | Enable full transaction logging |

## Dependencies
### Server
- `express` 5 — HTTP API server
- `xrpl` 4.3 — XRPL WebSocket/RPC client
- `pg` — PostgreSQL client with pooling
- `node-fetch` — HTTP requests (mainnet status check)
- `cors` — Cross-origin support
- `jest`, `supertest`, `nock` — testing

### Client
- `react`, `react-dom` 18 — UI framework
- `@mui/material` 7, `@emotion/react` — Component library and styling
- `zustand` 5 — Lightweight state management
- `@tanstack/react-query` 5 — Server data caching and fetching
- `recharts` 3 — Chart components
- `d3` 7 — Data-driven visualizations (heatmap)
- `framer-motion` 12 — Animations
- `lucide-react` — Icon set
- `react-router-dom` 7 — Routing

## Technical Constraints
- Never store hex currency codes; always convert to human-readable strings
- Rate limiting (HTTP 429) may intermittently disrupt WS; must degrade gracefully
- Dockerized Postgres on port 5433; DB access via `psql` in container
- Only write offers to DB for pairs in the `tracked_pairs` table

## Build and Deployment
- **Server:** Node 18, can be containerized via `docker-compose up server`
- **Client:** CRA build (`npm run build`), static output in `client/build/`
- **Full stack Docker:** `docker-compose up -d` starts Postgres + server
- **CI/CD:** TBD

## Testing Approach
- **Unit tests:** Jest for server logic (`handleTransaction`, `tradingPairsTracker`, backfill)
- **API tests:** Supertest against Express routes
- **Integration tests:** DB container + server
- **Client tests:** React Testing Library
- **E2E:** Manual via local stack; automated TBD

---

*This document describes the technologies used in the project and how they're configured.*
