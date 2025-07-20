#!/bin/bash

# Start the XRPL DEX offer tracker server
XRPL_NET=${1:-testnet}
echo "Starting XRPL DEX offer tracker server on $XRPL_NET..."
echo "Database: xrpl_dex on port 5433"
echo "API: http://localhost:3001"
echo ""

# Set environment variables for development
export PGPORT=5433
export XRPL_NET=$XRPL_NET

# Start the server
node index.js 