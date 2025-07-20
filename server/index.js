const xrpl = require('xrpl')
const defaultPool = require('./db')
const express = require('express')
const cors = require('cors')
const pool = require('./db')
const createApp = require('./app')
const fetch = require('node-fetch');
const fs = require('fs');

// Example: USD issuer on XRPL testnet
const USD_ISSUER = 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq'
const REFRESH_CURRENCIES_INTERVAL = parseInt(process.env.REFRESH_CURRENCIES_INTERVAL, 10) || 60
const XRPL_NET = process.env.XRPL_NET || 'testnet';
const XRPL_WS_URL = XRPL_NET === 'mainnet'
  ? 'wss://s1.ripple.com/'
  : 'wss://s.altnet.rippletest.net:51233';

// XRPL HTTP API endpoint (public server)
const XRPL_HTTP_URL = XRPL_NET === 'mainnet'
  ? 'https://s1.ripple.com:51234/'
  : 'https://s.altnet.rippletest.net:51234/';

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
  const request = {
    command: 'subscribe',
    books: [
      {
        taker_gets,
        taker_pays,
        snapshot: true,
        both: true
      }
    ]
  }
  const response = await client.request(request)
  console.log('Subscribed to order book:', {taker_gets, taker_pays}, response)
  if (response.result && (response.result.bids || response.result.asks)) {
    console.log('Initial order book snapshot:')
    if (response.result.bids) {
      response.result.bids.forEach((bid, i) => {
        console.log(`[BID ${i+1}]`, bid)
      })
    }
    if (response.result.asks) {
      response.result.asks.forEach((ask, i) => {
        console.log(`[ASK ${i+1}]`, ask)
      })
    }
  }
}

async function handleTransaction(tx, pool = defaultPool) {
  try {
    console.log('[DEBUG] handleTransaction called with tx:', JSON.stringify(tx, (k, v) => (typeof v === 'object' && v !== null ? v : v), 2).slice(0, 2000));
  } catch (err) {
    console.error('[ERROR] Could not stringify tx:', err);
  }
  if (!tx || (!tx.transaction && !tx.tx_json) || !tx.meta) return
  const txn = tx.transaction || tx.tx_json
  const { TransactionType, Account, Sequence, TakerGets, TakerPays, Flags, Expiration, hash } = txn
  const offerId = hash
  const eventTime = new Date()

  // Process all offers in meta.AffectedNodes
  if (tx.meta && Array.isArray(tx.meta.AffectedNodes)) {
    console.log('[DEBUG] Entering meta node loop');
    for (const node of tx.meta.AffectedNodes) {
      try {
        console.log('[DEBUG] Processing meta node:', JSON.stringify(node));
        let offerNode = null
        let eventType = ''
        let offer_id = null
        if (node.CreatedNode && node.CreatedNode.LedgerEntryType === 'Offer') {
          console.log('[DEBUG] Matched CreatedNode Offer');
          offerNode = node.CreatedNode.NewFields
          eventType = 'created'
          offer_id = node.CreatedNode.LedgerIndex
        } else if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === 'Offer') {
          console.log('[DEBUG] Matched ModifiedNode Offer');
          offerNode = node.ModifiedNode.FinalFields
          eventType = 'modified'
          offer_id = node.ModifiedNode.LedgerIndex
        } else if (node.DeletedNode && node.DeletedNode.LedgerEntryType === 'Offer') {
          console.log('[DEBUG] Matched DeletedNode Offer');
          offerNode = node.DeletedNode.FinalFields
          eventType = 'cancelled'
          offer_id = node.DeletedNode.LedgerIndex
        // Also handle nodes where the node itself is an Offer (not wrapped)
        } else if (node.LedgerEntryType === 'Offer') {
          console.log('[DEBUG] Matched Direct Offer Node');
          offerNode = node;
          eventType = 'unknown';
          offer_id = node.LedgerIndex;
        } else {
          console.log('[DEBUG] No match for node:', JSON.stringify(node));
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
          const expiration = offerNode.Expiration || null
          // Insert into offer_history
          console.log(`[${new Date().toISOString()}][${eventType.toUpperCase()}][META] Offer ${offer_id} by ${account}: ${taker_gets_value} ${taker_gets_currency} for ${taker_pays_value} ${taker_pays_currency}`)
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
      } catch (err) {
        console.error('[ERROR] Exception in meta node loop:', err);
      }
    }
  }

  // Only handle offer-related transactions
  if (TransactionType === 'OfferCreate' || TransactionType === 'OfferCancel' || TransactionType === 'OfferModify') {
    let eventType = ''
    if (TransactionType === 'OfferCreate') eventType = 'created'
    if (TransactionType === 'OfferCancel') eventType = 'cancelled'
    if (TransactionType === 'OfferModify') eventType = 'modified'

    // Parse offer fields
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

    // Insert into offer_history
    console.log(`[${new Date().toISOString()}][${eventType.toUpperCase()}] Offer ${offerId} by ${Account}: ${taker_gets_value} ${hexToIsoCurrency(taker_gets_currency)} for ${taker_pays_value} ${hexToIsoCurrency(taker_pays_currency)}`)
    await pool.query(
      `INSERT INTO offer_history (
        offer_id, account, taker_gets_currency, taker_gets_issuer, taker_gets_value,
        taker_pays_currency, taker_pays_issuer, taker_pays_value, flags, expiration, event_type, event_time
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        offerId, Account, taker_gets_currency, taker_gets_issuer, taker_gets_value,
        taker_pays_currency, taker_pays_issuer, taker_pays_value, Flags, Expiration, eventType, eventTime
      ]
    )

    // Upsert into offers (for created/modified), delete for cancelled
    if (eventType === 'created' || eventType === 'modified') {
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
          offerId, Account, taker_gets_currency, taker_gets_issuer, taker_gets_value,
          taker_pays_currency, taker_pays_issuer, taker_pays_value, Flags, Expiration
        ]
      )
    } else if (eventType === 'cancelled') {
      await pool.query('DELETE FROM offers WHERE offer_id = $1', [offerId])
    }
  }
}

/**
 * Backfill offers for all tracked pairs using XRPL HTTP API (book_offers)
 */
async function backfillOffersForTrackedPairs(pool, trackedPairs) {
  // Log current database and schema
  try {
    const result = await pool.query('SELECT current_database(), current_schema()');
    console.log('[BACKFILL][DEBUG] Using DB:', result.rows[0]);
  } catch (err) {
    console.error('[BACKFILL][DEBUG] Failed to get DB info:', err);
  }
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
        // Log row count after each upsert
        try {
          const count = await pool.query('SELECT COUNT(*) FROM offers');
          console.log(`[BACKFILL][DEBUG] Offers table row count: ${count.rows[0].count}`);
        } catch (err) {
          console.error('[BACKFILL][DEBUG] Failed to get offers row count:', err);
        }
      }
      marker = data.result.marker;
      page++;
    } while (marker);
  }
  console.log('[BACKFILL] Backfill complete.');
}

async function startXRPLClient() {
  let client
  let reconnectDelay = 1000 // Start with 1 second
  const maxDelay = 30000 // Max 30 seconds
  let currentPairs = []
  let subscribedKeys = new Set()

  async function subscribeToPairs(client, pairs) {
    if (!pairs.length) return
    const books = pairs.map(({ taker_gets, taker_pays }) => ({
      taker_gets,
      taker_pays,
      snapshot: true,
      both: true
    }))
    const request = {
      command: 'subscribe',
      books,
      streams: ['transactions'],
    }
    const response = await client.request(request)
    console.log('Subscribed to order books:', books, response)
    // Log initial snapshots for all books
    if (response.result && response.result.books) {
      response.result.books.forEach((book, i) => {
        if (book.bids || book.asks) {
          console.log(`Initial order book snapshot for pair ${i}:`)
          if (book.bids) book.bids.forEach((bid, j) => console.log(`[BID ${j+1}]`, bid))
          if (book.asks) book.asks.forEach((ask, j) => console.log(`[ASK ${j+1}]`, ask))
        }
      })
    }
  }

  async function connectAndSubscribe() {
    client = new xrpl.Client(XRPL_WS_URL)
    try {
      await client.connect()
      console.log('Connected to XRPL WebSocket (' + XRPL_NET + ")")
      // Initial load and subscribe
      currentPairs = await loadTrackedPairs(pool)
      subscribedKeys = new Set(currentPairs.map(pairsKey))
      await subscribeToPairs(client, currentPairs)
      client.on('transaction', (tx) => {
        const txHuman = convertCurrenciesToISO(tx);
        if (process.env.LOG_FULL_TX) {
          console.log(`[${new Date().toISOString()}] Full transaction event:`, JSON.stringify(txHuman, null, 2));
        }
        handleTransaction(tx).catch(console.error)
      })
      client.on('ledgerClosed', (ledger) => {
        console.log('Ledger closed:', ledger.ledger_index)
      })
      client.on('disconnected', handleDisconnect)
      client.on('error', handleError)
      reconnectDelay = 1000 // Reset delay on successful connect
      // Start periodic refresh
      setInterval(refreshPairs, REFRESH_CURRENCIES_INTERVAL * 1000)
    } catch (err) {
      console.error('XRPL connection error:', err)
      scheduleReconnect()
    }
  }

  async function refreshPairs() {
    try {
      const newPairs = await loadTrackedPairs(pool)
      const newKeys = new Set(newPairs.map(pairsKey))
      // Find pairs to subscribe (new) and unsubscribe (removed)
      const toSubscribe = newPairs.filter(p => !subscribedKeys.has(pairsKey(p)))
      // Unsubscribe logic can be added here if needed
      if (toSubscribe.length) {
        await subscribeToPairs(client, toSubscribe)
        toSubscribe.forEach(p => subscribedKeys.add(pairsKey(p)))
      }
      // Optionally, handle unsubscription for removed pairs
      // (not implemented here for simplicity)
      currentPairs = newPairs
    } catch (err) {
      console.error('Error refreshing tracked pairs:', err)
    }
  }

  function handleDisconnect() {
    console.warn('XRPL WebSocket disconnected')
    scheduleReconnect()
  }

  function handleError(err) {
    console.error('XRPL WebSocket error:', err)
    scheduleReconnect()
  }

  function scheduleReconnect() {
    if (client && client.isConnected()) {
      client.disconnect().catch(() => {})
    }
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, maxDelay)
      console.log(`Reconnecting to XRPL in ${reconnectDelay / 1000}s...`)
      connectAndSubscribe()
    }, reconnectDelay)
  }

  // Refactored: run backfill, then start websocket
  (async () => {
    const trackedPairs = await loadTrackedPairs(pool);
    backfillInProgress = true;
    await backfillOffersForTrackedPairs(pool, trackedPairs);
    backfillInProgress = false;
    await connectAndSubscribe();
  })();
}

const app = createApp(pool)

// Add middleware to block API access during backfill
app.use((req, res, next) => {
  if (backfillInProgress) {
    return res.status(503).json({ message: "Backfill in progress, please try again soon." });
  }
  next();
});

const PORT = process.env.PORT || 3001
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Express API server listening on port ${PORT}`)
  })
}

module.exports = { handleTransaction, backfillOffersForTrackedPairs }

if (require.main === module) {
  startXRPLClient()
} 

// Helper to convert XRPL hex currency code to ISO 3-letter code
function hexToIsoCurrency(hex) {
  if (!hex || hex === 'XRP') return 'XRP';
  if (hex.length === 3) return hex; // Already ISO
  try {
    const buf = Buffer.from(hex, 'hex');
    const ascii = buf.toString('ascii').replace(/\0+$/, '');
    if (/^[A-Z0-9]{3,6}$/.test(ascii)) return ascii;
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
  // Log to console (stdout)
  console.log(`[${new Date().toISOString()}][CREATED][BACKFILL] Offer ${offer.index} by ${offer.Account}: ${taker_gets_value} ${taker_gets_currency} for ${taker_pays_value} ${taker_pays_currency}`);
  // Upsert with debug
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
    console.log(`[BACKFILL][UPSERT SUCCESS] Offer ${offer.index}`);
  } catch (err) {
    console.error(`[BACKFILL][UPSERT FAIL] Offer ${offer.index}:`, err);
  }
} 