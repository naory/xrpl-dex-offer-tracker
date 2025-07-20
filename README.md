# XRPL DEX Offer Tracker

A full-stack application for tracking offers on the XRPL (XRP Ledger) Decentralized Exchange (DEX).

## Project Overview

This project provides a real-time dashboard and backend service to monitor, display, and analyze offers on the XRPL DEX. It is split into two main components:

- **Client**: A React-based frontend for visualizing DEX offers.
- **Server**: A backend service for fetching, processing, and serving XRPL DEX offer data.

## Features

- Real-time tracking of XRPL DEX offers via WebSocket
- Dynamic multi-pair tracking (configurable via database)
- Comprehensive analytics endpoints:
  - Volume analytics
  - Price trends
  - Order book depth and liquidity
  - Offer counts by currency
  - Orders per account
- Filtering and searching offers by asset, price, and account
- Historical offer analytics and charts
- Responsive, user-friendly dashboard
- PostgreSQL storage with Redis caching
- Comprehensive test coverage (unit + integration tests)

## Project Structure

```
xrpl-dex-offer-tracker/
  client/   # React frontend
  server/   # Backend service (Node.js/Express)
```

## Planned Implementation Steps

### 1. Backend (server/)
- [x] Set up XRPL WebSocket client to subscribe to live DEX offer updates
- [x] Use XRPL HTTP API for initial data load and as a fallback if WebSocket is unavailable
- [x] **Store and cache offer data using PostgreSQL as the primary database**
- [x] **(Optional) Use Redis as a cache for real-time offer data**
- [x] Expose REST API endpoints for:
  - Current offers
  - Offer history
  - Analytics (volume, price trends, order book depth, offer counts, account orders)
- [x] Implement filtering, sorting, and pagination logic
- [x] Add unit and integration tests
- [x] Dynamic multi-pair tracking with database-driven configuration

#### Storage
- **Primary:** PostgreSQL (easy local dev, AWS RDS, GCP Cloud SQL)
- **Cache (optional):** Redis (for real-time data, AWS ElastiCache, GCP Memorystore)

#### Local Development
- Use Docker Compose to run PostgreSQL (and Redis if needed) locally.

#### Cloud Deployment
- Seamless migration to AWS/GCP managed services for PostgreSQL and Redis.

### 2. Frontend (client/)
- [ ] Set up React app with TypeScript
- [ ] Create dashboard UI for displaying offers
- [ ] Implement search, filter, and sort controls
- [ ] Visualize analytics (charts, graphs)
- [ ] Connect to backend API for live data
- [ ] Add responsive design and accessibility improvements
- [ ] Add frontend tests

### 3. Deployment & Documentation
- [ ] Add Docker support for both client and server
- [ ] Write deployment scripts and instructions
- [ ] Document API endpoints and usage
- [ ] Add usage examples and screenshots to README

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/xrpl-dex-offer-tracker.git
   cd xrpl-dex-offer-tracker
   ```

2. Start PostgreSQL and Redis:
   ```bash
   docker-compose up -d
   ```

3. Initialize databases:
   ```bash
   # Initialize test database
   ./server/init_test_db.sh
   
   # Initialize main database
   ./server/init_main_db.sh
   ```

4. Install dependencies for both client and server:
   ```bash
   cd client && npm install
   cd ../server && npm install
   ```

5. Start the backend server:
   ```bash
   # Option 1: Using the start script (recommended)
   cd server
   ./start.sh testnet   # For testnet (default)
   ./start.sh mainnet   # For mainnet

   # Option 2: Using npm scripts
   cd server
   npm run dev      # For testnet
   npm run mainnet  # For mainnet
   ```

6. Start the frontend client:
   ```
```

## Server Startup: Offer Backfill with XRPL HTTP API

To ensure the server has a complete and up-to-date view of all current offers for tracked pairs, the server performs a backfill on startup using the XRPL HTTP API.

### Motivation
- If the server only listens to new XRPL transactions, it may miss offers created before it started.
- Backfilling ensures the database is in sync with the XRPL ledger for all tracked pairs.

### How It Works
1. **For each tracked pair:**
    - Query the XRPL HTTP API (e.g., using the `book_offers` method) for all current offers.
    - Paginate if necessary (the XRPL API may limit results per call).
2. **For each offer:**
    - Upsert the offer into the `offers` table in the database.
    - Optionally, record a backfill event in `offer_history` (or just ensure the current state is correct).
3. **After backfill:**
    - The server starts listening for new transactions as usual.

### Best Practices
- Log progress and errors during backfill.
- Run backfill before starting the websocket listener to avoid race conditions.
- Optionally, use a "backfill in progress" flag to avoid serving incomplete data during startup.
- Make backfill idempotent (safe to run multiple times).

### Example Pseudocode
```js
async function backfillOffersForTrackedPairs(pool, trackedPairs) {
  for (const pair of trackedPairs) {
    let marker = null;
    do {
      const response = await xrplApi.book_offers({
        taker_gets: pair.taker_gets,
        taker_pays: pair.taker_pays,
        marker,
        limit: 200 // or whatever the API allows
      });
      for (const offer of response.offers) {
        // Upsert into DB
        await upsertOffer(pool, offer);
      }
      marker = response.marker;
    } while (marker);
  }
}
```

---