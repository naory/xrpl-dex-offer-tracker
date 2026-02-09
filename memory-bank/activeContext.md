# Active Context: XRPL DEX Offer Tracker
*Version: 1.1*
*Last Updated: 2025-06*

## Current Focus
- Documentation: README created, memory-bank docs updated to reflect current codebase
- Stabilize and harden existing features before adding new functionality
- Remaining UI polish and operational improvements

## Recent Changes
- Migrated UI from basic styling to MUI v7 component library
- Added Zustand store (`useAppStore`) for centralized client state management
- Added React Query (TanStack) for server data fetching with caching
- Implemented TradingPairsTracker with 10m/1h/24h time-window analytics
- Added tracked pair filtering — only persist offers for pairs in `tracked_pairs` table
- Fixed schema: generated `price` column, proper NUMERIC(38,18) types
- Enhanced `/rippled-status` with rate limit detection and connection issue reporting
- Added `/top-trading-pairs`, `/trading-stats`, `/pair-stats`, `/trading-pairs/realtime`, `/xrp-pairs/flashy` endpoints
- Added TopTradingPairs, OrderBookHeatmap, MarketDepth, StatsCards client components
- Header pair dropdown populated from `/tracked-pairs` API
- Removed local rippled sync semantics; default is public mainnet

## Active Decisions
- Public XRPL endpoints by default: ACCEPTED
- Track proposed transactions for activity signals: ACCEPTED
- Avoid hex currency storage: ENFORCED
- MUI v7 as component library: ADOPTED
- Zustand for state management: ADOPTED
- Only persist tracked pairs to DB: ENFORCED

## Next Steps
1. Add UI banner/toast when rate limited to reduce user confusion
2. Backoff strategy tuning to minimize repeated 429s
3. Cache `/tracked-pairs` response with short TTL to reduce DB load
4. Add error boundaries in client for resilience
5. CI/CD pipeline setup
6. Automated E2E tests

## Current Challenges
- Intermittent rate limiting from public XRPL endpoints
- Ensuring UI remains informative during WS reconnect/backoff periods

## Implementation Progress
- [x] Connection status popup reflects rate limiting and WS errors
- [x] Public mainnet connectivity configured
- [x] MUI migration complete
- [x] Zustand + React Query integration
- [x] TradingPairsTracker with time windows
- [x] Tracked pair filtering for DB writes
- [x] README and docs updated
- [ ] UI banner for rate limit events
- [ ] Caching layer for tracked pairs endpoint
- [ ] CI/CD pipeline
- [ ] Automated E2E tests

---

*This document captures the current state of work and immediate next steps.*
