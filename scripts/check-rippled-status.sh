#!/bin/bash

# Quick Rippled Status Check Script
# This script provides a quick overview of the rippled sync status

echo "🔍 Rippled Status Check"
echo "======================"
echo ""

# Check if rippled container is running
if ! docker-compose ps rippled | grep -q "Up"; then
    echo "❌ Rippled container is not running"
    echo "   Start it with: docker-compose up -d rippled"
    exit 1
fi

echo "✅ Rippled container is running"
echo ""

# Get rippled status
echo "📊 Current Status:"
docker exec rippled rippled server_info | jq -r '.result.info | "Complete Ledgers: \(.complete_ledgers // "empty")\nServer State: \(.server_state // "unknown")\nPeer Count: \(.peers // 0)\nValidated Ledger: \(.validated_ledger.ledger_index // "none")"' 2>/dev/null || echo "Rippled still starting up..."

echo ""
echo "📈 Sync Progress:"

# Get mainnet ledger for comparison
MAINNET_LEDGER=$(curl -s https://s1.ripple.com:51234/ -X POST -H "Content-Type: application/json" -d '{"method": "ledger_current"}' | jq -r '.result.ledger_current_index // "unknown"')

# Get local validated ledger
LOCAL_LEDGER=$(docker exec rippled rippled server_info | jq -r '.result.info.validated_ledger.ledger_index // "none"' 2>/dev/null)

echo "Mainnet Ledger: $MAINNET_LEDGER"
echo "Local Ledger: $LOCAL_LEDGER"

# Calculate progress if we have both values
if [[ "$LOCAL_LEDGER" != "none" && "$MAINNET_LEDGER" != "unknown" && "$LOCAL_LEDGER" -gt 0 ]]; then
    PROGRESS=$(echo "scale=2; $LOCAL_LEDGER * 100 / $MAINNET_LEDGER" | bc -l 2>/dev/null || echo "0")
    echo "Sync Progress: ${PROGRESS}%"
else
    echo "Sync Progress: Starting up..."
fi

echo ""
echo "📋 Quick Commands:"
echo "  Monitor sync: ./monitor_sync.sh"
echo "  View logs: docker-compose logs -f rippled"
echo "  Fresh sync: ./scripts/fresh-sync-rippled.sh" 