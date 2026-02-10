const xrpl = require('xrpl')
const defaultPool = require('./db')
const express = require('express')
const cors = require('cors')
const pool = require('./db')
const createApp = require('./app')
const fetch = require('node-fetch');
const fs = require('fs');
const TradingPairsTracker = require('./tradingPairsTracker');

// Example: USD issuer on XRPL testnet
const USD_ISSUER = 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq'
const REFRESH_CURRENCIES_INTERVAL = parseInt(process.env.REFRESH_CURRENCIES_INTERVAL, 10) || 60
const XRPL_NET = process.env.XRPL_NET || 'mainnet';

let XRPL_WS_URL;
let XRPL_HTTP_URL;

if (XRPL_NET.startsWith('ws://') || XRPL_NET.startsWith('wss://')) {
  XRPL_WS_URL = XRPL_NET;
  // When using a local rippled, the RPC port is typically different from the WS port.
  // In our docker-compose, rippled WS is on 6006 and RPC is on 5005.
  XRPL_HTTP_URL = XRPL_NET.replace(/^ws/, 'http').replace(':6006', ':5005');
  console.log(`Connecting to local rippled instance: WS at ${XRPL_WS_URL}, HTTP at ${XRPL_HTTP_URL}`);
} else {
  // Fallback to original logic for 'mainnet' or 'testnet' public servers
  XRPL_WS_URL = XRPL_NET === 'mainnet'
    ? 'wss://s1.ripple.com/'
    : 'wss://s.altnet.rippletest.net:51233';
  XRPL_HTTP_URL = XRPL_NET === 'mainnet'
    ? 'https://s1.ripple.com:51234/'
    : 'https://s.altnet.rippletest.net:51234/';
  console.log(`Connecting to public XRPL server: ${XRPL_NET}`);
}

let backfillInProgress = true;

async function loadTrackedPairs(pool) {
  const res = await pool.query(
    `SELECT taker_gets_currency, taker_gets_issuer, taker_pays_currency, taker_pays_issuer
     FROM tracked_pairs WHERE active = TRUE`
  )
  return res.rows.map(row => {
    // Format currencies for XRPL API
    const formatCurrency = (currency) => {
      if (currency === 'XRP') return 'XRP'
      // For non-XRP currencies, convert to hex format
      // Convert 3-letter ISO currency code to hex (40-bit)
      const hex = Buffer.from(currency, 'ascii').toString('hex').toUpperCase()
      return hex.padEnd(40, '0') // Pad to 40 characters (20 bytes)
    }
    
    return {
      taker_gets: {
        currency: formatCurrency(row.taker_gets_currency),
        ...(row.taker_gets_issuer ? { issuer: row.taker_gets_issuer } : {})
      },
      taker_pays: {
        currency: formatCurrency(row.taker_pays_currency),
        ...(row.taker_pays_issuer ? { issuer: row.taker_pays_issuer } : {})
      }
    }
  })
}

function pairsKey(pair) {
  return JSON.stringify(pair)
}

async function subscribeToOrderBook(client, taker_gets, taker_pays) {
  // Convert currency codes for XRPL subscription
  // XRPL API only accepts 3-char ISO codes in text format; anything else must stay as 40-char hex
  const convertForSubscription = (obj) => {
    if (obj.currency === 'XRP') return obj;
    const iso = hexToIsoCurrency(obj.currency);
    return {
      ...obj,
      currency: iso.length === 3 ? iso : obj.currency
    };
  };

  const subscriptionRequest = {
    command: 'subscribe',
    books: [
      {
        taker_gets: convertForSubscription(taker_gets),
        taker_pays: convertForSubscription(taker_pays),
        snapshot: true,
        both: true
      }
    ]
  };

  const response = await client.request(subscriptionRequest);
  const bidCount = response.result?.bids?.length || 0;
  const askCount = response.result?.asks?.length || 0;
  console.log(`[XRPL] Subscribed to order book: ${JSON.stringify({taker_gets, taker_pays})} (${bidCount} bids, ${askCount} asks)`);
}

async function subscribeToTransactions(client) {
  const transactionSubscriptionRequest = {
    command: 'subscribe',
    streams: ['transactions_proposed', 'transactions']
  };

  await client.request(transactionSubscriptionRequest);
  console.log('[XRPL] Subscribed to transaction streams');
}

async function handleTransaction(tx, pool = defaultPool, tradingPairsTracker = null) {
  // Update last transaction time
  lastTransactionTime = Date.now();
  if (!tx || (!tx.transaction && !tx.tx_json)) return
  const txn = tx.transaction || tx.tx_json
  const { TransactionType, Account, Sequence, TakerGets, TakerPays, Flags, Expiration, hash } = txn
  const offerId = hash
  const eventTime = new Date()

  // Main transaction processing path - handle all offer transactions (including proposed ones without meta)
  if ((TransactionType === 'OfferCreate' || TransactionType === 'OfferCancel' || TransactionType === 'OfferModify') && TakerGets != null && TakerPays != null) {
    // Parse offer fields for main transaction
    let taker_gets_currency, taker_gets_issuer, taker_gets_value
    let taker_pays_currency, taker_pays_issuer, taker_pays_value

    if (typeof TakerGets === 'object') {
      taker_gets_currency = hexToIsoCurrency(TakerGets.currency)
      taker_gets_issuer = TakerGets.issuer || null
      taker_gets_value = TakerGets.value
    } else {
      taker_gets_currency = 'XRP'
      taker_gets_issuer = null
      taker_gets_value = xrpl.dropsToXrp(TakerGets)
    }
    
    if (typeof TakerPays === 'object') {
      taker_pays_currency = hexToIsoCurrency(TakerPays.currency)
      taker_pays_issuer = TakerPays.issuer || null
      taker_pays_value = TakerPays.value
    } else {
      taker_pays_currency = 'XRP'
      taker_pays_issuer = null
      taker_pays_value = xrpl.dropsToXrp(TakerPays)
    }
    
    // Record trading activity for all offer events (including proposed transactions)
    if (tradingPairsTracker) {
      try {
        const takerGets = {
          currency: taker_gets_currency,
          issuer: taker_gets_issuer,
          value: taker_gets_value
        };
        const takerPays = {
          currency: taker_pays_currency,
          issuer: taker_pays_issuer,
          value: taker_pays_value
        };
        
        // Use a small volume for offer activity (not actual fills)
        const activityVolume = TransactionType === 'OfferCreate' ? 0.001 : 0.0001;
        tradingPairsTracker.recordTrade(takerGets, takerPays, activityVolume, eventTime.getTime());
      } catch (err) {
        console.error('[ERROR] Failed to record trading activity:', err.message);
      }
    }
  }

  // Meta node processing - only for validated transactions with meta data
  if (!tx.meta) return

  // Process all offers in meta.AffectedNodes
  if (tx.meta && Array.isArray(tx.meta.AffectedNodes)) {
    for (const node of tx.meta.AffectedNodes) {
      try {
        let offerNode = null
        let eventType = ''
        let offer_id = null
        let previousFields = null // Track previous state for volume calculation

        if (node.CreatedNode && node.CreatedNode.LedgerEntryType === 'Offer') {
          offerNode = node.CreatedNode.NewFields
          eventType = 'created'
          offer_id = node.CreatedNode.LedgerIndex
        } else if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === 'Offer') {
          offerNode = node.ModifiedNode.FinalFields
          previousFields = node.ModifiedNode.PreviousFields
          eventType = 'modified'
          offer_id = node.ModifiedNode.LedgerIndex
        } else if (node.DeletedNode && node.DeletedNode.LedgerEntryType === 'Offer') {
          offerNode = node.DeletedNode.FinalFields || node.DeletedNode.PreviousFields
          eventType = 'cancelled'
          offer_id = node.DeletedNode.LedgerIndex
        } else if (node.LedgerEntryType === 'Offer') {
          offerNode = node;
          eventType = 'unknown';
          offer_id = node.LedgerIndex;
        }
        
        if (offerNode && offer_id) {
          // Parse offer fields
          const account = offerNode.Account || null
          let taker_gets_currency, taker_gets_issuer, taker_gets_value
          let taker_pays_currency, taker_pays_issuer, taker_pays_value
          
          if (typeof offerNode.TakerGets === 'object') {
            taker_gets_currency = hexToIsoCurrency(offerNode.TakerGets.currency)
            taker_gets_issuer = offerNode.TakerGets.issuer || null
            taker_gets_value = offerNode.TakerGets.value
          } else {
            taker_gets_currency = 'XRP'
            taker_gets_issuer = null
            taker_gets_value = xrpl.dropsToXrp(offerNode.TakerGets)
          }
          
          if (typeof offerNode.TakerPays === 'object') {
            taker_pays_currency = hexToIsoCurrency(offerNode.TakerPays.currency)
            taker_pays_issuer = offerNode.TakerPays.issuer || null
            taker_pays_value = offerNode.TakerPays.value
          } else {
            taker_pays_currency = 'XRP'
            taker_pays_issuer = null
            taker_pays_value = xrpl.dropsToXrp(offerNode.TakerPays)
          }
          
          const flags = offerNode.Flags || null
          const expiration = offerNode.Expiration ? rippleEpochToDate(offerNode.Expiration) : null
          
          // Record trade for FILLED/CONSUMED offers (modified or deleted due to trading)
          if ((eventType === 'modified' || eventType === 'cancelled') && 
              typeof tradingPairsTracker !== 'undefined' && 
              previousFields) {
            try {
              // Calculate the amount that was consumed/filled
              let filledXRPVolume = 0;
              
              if (eventType === 'modified' && previousFields.TakerGets) {
                // Offer was partially filled - calculate the difference
                let prevTakerGets, prevTakerPays;
                
                if (typeof previousFields.TakerGets === 'object') {
                  prevTakerGets = parseFloat(previousFields.TakerGets.value);
                } else {
                  prevTakerGets = parseFloat(xrpl.dropsToXrp(previousFields.TakerGets));
                }
                
                if (typeof previousFields.TakerPays === 'object') {
                  prevTakerPays = parseFloat(previousFields.TakerPays.value);
                } else {
                  prevTakerPays = parseFloat(xrpl.dropsToXrp(previousFields.TakerPays));
                }
                
                // Calculate filled amount
                const currentTakerGets = parseFloat(taker_gets_value);
                const currentTakerPays = parseFloat(taker_pays_value);
                
                const filledTakerGets = prevTakerGets - currentTakerGets;
                const filledTakerPays = prevTakerPays - currentTakerPays;
                
                // Use XRP amount as volume
                if (taker_gets_currency === 'XRP') {
                  filledXRPVolume = filledTakerGets;
                } else if (taker_pays_currency === 'XRP') {
                  filledXRPVolume = filledTakerPays;
                }
              } else if (eventType === 'cancelled') {
                // Offer was fully consumed - use remaining amounts
                // (Note: This might be a cancel, not a fill, so check transaction type)
                if (TransactionType === 'OfferCreate' || TransactionType === 'Payment') {
                  // Likely a fill, not a manual cancel
                  if (taker_gets_currency === 'XRP') {
                    filledXRPVolume = parseFloat(taker_gets_value);
                  } else if (taker_pays_currency === 'XRP') {
                    filledXRPVolume = parseFloat(taker_pays_value);
                  }
                }
              }
              
              if (filledXRPVolume > 0) {
                const takerGets = {
                  currency: taker_gets_currency,
                  issuer: taker_gets_issuer,
                  value: taker_gets_value
                };
                const takerPays = {
                  currency: taker_pays_currency,
                  issuer: taker_pays_issuer,
                  value: taker_pays_value
                };

                tradingPairsTracker.recordTrade(takerGets, takerPays, filledXRPVolume, eventTime.getTime());
              }
            } catch (err) {
              console.error('[ERROR] Failed to record trade fill in trading pairs tracker:', err);
            }
          }
          
          // Only write to DB for tracked pairs
          if (isTrackedPair(taker_gets_currency, taker_gets_issuer, taker_pays_currency, taker_pays_issuer)) {
            // Insert into offer_history
            await pool.query(
              `INSERT INTO offer_history (
                offer_id, account, taker_gets_currency, taker_gets_issuer, taker_gets_value,
                taker_pays_currency, taker_pays_issuer, taker_pays_value, flags, expiration, event_type, event_time
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
              [
                offer_id, account, taker_gets_currency, taker_gets_issuer, taker_gets_value,
                taker_pays_currency, taker_pays_issuer, taker_pays_value, flags, expiration, eventType, eventTime
              ]
            )

            // Upsert into offers (for created/modified), delete for cancelled
            if (eventType === 'created' || eventType === 'modified' || eventType === 'unknown') {
              await pool.query(
                `INSERT INTO offers (
                  offer_id, account, taker_gets_currency, taker_gets_issuer, taker_gets_value,
                  taker_pays_currency, taker_pays_issuer, taker_pays_value, flags, expiration, updated_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
                ON CONFLICT (offer_id) DO UPDATE SET
                  account=EXCLUDED.account,
                  taker_gets_currency=EXCLUDED.taker_gets_currency,
                  taker_gets_issuer=EXCLUDED.taker_gets_issuer,
                  taker_gets_value=EXCLUDED.taker_gets_value,
                  taker_pays_currency=EXCLUDED.taker_pays_currency,
                  taker_pays_issuer=EXCLUDED.taker_pays_issuer,
                  taker_pays_value=EXCLUDED.taker_pays_value,
                  flags=EXCLUDED.flags,
                  expiration=EXCLUDED.expiration,
                  updated_at=NOW()
              `,
                [
                  offer_id, account, taker_gets_currency, taker_gets_issuer, taker_gets_value,
                  taker_pays_currency, taker_pays_issuer, taker_pays_value, flags, expiration
                ]
              )
            } else if (eventType === 'cancelled') {
              await pool.query('DELETE FROM offers WHERE offer_id = $1', [offer_id])
            }
          }
          
          // Record trading activity for all offer events (not just fills)
          if (tradingPairsTracker) {
            try {
              const takerGets = {
                currency: taker_gets_currency,
                issuer: taker_gets_issuer,
                value: taker_gets_value
              };
              const takerPays = {
                currency: taker_pays_currency,
                issuer: taker_pays_issuer,
                value: taker_pays_value
              };
              
              // Use a small volume for offer activity (not actual fills)
              const activityVolume = eventType === 'created' ? 0.001 : 0.0001;
              tradingPairsTracker.recordTrade(takerGets, takerPays, activityVolume, eventTime.getTime());
            } catch (err) {
              console.error('[ERROR] Failed to record trading activity:', err.message);
            }
          }
        }
      } catch (e) {
        console.error('[ERROR] Failed to process offer from meta node:', e)
      }
    }
  }
}

/**
 * Backfill offers for all tracked pairs using XRPL HTTP API (book_offers)
 */
async function backfillOffersForTrackedPairs(pool, trackedPairs) {
  console.log('[BACKFILL] Starting backfill for tracked pairs...');
  for (const pair of trackedPairs) {
    let marker = null;
    let page = 1;
    do {
      const body = {
        method: 'book_offers',
        params: [{
          taker_gets: pair.taker_gets,
          taker_pays: pair.taker_pays,
          limit: 200,
          ...(marker ? { marker } : {})
        }]
      };
      const response = await fetch(XRPL_HTTP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!data.result || !Array.isArray(data.result.offers)) {
        console.error('[BACKFILL] Error fetching offers:', data);
        break;
      }
      console.log(`[BACKFILL] Pair ${JSON.stringify(pair)} page ${page}: ${data.result.offers.length} offers`);
      for (const offer of data.result.offers) {
        await upsertOfferForBackfill(pool, offer, pair);
      }
      marker = data.result.marker;
      page++;
    } while (marker);
  }
  console.log('[BACKFILL] Backfill complete.');
}

// Initialize trading pairs tracker
const tradingPairsTracker = new TradingPairsTracker();

// Trading tracker is ready

// Set of tracked currency pair keys for filtering DB writes (e.g., "XRP|null|RLUSD|rMxC...")
let trackedPairCurrencyKeys = new Set();

function buildTrackedCurrencyKey(getCurrency, getIssuer, paysCurrency, paysIssuer) {
  return `${getCurrency}|${getIssuer || ''}|${paysCurrency}|${paysIssuer || ''}`;
}

function isTrackedPair(getCurrency, getIssuer, paysCurrency, paysIssuer) {
  const key1 = buildTrackedCurrencyKey(getCurrency, getIssuer, paysCurrency, paysIssuer);
  const key2 = buildTrackedCurrencyKey(paysCurrency, paysIssuer, getCurrency, getIssuer);
  return trackedPairCurrencyKeys.has(key1) || trackedPairCurrencyKeys.has(key2);
}

// XRPL WebSocket variables
let client = null;
let server = null;
let currentPairs = [];
let subscribedKeys = new Set();
let reconnectDelay = 1000;
const maxDelay = 30000;
let lastTransactionTime = null;
let lastConnectionError = null;

async function connectAndSubscribe() {
  console.log('[XRPL] connectAndSubscribe: starting');
  client = new xrpl.Client(XRPL_WS_URL);
  try {
    await client.connect();
    console.log('[XRPL] Connected to XRPL WebSocket (' + XRPL_NET + ")");
    
    // Initial load and subscribe
    currentPairs = await loadTrackedPairs(pool);
    console.log(`[XRPL] Loaded ${currentPairs.length} tracked pairs`);
    subscribedKeys = new Set(currentPairs.map(pairsKey));

    // Build tracked pair keys using ISO-converted currencies for DB write filtering
    trackedPairCurrencyKeys.clear();
    for (const pair of currentPairs) {
      const getCurrency = pair.taker_gets.currency === 'XRP' ? 'XRP' : hexToIsoCurrency(pair.taker_gets.currency);
      const getIssuer = pair.taker_gets.issuer || '';
      const paysCurrency = pair.taker_pays.currency === 'XRP' ? 'XRP' : hexToIsoCurrency(pair.taker_pays.currency);
      const paysIssuer = pair.taker_pays.issuer || '';
      trackedPairCurrencyKeys.add(buildTrackedCurrencyKey(getCurrency, getIssuer, paysCurrency, paysIssuer));
    }
    console.log(`[XRPL] Tracked pair keys for DB filtering:`, [...trackedPairCurrencyKeys]);
    
    // Try to subscribe to order books (but don't fail if this doesn't work)
    try {
      const orderBookSuccess = await subscribeToPairs(client, currentPairs);
      console.log(`[XRPL] Order book subscription result: ${orderBookSuccess ? 'success' : 'partial failure'}`);
    } catch (err) {
      console.warn('[XRPL] Order book subscription failed, but continuing with transaction subscription:', err);
    }
    
    // Always attempt to subscribe to transaction streams
    console.log('[XRPL] Subscribing to transaction streams...');
    try {
      await subscribeToTransactions(client);
      console.log('[XRPL] Successfully subscribed to transaction streams');
    } catch (err) {
      console.error('[XRPL] Failed to subscribe to transaction streams:', err);
      throw err; // This is critical, so fail if it doesn't work
    }
    
    client.on('transaction', (tx) => {
      const txHuman = convertCurrenciesToISO(tx);
      if (process.env.LOG_FULL_TX) {
        console.log(`[${new Date().toISOString()}] Full transaction event:`, JSON.stringify(txHuman, null, 2));
      }
      handleTransaction(tx, pool, tradingPairsTracker).catch(console.error);
    });
    
    client.on('ledgerClosed', () => {});
    
    client.on('disconnected', handleDisconnect);
    client.on('error', handleError);
    reconnectDelay = 1000; // Reset delay on successful connect
    
    // Start periodic refresh
    setInterval(refreshPairs, REFRESH_CURRENCIES_INTERVAL * 1000);
    
    // Start the Express server after WebSocket connection
    startExpressServer();
    
  } catch (err) {
    console.error('[XRPL] XRPL connection error:', err);
    scheduleReconnect();
  }
}

async function subscribeToPairs(client, pairs) {
  let successCount = 0;
  for (const pair of pairs) {
    try {
      await subscribeToOrderBook(client, pair.taker_gets, pair.taker_pays);
      successCount++;
    } catch (err) {
      console.error('Error subscribing to pair:', pair, err);
    }
  }
  console.log(`Successfully subscribed to ${successCount}/${pairs.length} order book pairs`);
  return successCount > 0; // Return true if at least one subscription succeeded
}

async function refreshPairs() {
  try {
    const newPairs = await loadTrackedPairs(pool);
    const newKeys = new Set(newPairs.map(pairsKey));
    // Find pairs to subscribe (new) and unsubscribe (removed)
    const toSubscribe = newPairs.filter(p => !subscribedKeys.has(pairsKey(p)));
    // Unsubscribe logic can be added here if needed
    if (toSubscribe.length) {
      await subscribeToPairs(client, toSubscribe);
      toSubscribe.forEach(p => subscribedKeys.add(pairsKey(p)));
    }
    // Optionally, handle unsubscription for removed pairs
    // (not implemented here for simplicity)
    currentPairs = newPairs;
  } catch (err) {
    console.error('Error refreshing tracked pairs:', err);
  }
}

function handleDisconnect() {
  console.warn('XRPL WebSocket disconnected');
  scheduleReconnect();
}

function handleError(err) {
  console.error('XRPL WebSocket error:', err);
  lastConnectionError = err.message || err.toString();
  scheduleReconnect();
}

function scheduleReconnect() {
  if (client && client.isConnected()) {
    client.disconnect().catch(() => {});
  }
  setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
    console.log(`Reconnecting to XRPL in ${reconnectDelay / 1000}s...`);
    connectAndSubscribe();
  }, reconnectDelay);
}

function startExpressServer() {
  console.log("Starting Express server after WebSocket connection established...");
  const app = createApp(pool, tradingPairsTracker);
  
  // Expose XRPL client and status to the Express app for health checks
  app.locals.xrplClient = client;
  app.locals.backfillInProgress = backfillInProgress;
  app.locals.lastTransactionTime = lastTransactionTime;
  app.locals.lastConnectionError = lastConnectionError;
  
  const port = process.env.PORT || 3001;
  server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    if (server) {
      server.close(() => {
        console.log('HTTP server closed');
        if (client && client.isConnected()) {
          client.disconnect().then(() => {
            console.log('XRPL client disconnected');
            process.exit(0);
          }).catch(() => {
            console.log('Error disconnecting XRPL client');
            process.exit(1);
          });
        } else {
          process.exit(0);
        }
      });
    }
  });

  // Update backfill status, last transaction time, and last connection error in app locals when they change
  setInterval(() => {
    if (app.locals.backfillInProgress !== backfillInProgress) {
      app.locals.backfillInProgress = backfillInProgress;
    }
    if (app.locals.lastTransactionTime !== lastTransactionTime) {
      app.locals.lastTransactionTime = lastTransactionTime;
    }
    if (app.locals.lastConnectionError !== lastConnectionError) {
      app.locals.lastConnectionError = lastConnectionError;
    }
  }, 1000);
}

// Populate trading pairs tracker with historical data from offers
async function populateTradingPairsTracker(pool, tradingPairsTracker) {
  try {
    console.log('[TRADING_TRACKER] Populating with historical data from offers...');

    const result = await pool.query(`
      SELECT
        taker_gets_currency, taker_gets_issuer, taker_gets_value,
        taker_pays_currency, taker_pays_issuer, taker_pays_value,
        updated_at
      FROM offers
      ORDER BY updated_at DESC
      LIMIT 1000
    `);

    let populatedCount = 0;
    for (const offer of result.rows) {
      const takerGets = {
        currency: offer.taker_gets_currency,
        issuer: offer.taker_gets_issuer,
        value: offer.taker_gets_value
      };
      const takerPays = {
        currency: offer.taker_pays_currency,
        issuer: offer.taker_pays_issuer,
        value: offer.taker_pays_value
      };

      try {
        tradingPairsTracker.recordTrade(takerGets, takerPays, 0.001, new Date(offer.updated_at).getTime());
        populatedCount++;
      } catch (recordError) {
        // Skip individual failures silently
      }
    }

    console.log(`[TRADING_TRACKER] Populated ${populatedCount}/${result.rows.length} historical offers`);
  } catch (error) {
    console.error('[ERROR] Failed to populate trading pairs tracker:', error.message);
  }
}

// Only start the server if this is the main module (not being imported for testing)
if (require.main === module) {
  // Refactored: run backfill, then start websocket and server
  (async () => {
    console.log('[STARTUP] Starting server initialization...');
    const trackedPairs = await loadTrackedPairs(pool);
    console.log('[STARTUP] Loaded tracked pairs:', trackedPairs.length);
    backfillInProgress = true;
    console.log('[STARTUP] Starting backfill...');
    await backfillOffersForTrackedPairs(pool, trackedPairs);
    backfillInProgress = false;
    console.log('[STARTUP] Backfill completed, starting population...');
    
    // Populate trading pairs tracker with historical data
    // Temporarily disabled due to currency conversion issues
    // await populateTradingPairsTracker(pool, tradingPairsTracker);
    console.log('[STARTUP] Population skipped, starting WebSocket connection...');
    
    await connectAndSubscribe();
    console.log('[STARTUP] Server initialization complete');
  })();
} else {
  // For testing: create app without WebSocket connection
  const app = createApp(pool, tradingPairsTracker);
  app.locals.xrplClient = null; // No WebSocket in test mode
  app.locals.backfillInProgress = false;
  module.exports.app = app;
}

module.exports = { handleTransaction, backfillOffersForTrackedPairs }; 

// Helper to convert XRPL hex currency code to ISO 3-letter code
function hexToIsoCurrency(hex) {
  if (!hex || hex === 'XRP') return 'XRP';
  if (hex.length === 3) return hex; // Already ISO
  try {
    const buf = Buffer.from(hex, 'hex');
    const ascii = buf.toString('ascii').replace(/\0+$/, '');
    // Allow letters, numbers, and some special characters, length 3-20
    if (/^[A-Za-z0-9]{3,20}$/.test(ascii)) return ascii;
    return hex;
  } catch {
    return hex;
  }
} 

// Helper to recursively convert currency fields in an object from hex to ISO
function convertCurrenciesToISO(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertCurrenciesToISO);
  } else if (obj && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (key === 'currency' && typeof obj[key] === 'string') {
        newObj[key] = hexToIsoCurrency(obj[key]);
      } else {
        newObj[key] = convertCurrenciesToISO(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
} 

// Helper: Convert drops to XRP string
function dropsToXrp(drops) {
  return (BigInt(drops) / 1000000n).toString() + '.' + (BigInt(drops) % 1000000n).toString().padStart(6, '0');
}
// Helper: Convert Ripple Epoch (seconds since 2000-01-01) to JS Date
function rippleEpochToDate(secs) {
  if (!secs) return null;
  const rippleEpoch = Date.UTC(2000, 0, 1) / 1000;
  return new Date((Number(secs) + rippleEpoch) * 1000);
}

/**
 * Upsert a single offer from XRPL book_offers into the offers table
 */
async function upsertOfferForBackfill(pool, offer, pair) {
  // TakerGets
  let taker_gets_currency, taker_gets_issuer, taker_gets_value;
  if (typeof offer.TakerGets === 'string') {
    taker_gets_currency = 'XRP';
    taker_gets_issuer = null;
    taker_gets_value = dropsToXrp(offer.TakerGets);
  } else {
    taker_gets_currency = hexToIsoCurrency(offer.TakerGets.currency);
    taker_gets_issuer = offer.TakerGets.issuer;
    taker_gets_value = offer.TakerGets.value;
  }
  // TakerPays
  let taker_pays_currency, taker_pays_issuer, taker_pays_value;
  if (typeof offer.TakerPays === 'string') {
    taker_pays_currency = 'XRP';
    taker_pays_issuer = null;
    taker_pays_value = dropsToXrp(offer.TakerPays);
  } else {
    taker_pays_currency = hexToIsoCurrency(offer.TakerPays.currency);
    taker_pays_issuer = offer.TakerPays.issuer;
    taker_pays_value = offer.TakerPays.value;
  }
  // Expiration
  const expiration = offer.Expiration ? rippleEpochToDate(offer.Expiration) : null;
  try {
    await pool.query(`
      INSERT INTO offers (
        offer_id, account, taker_gets_currency, taker_gets_issuer, taker_gets_value,
        taker_pays_currency, taker_pays_issuer, taker_pays_value, flags, expiration, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      ON CONFLICT (offer_id) DO UPDATE SET
        account=EXCLUDED.account,
        taker_gets_currency=EXCLUDED.taker_gets_currency,
        taker_gets_issuer=EXCLUDED.taker_gets_issuer,
        taker_gets_value=EXCLUDED.taker_gets_value,
        taker_pays_currency=EXCLUDED.taker_pays_currency,
        taker_pays_issuer=EXCLUDED.taker_pays_issuer,
        taker_pays_value=EXCLUDED.taker_pays_value,
        flags=EXCLUDED.flags,
        expiration=EXCLUDED.expiration,
        updated_at=NOW()
    `, [
      offer.index,
      offer.Account,
      taker_gets_currency,
      taker_gets_issuer,
      taker_gets_value,
      taker_pays_currency,
      taker_pays_issuer,
      taker_pays_value,
      offer.Flags,
      expiration
    ]);
  } catch (err) {
    console.error(`[BACKFILL] Failed to upsert offer ${offer.index}:`, err.message);
  }
} 