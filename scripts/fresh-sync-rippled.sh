#!/bin/bash

# Fresh Sync Rippled Script
# This script performs a fresh sync of the local rippled node by clearing
# the ledger database and restarting the container.

set -e  # Exit on any error

echo "🔄 Starting fresh sync of rippled node..."
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found. Please run this script from the project root directory."
    exit 1
fi

echo "📋 Current rippled status:"
docker-compose ps rippled
echo ""

# Stop rippled container
echo "🛑 Stopping rippled container..."
docker-compose stop rippled
echo "✅ Rippled container stopped"
echo ""

# Remove the ledger database and state files
echo "🗑️  Removing ledger database and state files..."
docker-compose run --rm --entrypoint sh rippled -c "rm -rf /var/lib/rippled/db/state* /var/lib/rippled/db/nudb"
echo "✅ Ledger database and state files removed"
echo ""

# Start rippled container
echo "🚀 Starting rippled container for fresh sync..."
docker-compose up -d rippled
echo "✅ Rippled container started"
echo ""

# Wait a moment for startup
echo "⏳ Waiting for rippled to start up..."
sleep 10

# Show initial status
echo "📊 Initial rippled status:"
docker exec rippled rippled server_info | jq '.result.info | {complete_ledgers, server_state, peers, validated_ledger: .validated_ledger.ledger_index}' 2>/dev/null || echo "Rippled still starting up..."

echo ""
echo "🎉 Fresh sync initiated!"
echo ""
echo "📈 Monitor sync progress with:"
echo "   ./monitor_sync.sh"
echo ""
echo "🔍 Check status with:"
echo "   docker exec rippled rippled server_info | jq '.result.info.complete_ledgers'"
echo ""
echo "⚠️  Note: Fresh sync will take several hours to download the full ledger history."
echo "   The connection status popup in the dashboard will show progress." 