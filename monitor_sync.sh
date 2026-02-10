#!/bin/bash

echo "=== Rippled Sync Progress Monitor ==="
echo "Press Ctrl+C to stop monitoring"
echo ""

while true; do
    # Get mainnet ledger
    MAINNET_LEDGER=$(curl -s https://s1.ripple.com:51234/ -X POST -H "Content-Type: application/json" -d '{"method": "ledger_current"}' | jq -r '.result.ledger_current_index')
    
    # Get local rippled status
    LOCAL_INFO=$(docker exec rippled rippled server_info 2>/dev/null | jq -r '.result.info')
    COMPLETE_LEDGERS=$(echo "$LOCAL_INFO" | jq -r '.complete_ledgers // "empty"')
    SERVER_STATE=$(echo "$LOCAL_INFO" | jq -r '.server_state // "unknown"')
    PEER_COUNT=$(echo "$LOCAL_INFO" | jq -r '.peers // 0')
    VALIDATED_LEDGER=$(echo "$LOCAL_INFO" | jq -r '.validated_ledger.ledger_index // "none"')
    
    # Clear screen and show status
    clear
    echo "=== Rippled Sync Progress Monitor ==="
    echo "Timestamp: $(date)"
    echo ""
    echo "Mainnet ledger: $MAINNET_LEDGER"
    echo "Local progress: $COMPLETE_LEDGERS"
    echo "Server state: $SERVER_STATE"
    echo "Peer count: $PEER_COUNT"
    echo "Validated ledger: $VALIDATED_LEDGER"
    echo ""
    
    # Calculate progress if we have a validated ledger
    if [ "$VALIDATED_LEDGER" != "none" ] && [ "$VALIDATED_LEDGER" != "null" ]; then
        PROGRESS=$(echo "scale=2; $VALIDATED_LEDGER * 100 / $MAINNET_LEDGER" | bc -l 2>/dev/null || echo "0")
        echo "Sync progress: ${PROGRESS}%"
    else
        echo "Sync progress: Starting up..."
    fi
    
    echo ""
    echo "Press Ctrl+C to stop monitoring"
    
    sleep 10
done 