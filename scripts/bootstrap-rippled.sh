#!/bin/bash

# Rippled Bootstrap Script
# Downloads and installs a pre-built ledger database to skip the slow initial sync

set -e  # Exit on any error

echo "🔄 Starting rippled bootstrap process..."
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found. Please run this script from the project root directory."
    exit 1
fi

# Check if rippled is stopped
if docker-compose ps rippled | grep -q "Up"; then
    echo "❌ Error: Rippled is still running. Please stop it first with: docker-compose stop rippled"
    exit 1
fi

echo "📋 Current status:"
docker-compose ps rippled
echo ""

# Create bootstrap directory
echo "📁 Creating bootstrap directory..."
docker-compose run --rm --entrypoint sh rippled -c "mkdir -p /var/lib/rippled/db/nudb"
echo "✅ Bootstrap directory created"
echo ""

# Download bootstrap data
echo "📥 Downloading bootstrap data..."
echo "This may take 10-30 minutes depending on your internet connection..."
echo ""

# Try multiple bootstrap sources
BOOTSTRAP_SOURCES=(
    "https://xrpl.org/ledger-bootstrap.tar.gz"
    "https://xrpl.org/ledger-bootstrap/latest.tar.gz"
    "https://bootstrap.xrpl.org/ledger-bootstrap.tar.gz"
    "https://xrpl.org/ledger-bootstrap/rippled-bootstrap.tar.gz"
)

BOOTSTRAP_SUCCESS=false

for source in "${BOOTSTRAP_SOURCES[@]}"; do
    echo "🔄 Trying bootstrap source: $source"
    
    if docker-compose run --rm --entrypoint sh rippled -c "
        cd /var/lib/rippled/db/nudb && \
        wget -O - '$source' | tar -xz
    "; then
        echo "✅ Bootstrap data downloaded successfully from $source"
        BOOTSTRAP_SUCCESS=true
        break
    else
        echo "❌ Failed to download from $source"
    fi
done

if [ "$BOOTSTRAP_SUCCESS" = false ]; then
    echo ""
    echo "❌ All bootstrap sources failed."
    echo ""
    echo "📋 Alternative options:"
    echo "   1. Manual bootstrap download:"
    echo "      - Visit https://xrpl.org/ledger-bootstrap.html"
    echo "      - Download the latest bootstrap file manually"
    echo "      - Extract to /var/lib/rippled/db/nudb/"
    echo ""
    echo "   2. Try syncing without bootstrap (slower but will work eventually):"
    echo "      - docker-compose up -d rippled"
    echo "      - Be patient - it may take several hours"
    echo ""
    echo "   3. Use testnet instead:"
    echo "      - Modify rippled.cfg to use testnet"
    echo ""
    exit 1
fi

echo ""
echo "🔍 Verifying bootstrap data..."
docker-compose run --rm --entrypoint sh rippled -c "ls -la /var/lib/rippled/db/nudb/ | head -10"

echo ""
echo "🎉 Bootstrap completed!"
echo ""
echo "📈 Next steps:"
echo "   1. Start rippled: docker-compose up -d rippled"
echo "   2. Monitor sync: ./scripts/check-rippled-status.sh"
echo "   3. Real-time monitoring: ./monitor_sync.sh"
echo ""
echo "⚠️  Note: Bootstrap data is typically 1-2 weeks old."
echo "   Rippled will sync the remaining ledgers much faster now." 