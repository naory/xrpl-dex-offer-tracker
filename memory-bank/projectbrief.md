# Project Brief: XRPL DEX Offer Tracker
*Version: 1.1*
*Last Updated: 2025-06*

## Project Overview
XRPL DEX Offer Tracker is a full-stack dashboard that ingests XRPL DEX activity (offers and transactions), stores relevant data in PostgreSQL, and presents real-time order book and market stats in a React UI. It connects to the public XRPL mainnet via WebSocket, and surfaces connection health, including rate limiting and recent activity.

## Core Requirements
- Display XRPL connection status with explicit rate limiting detection and messaging
- Connect to public XRPL mainnet (no local rippled by default)
- Dynamic trading pair selector populated from database API
- Accurately track and show top trading pairs and recent offers via TradingPairsTracker (10m/1h/24h windows)
- Robust server endpoints for health, rippled status, tracked pairs, and analytics
- Store only human-readable currency codes (never HEX) throughout the system
- MUI-based responsive UI with Zustand state management and React Query data fetching
- Only persist offers for tracked pairs (filtered DB writes)

## Success Criteria
- Connection popup shows Connected/Disconnected, Rate Limited, WebSocket errors, and recent activity status
- UI remains responsive and stable under rate limiting or intermittent connectivity
- Top Trading Pairs panel updates with live data from the tracker
- Pair dropdown reflects active pairs from the database and selections update views
- One-command local run with Docker Compose (PostgreSQL) + manual server/client start; tests pass

## Scope
### In Scope
- Public XRPL connectivity, status display, and rate limiting indicators
- Trading activity tracking and database-backed analytics
- React + MUI UI for pair selection, order book, depth chart, heatmap, and status dialogs
- In-memory TradingPairsTracker with time-window analytics
- Tracked pair filtering for selective DB writes

### Out of Scope
- Running and maintaining a local rippled node (temporarily excluded)
- Full historical backfill beyond near-term analytics
- Authentication / multi-user support

## Timeline
- Milestone 1 (Connectivity polish): Complete
- Milestone 2 (Top pairs + MUI migration): Complete
- Milestone 3 (Docs and ops hardening): In progress

## Stakeholders
- Product Owner: User
- Engineering: User + Assistant

---

*This document serves as the foundation for the project and informs all other memory files.*
