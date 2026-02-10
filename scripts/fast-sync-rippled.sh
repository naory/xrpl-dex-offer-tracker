#!/bin/bash

# Fast Sync Rippled Script
# Configures rippled for faster syncing by optimizing settings and using better peers

set -e  # Exit on any error

echo "🚀 Starting fast sync configuration..."
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

# Clear existing data
echo "🗑️  Clearing existing data..."
docker-compose run --rm --entrypoint sh rippled -c "rm -rf /var/lib/rippled/db/*"
echo "✅ Data cleared"
echo ""

# Create optimized config
echo "⚙️  Creating optimized configuration..."
cat > rippled/rippled-fast-sync.cfg << 'EOF'
[server]
port_rpc = 5005
port_ws = 6006
port_peer = 51235

[port_rpc]
admin = 127.0.0.1, 192.168.0.0/16

[port_ws]
admin = 127.0.0.1, 192.168.0.0/16

[node_size]
large

[node_db]
type=NuDB
path=/var/lib/rippled/db/nudb
online_delete=256
advisory_delete=0

[full_history]
advisory_delete=0

# Optimized for faster syncing
[ledger_history]
300000

[fetch_depth]
2147483647

[network_quorum]
0.5

# Better peer configuration
[ips]
# XRP Mainnet Public Hubs with better connectivity
r.ripple.com 51235
s1.ripple.com 51235
s2.ripple.com 51235
s.altnet.rippletest.net 51235

# Additional reliable peers
zaphod.alloy.ee 51235
seed.ripple.com 51235

[debug_logfile]
/var/log/rippled/debug.log

[sntp_servers]
time.windows.com
time.apple.com
time.nist.gov
pool.ntp.org

# Performance optimizations
[load_factor_fee_escalation]
256

[load_factor_fee_queue]
256

[load_factor_fee_reference]
256

[load_factor_fee_resolution]
256

[load_factor_fee_units]
256

[load_factor_server]
256

# Faster validation
[validation_quorum]
0.5

# Optimize for syncing
[sync]
1

[ledger_fetch_size]
256
EOF

echo "✅ Optimized configuration created"
echo ""

# Copy the optimized config
echo "📋 Installing optimized configuration..."
docker-compose run --rm --entrypoint sh rippled -c "cp /config/rippled-fast-sync.cfg /etc/opt/ripple/rippled.cfg" || docker-compose run --rm --entrypoint sh rippled -c "cp /opt/ripple/etc/rippled-fast-sync.cfg /etc/opt/ripple/rippled.cfg"
echo "✅ Configuration installed"
echo ""

echo "🎉 Fast sync configuration completed!"
echo ""
echo "📈 Next steps:"
echo "   1. Start rippled: docker-compose up -d rippled"
echo "   2. Monitor sync: ./scripts/check-rippled-status.sh"
echo "   3. Real-time monitoring: ./monitor_sync.sh"
echo ""
echo "⚠️  Note: This configuration optimizes for faster syncing but may still take 1-3 hours."
echo "   The node will start from the beginning but with better performance settings." 