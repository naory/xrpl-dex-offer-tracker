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

## 🚀 Future Roadmap

### 🎯 **Priority Features**

#### **1. Layout & Navigation Improvements**
- [ ] **Multi-panel Dashboard**: Resizable, draggable panel system for customized layouts
- [ ] **Navigation Sidebar**: Quick access to different views (Markets, Portfolio, Analytics, Settings)
- [ ] **Tab System**: Multiple trading pair tabs with quick switching
- [ ] **Workspace Saving**: Save and restore custom dashboard configurations
- [ ] **Mobile-First Responsive**: Optimized mobile trading interface

#### **2. AMM Pool Integration & Analysis** 
- [ ] **AMM Pool Discovery**: Auto-detect and track XRPL AMM pools
- [ ] **Pool vs DEX Comparison**: Side-by-side liquidity analysis (Pool vs Order Book)
- [ ] **AMM Pool Breakdown**: 
  - Individual pool performance metrics
  - LP token tracking and yield analysis
  - Pool composition and weight changes
  - Impermanent loss calculations
- [ ] **Hybrid Routing**: Show best execution paths (DEX vs AMM vs hybrid)
- [ ] **Pool Health Metrics**: TVL, volume/TVL ratio, fee earnings
- [ ] **AMM Transaction Feed**: Real-time pool swaps, adds, removes

### 📊 **Advanced Trading Features**

#### **3. Portfolio & Wallet Integration**
- [ ] **XRPL Wallet Connection**: Connect Xumm, Crossmark, GemWallet
- [ ] **Portfolio Tracking**: Real-time balance and P&L tracking
- [ ] **Transaction History**: Complete trading history with P&L analysis
- [ ] **Asset Allocation**: Visual breakdown of holdings
- [ ] **Portfolio Performance**: ROI tracking with benchmarks

#### **4. Advanced Analytics & Intelligence**
- [ ] **Price Alerts**: Custom price, volume, and volatility alerts
- [ ] **Market Sentiment**: Social sentiment aggregation and analysis
- [ ] **Liquidity Heatmaps**: Visual liquidity distribution across pairs
- [ ] **Arbitrage Scanner**: Cross-DEX and DEX-AMM arbitrage opportunities
- [ ] **Whale Watching**: Large transaction monitoring and alerts
- [ ] **Market Microstructure**: Bid-ask spread analysis, market impact

#### **5. Professional Trading Tools**
- [ ] **Advanced Charting**: TradingView-style charts with indicators
- [ ] **Order Management**: 
  - Limit orders with time-in-force options
  - Stop-loss and take-profit automation
  - Conditional orders and triggers
- [ ] **Risk Management**: Position sizing, exposure limits, risk metrics
- [ ] **Backtesting Engine**: Strategy testing with historical data
- [ ] **API Trading**: REST/WebSocket APIs for algorithmic trading

### 🔍 **Data & Research Features**

#### **6. Market Research & Intelligence**
- [ ] **Token Research Hub**: 
  - Fundamental analysis for XRPL tokens
  - Social media mentions and sentiment
  - Developer activity and ecosystem updates
- [ ] **Cross-Chain Comparison**: Compare XRPL prices with other DEXes
- [ ] **Market Reports**: Automated daily/weekly market summaries
- [ ] **Correlation Analysis**: Token correlation matrices and insights

#### **7. Historical Data & Analytics**
- [ ] **Time Machine**: Historical market state reconstruction
- [ ] **Seasonality Analysis**: Trading pattern analysis over time
- [ ] **Volume Profile**: Price level volume distribution analysis
- [ ] **Market Replay**: Step-through historical market events
- [ ] **Data Export**: CSV/JSON export for external analysis

### ⚡ **Performance & Infrastructure**

#### **8. Real-Time Enhancements**
- [ ] **WebSocket Streaming**: Real-time price and order book updates
- [ ] **Low-Latency Mode**: Sub-100ms update optimizations
- [ ] **Multi-Node Support**: Horizontal scaling with Redis clustering
- [ ] **CDN Integration**: Global edge caching for market data
- [ ] **Performance Monitoring**: Real-time system health dashboard

#### **9. User Experience & Accessibility**
- [ ] **Dark/Light Themes**: Multiple theme options with customization
- [ ] **Keyboard Shortcuts**: Power user navigation and actions
- [ ] **Screen Reader Support**: Full accessibility compliance
- [ ] **Multi-Language**: Internationalization support
- [ ] **Color-Blind Friendly**: Accessible color schemes and indicators

### 🛡️ **Security & Compliance**

#### **10. Security & Privacy**
- [ ] **Read-Only Wallet Connection**: View-only wallet integration for safety
- [ ] **Data Privacy Controls**: GDPR compliance and data export
- [ ] **Security Alerts**: Suspicious activity monitoring
- [ ] **Audit Logs**: Complete user action logging
- [ ] **Rate Limiting**: Anti-abuse and fair usage policies

### 🎨 **Advanced UI/UX**

#### **11. Gamification & Social**
- [ ] **Trading Competitions**: Leaderboards and challenges
- [ ] **Achievement System**: Unlock badges for trading milestones
- [ ] **Social Trading**: Follow successful traders (anonymized)
- [ ] **Community Features**: Discussion forums and market chat
- [ ] **Educational Content**: Built-in tutorials and XRPL learning modules

#### **12. Enterprise Features**
- [ ] **Team Accounts**: Multi-user access with role permissions
- [ ] **White-Label Solution**: Branded instances for institutions
- [ ] **API Rate Tiers**: Premium access levels for different users
- [ ] **Custom Integrations**: Enterprise webhook and API features
- [ ] **Compliance Reporting**: Automated regulatory reporting tools

### 🔮 **Experimental & Research**

#### **13. AI & Machine Learning**
- [ ] **Price Prediction Models**: ML-based price forecasting
- [ ] **Anomaly Detection**: Unusual market activity alerts
- [ ] **Smart Alerts**: AI-powered personalized notifications
- [ ] **Pattern Recognition**: Automated technical analysis
- [ ] **Market Making Assistance**: Optimal spread suggestions

#### **14. Cross-Chain & DeFi**
- [ ] **Bridge Monitoring**: Track XRPL bridge activities
- [ ] **Cross-Chain Arbitrage**: Multi-chain opportunity scanning
- [ ] **DeFi Integration**: Track XRPL DeFi protocols and yields
- [ ] **Interoperability Analytics**: Cross-chain flow analysis

---

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

#### New: In-Memory Top-K Trading Pairs Tracker
- [x] Design and implement an in-memory top-k tracker for the most traded pairs over the past 10 minutes, 1 hour, and 24 hours
- [x] Integrate the top-k trading pairs tracker with the transaction processing logic to record trades in real time
- [x] Expose new API endpoints to query the top-k trading pairs for each time window and get stats for specific pairs
- [ ] Document the new endpoints and usage in the README

#### Enhanced: XRP-Focused Top-K Trading Pairs with Bid/Ask Analysis
- [ ] **XRP-Only Pairs**: Filter top-k to show only pairs where any currency is traded against XRP (e.g., USDC/XRP, RLUSD/XRP, etc.)
- [ ] **Bid/Ask Breakdown**: Track and display separate volumes for bids (buying XRP) vs asks (selling XRP)
- [ ] **Price Display Options**: 
  - Default: Price in XRP (how much XRP per token)
  - Toggle: Price in token (how many tokens per XRP)
- [ ] **Enhanced UI Display**:
  - Option 1: Combined list with bid/ask breakdown shown for each pair
  - Option 2: Separate bid and ask sections in one unified view
- [ ] **Real-time Updates**: Live bid/ask volume tracking with visual indicators
- [ ] **Price Movement Indicators**: Show price trends and recent changes

#### 🚀 Flashy Trader's View Implementation
- [ ] **Backend Enhancements**:
  - [ ] Modify trading tracker to separate bid/ask volumes for XRP pairs
  - [ ] Add price calculation and trend tracking (% change over time windows)
  - [ ] Create XRP-focused endpoint filtering non-XRP pairs
  - [ ] Add price movement data (up/down/neutral with percentages)
- [ ] **Frontend Trading Floor UI**:
  - [ ] Replace simple list with animated trader's interface
  - [ ] Implement bid/ask volume bars with electric green/red colors
  - [ ] Add real-time price movement arrows (↗️ ↘️) with percentage changes
  - [ ] Create heat indicators (🔥) based on trading activity
  - [ ] Add time window filters (24H/1H/10M) with instant switching
  - [ ] Implement XRP/TOKEN price toggle functionality
- [ ] **Visual Enhancements**:
  - [ ] Dark trader-themed color scheme (navy/black background)
  - [ ] Animated volume bars that grow/shrink with real-time updates
  - [ ] Smooth counting animations for volume numbers
  - [ ] Glowing borders/pulse effects for highly active pairs
  - [ ] Position change animations when rankings shift
- [ ] **Interactive Features**:
  - [ ] Click pair to open detailed order book view
  - [ ] Hover effects with mini price history charts
  - [ ] Monospace fonts for precise number display
  - [ ] Special indicators for meme coins and trending tokens
  - [ ] Optional trading floor sound effects

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
   ```bash
   cd client
   npm start
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

## API: In-Memory Top-K Trading Pairs (Real-Time)

The backend exposes several endpoints for real-time analytics of the most traded pairs over the past 10 minutes, 1 hour, and 24 hours. These endpoints are powered by an in-memory tracker (easy to refactor to Redis if needed).

### Endpoints

#### `GET /top-trading-pairs`
Returns the top-k most traded pairs for a given time window.

**Query Parameters:**
- `window`: Time window (`10m`, `1h`, or `24h`). Default: `24h`
- `k`: Number of pairs to return. Default: `20`

**Example:**
```
GET /top-trading-pairs?window=1h&k=5
```
**Response:**
```json
{
  "window": "1h",
  "k": 5,
  "pairs": [
    {
      "pairKey": "...",
      "takerGets": { "currency": "XRP", "issuer": null },
      "takerPays": { "currency": "USD", "issuer": "r..." },
      "volume": 12345.67,
      "count": 42,
      "lastUpdate": 1723456789012
    }
    // ...
  ],
  "timestamp": 1723456789012
}
```

#### `GET /trading-stats`
Returns comprehensive stats for all time windows, including memory usage.

**Query Parameters:**
- `k`: Number of pairs to return per window. Default: `20`

**Example:**
```
GET /trading-stats?k=10
```

#### `GET /pair-stats/:currency1/:currency2`
Returns stats for a specific trading pair.

**Query Parameters:**
- `issuer1`: (optional) Issuer for currency1
- `issuer2`: (optional) Issuer for currency2

**Example:**
```
GET /pair-stats/XRP/USD?issuer2=rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq
```

#### `GET /trading-pairs/realtime`
Returns a formatted list of top-k pairs for a given window, with rank and readable fields.

**Query Parameters:**
- `window`: Time window (`10m`, `1h`, or `24h`). Default: `24h`
- `k`: Number of pairs to return. Default: `20`

**Example:**
```
GET /trading-pairs/realtime?window=10m&k=3
```
**Response:**
```json
{
  "window": "10m",
  "k": 3,
  "pairs": [
    {
      "rank": 1,
      "pair": "XRP/USD",
      "volume": 1000.0,
      "count": 5,
      "lastUpdate": 1723456789012,
      "currency1": "XRP",
      "currency2": "USD",
      "issuer1": null,
      "issuer2": "r..."
    }
    // ...
  ],
  "totalPairs": 10,
  "timestamp": 1723456789012
}
```

**Note:** These endpoints are powered by an in-memory tracker. If you want persistence or distributed state, you can refactor the tracker to use Redis with minimal changes.