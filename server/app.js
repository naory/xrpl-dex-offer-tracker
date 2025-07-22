const express = require('express')
const cors = require('cors')

function createApp(pool, tradingPairsTracker = null) {
  const app = express()
  app.use(cors())
  app.use(express.json())

  // GET /offers - list current offers with filtering, sorting, pagination
  app.get('/offers', async (req, res) => {
    try {
      console.log('[DEBUG] /offers route called with query:', req.query);
      const { account, taker_gets_currency, taker_pays_currency, sort = 'updated_at', order = 'desc', limit = 20, offset = 0 } = req.query
      const filters = []
      const values = []
      let idx = 1
      if (account) { filters.push(`account = $${idx++}`); values.push(account) }
      if (taker_gets_currency) { filters.push(`taker_gets_currency = $${idx++}`); values.push(taker_gets_currency) }
      if (taker_pays_currency) { filters.push(`taker_pays_currency = $${idx++}`); values.push(taker_pays_currency) }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
      const sql = `SELECT * FROM offers ${where} ORDER BY ${sort} ${order === 'asc' ? 'ASC' : 'DESC'} LIMIT $${idx++} OFFSET $${idx}`
      values.push(Number(limit), Number(offset))
      console.log('[DEBUG] /offers SQL:', sql, 'values:', values);
      const result = await pool.query(sql, values)
      console.log('[DEBUG] /offers SQL result:', result.rows);
      res.json(result.rows)
    } catch (err) {
      console.error('[ERROR] /offers route error:', err && err.stack ? err.stack : err);
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /health - comprehensive health check including XRPL WebSocket status
  app.get('/health', async (req, res) => {
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: { status: 'unknown' },
        xrplWebSocket: { status: 'unknown' },
        api: { status: 'ok' },
        backfill: { status: 'unknown' }
      }
    };

    try {
      // Check database connectivity
      try {
        await pool.query('SELECT 1');
        healthStatus.checks.database = {
          status: 'ok',
          message: 'Database connection healthy'
        };
      } catch (dbError) {
        healthStatus.checks.database = {
          status: 'error',
          message: 'Database connection failed',
          error: dbError.message
        };
        healthStatus.status = 'degraded';
      }

      // Check XRPL WebSocket connection status
      // This requires the client to be accessible - we'll pass it from the main module
      if (req.app.locals.xrplClient) {
        const client = req.app.locals.xrplClient;
        if (client.isConnected && client.isConnected()) {
          healthStatus.checks.xrplWebSocket = {
            status: 'ok',
            message: 'XRPL WebSocket connected and active',
            url: client.url || 'unknown'
          };
        } else {
          healthStatus.checks.xrplWebSocket = {
            status: 'error',
            message: 'XRPL WebSocket not connected',
            url: client.url || 'unknown'
          };
          healthStatus.status = 'degraded';
        }
      } else {
        healthStatus.checks.xrplWebSocket = {
          status: 'error',
          message: 'XRPL client not initialized'
        };
        healthStatus.status = 'degraded';
      }

      // Check backfill status
      if (req.app.locals.backfillInProgress !== undefined) {
        healthStatus.checks.backfill = {
          status: req.app.locals.backfillInProgress ? 'in_progress' : 'complete',
          message: req.app.locals.backfillInProgress ? 'Initial data backfill in progress' : 'Initial data backfill complete'
        };
        
        if (req.app.locals.backfillInProgress) {
          healthStatus.status = 'initializing';
        }
      }

      // Determine overall status
      const hasErrors = Object.values(healthStatus.checks).some(check => check.status === 'error');
      if (hasErrors && healthStatus.status === 'ok') {
        healthStatus.status = 'degraded';
      }

      // Return appropriate HTTP status code
      const httpStatus = healthStatus.status === 'ok' ? 200 : 
                        healthStatus.status === 'initializing' ? 202 : 503;

      res.status(httpStatus).json(healthStatus);

    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        message: 'Health check failed',
        error: error.message,
        checks: healthStatus.checks
      });
    }
  });

  // GET /offer-history - list offer history with filtering, sorting, pagination
  app.get('/offer-history', async (req, res) => {
    try {
      const { offer_id, account, event_type, sort = 'event_time', order = 'desc', limit = 20, offset = 0 } = req.query
      const filters = []
      const values = []
      let idx = 1
      if (offer_id) { filters.push(`offer_id = $${idx++}`); values.push(offer_id) }
      if (account) { filters.push(`account = $${idx++}`); values.push(account) }
      if (event_type) { filters.push(`event_type = $${idx++}`); values.push(event_type) }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
      const sql = `SELECT * FROM offer_history ${where} ORDER BY ${sort} ${order === 'asc' ? 'ASC' : 'DESC'} LIMIT $${idx++} OFFSET $${idx}`
      values.push(Number(limit), Number(offset))
      const result = await pool.query(sql, values)
      res.json(result.rows)
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /analytics/volume - total traded volume for a pair over a period
  app.get('/analytics/volume', async (req, res) => {
    try {
      const { taker_gets_currency, taker_pays_currency, period = '24h' } = req.query
      if (!taker_gets_currency || !taker_pays_currency) {
        return res.status(400).json({ error: 'taker_gets_currency and taker_pays_currency are required' })
      }
      // Calculate start time
      const interval = period.endsWith('h') ? `interval '${parseInt(period)} hour'` : `interval '24 hour'`
      const sql = `
        SELECT
          SUM(taker_gets_value::numeric) AS total_gets,
          SUM(taker_pays_value::numeric) AS total_pays
        FROM offer_history
        WHERE taker_gets_currency = $1
          AND taker_pays_currency = $2
          AND event_time >= NOW() - ${interval}
          AND event_type = 'created'
      `
      const result = await pool.query(sql, [taker_gets_currency, taker_pays_currency])
      res.json({
        taker_gets_currency,
        taker_pays_currency,
        period,
        total_gets: result.rows[0].total_gets || '0',
        total_pays: result.rows[0].total_pays || '0',
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /analytics/price-trend - price stats for a pair over a period
  app.get('/analytics/price-trend', async (req, res) => {
    try {
      const { taker_gets_currency, taker_pays_currency, period = '24h' } = req.query
      if (!taker_gets_currency || !taker_pays_currency) {
        return res.status(400).json({ error: 'taker_gets_currency and taker_pays_currency are required' })
      }
      const interval = period.endsWith('h') ? `interval '${parseInt(period)} hour'` : `interval '24 hour'`
      // Calculate price as taker_pays_value / taker_gets_value
      const sql = `
        SELECT
          AVG(taker_pays_value::numeric / NULLIF(taker_gets_value::numeric, 0)) AS avg_price,
          MIN(taker_pays_value::numeric / NULLIF(taker_gets_value::numeric, 0)) AS min_price,
          MAX(taker_pays_value::numeric / NULLIF(taker_gets_value::numeric, 0)) AS max_price
        FROM offer_history
        WHERE taker_gets_currency = $1
          AND taker_pays_currency = $2
          AND event_time >= NOW() - ${interval}
          AND event_type = 'created'
      `
      const result = await pool.query(sql, [taker_gets_currency, taker_pays_currency])
      // Median: need a separate query
      const medianSql = `
        SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY taker_pays_value::numeric / NULLIF(taker_gets_value::numeric, 0)) AS median_price
        FROM offer_history
        WHERE taker_gets_currency = $1
          AND taker_pays_currency = $2
          AND event_time >= NOW() - ${interval}
          AND event_type = 'created'
      `
      const medianResult = await pool.query(medianSql, [taker_gets_currency, taker_pays_currency])
      res.json({
        taker_gets_currency,
        taker_pays_currency,
        period,
        avg_price: result.rows[0].avg_price || '0',
        min_price: result.rows[0].min_price || '0',
        max_price: result.rows[0].max_price || '0',
        median_price: medianResult.rows[0].median_price || '0',
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /analytics/orderbook - order book depth for a pair
  app.get('/analytics/orderbook', async (req, res) => {
    try {
      const { taker_gets_currency, taker_pays_currency, depth = 10 } = req.query
      if (!taker_gets_currency || !taker_pays_currency) {
        return res.status(400).json({ error: 'taker_gets_currency and taker_pays_currency are required' })
      }
      // Bids: offers to buy taker_gets (pay taker_pays)
      const bidsSql = `
        SELECT price, taker_gets_value AS amount, account
        FROM offers
        WHERE taker_gets_currency = $1 AND taker_pays_currency = $2
        ORDER BY price DESC
        LIMIT $3
      `
      // Asks: offers to sell taker_pays (get taker_gets)
      const asksSql = `
        SELECT price, taker_pays_value AS amount, account
        FROM offers
        WHERE taker_gets_currency = $2 AND taker_pays_currency = $1
        ORDER BY price ASC
        LIMIT $3
      `
      const bids = (await pool.query(bidsSql, [taker_gets_currency, taker_pays_currency, depth])).rows
      const asks = (await pool.query(asksSql, [taker_gets_currency, taker_pays_currency, depth])).rows
      res.json({
        taker_gets_currency,
        taker_pays_currency,
        bids,
        asks
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /analytics/offer-counts - offer creation/cancellation counts for a pair over a period
  app.get('/analytics/offer-counts', async (req, res) => {
    try {
      const { taker_gets_currency, taker_pays_currency, period = '24h' } = req.query
      if (!taker_gets_currency || !taker_pays_currency) {
        return res.status(400).json({ error: 'taker_gets_currency and taker_pays_currency are required' })
      }
      const interval = period.endsWith('h') ? `interval '${parseInt(period)} hour'` : `interval '24 hour'`
      const sql = `
        SELECT event_type, COUNT(*) AS count
        FROM offer_history
        WHERE taker_gets_currency = $1
          AND taker_pays_currency = $2
          AND event_time >= NOW() - ${interval}
          AND event_type IN ('created', 'cancelled')
        GROUP BY event_type
      `
      const result = await pool.query(sql, [taker_gets_currency, taker_pays_currency])
      let created = 0, cancelled = 0
      for (const row of result.rows) {
        if (row.event_type === 'created') created = Number(row.count)
        if (row.event_type === 'cancelled') cancelled = Number(row.count)
      }
      res.json({
        taker_gets_currency,
        taker_pays_currency,
        period,
        created,
        cancelled
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /analytics/account-orders - offer counts per account for a pair over a period
  app.get('/analytics/account-orders', async (req, res) => {
    try {
      const { taker_gets_currency, taker_pays_currency, period = '24h' } = req.query
      if (!taker_gets_currency || !taker_pays_currency) {
        return res.status(400).json({ error: 'taker_gets_currency and taker_pays_currency are required' })
      }
      const interval = period.endsWith('h') ? `interval '${parseInt(period)} hour'` : `interval '24 hour'`
      const sql = `
        SELECT account, event_type, COUNT(*) AS count
        FROM offer_history
        WHERE taker_gets_currency = $1
          AND taker_pays_currency = $2
          AND event_time >= NOW() - ${interval}
          AND event_type IN ('created', 'cancelled')
        GROUP BY account, event_type
      `
      const result = await pool.query(sql, [taker_gets_currency, taker_pays_currency])
      // Aggregate per account
      const accounts = {}
      for (const row of result.rows) {
        if (!accounts[row.account]) accounts[row.account] = { created: 0, cancelled: 0 }
        if (row.event_type === 'created') accounts[row.account].created = Number(row.count)
        if (row.event_type === 'cancelled') accounts[row.account].cancelled = Number(row.count)
      }
      res.json({
        taker_gets_currency,
        taker_pays_currency,
        period,
        accounts
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /trading-pairs - list all tracked trading pairs from the database
  app.get('/trading-pairs', async (req, res) => {
    try {
      // First try to get pairs from tracked_pairs table if it has data
      const trackedPairsResult = await pool.query(`
        SELECT DISTINCT taker_gets_currency, taker_pays_currency 
        FROM tracked_pairs 
        WHERE active = TRUE
        ORDER BY taker_gets_currency, taker_pays_currency
      `)
      
      // If tracked_pairs has data, use it
      if (trackedPairsResult.rows.length > 0) {
        const pairs = trackedPairsResult.rows.map(row => 
          `${row.taker_gets_currency}/${row.taker_pays_currency}`
        )
        return res.json({ pairs })
      }
      
      // Otherwise, get pairs from actual offers in the database
      const offersResult = await pool.query(`
        SELECT DISTINCT taker_gets_currency, taker_pays_currency 
        FROM offers 
        ORDER BY taker_gets_currency, taker_pays_currency
      `)
      
      // If we have offers data, use it
      if (offersResult.rows.length > 0) {
        const pairs = offersResult.rows.map(row => 
          `${row.taker_gets_currency}/${row.taker_pays_currency}`
        )
        return res.json({ pairs })
      }
      
      // If no data in either table, return some common XRPL pairs as fallback
      const fallbackPairs = [
        'XRP/USDC',
        'XRP/RLUSD', 
        'XRP/USD',
        'XRP/EUR',
        'XRP/BTC',
        'USDC/USD'
      ]
      
      res.json({ 
        pairs: fallbackPairs,
        note: 'Using fallback pairs - no data found in database'
      })
    } catch (err) {
      console.error('Error fetching trading pairs:', err)
      // Return fallback pairs if there's any database error
      const fallbackPairs = [
        'XRP/USDC',
        'XRP/RLUSD', 
        'XRP/USD',
        'XRP/EUR',
        'XRP/BTC',
        'USDC/USD'
      ]
      
      res.json({ 
        pairs: fallbackPairs,
        note: 'Using fallback pairs due to database error'
      })
    }
  })

  // Trading Pairs Tracker API endpoints
  if (tradingPairsTracker) {
    // GET /top-trading-pairs - get top-k trading pairs for different time windows
    app.get('/top-trading-pairs', async (req, res) => {
      try {
        const { window = '24h', k = 20 } = req.query;
        const validWindows = ['10m', '1h', '24h'];
        
        if (!validWindows.includes(window)) {
          return res.status(400).json({ 
            error: `Invalid window. Must be one of: ${validWindows.join(', ')}` 
          });
        }
        
        const pairs = tradingPairsTracker.getTopKPairs(window, parseInt(k));
        res.json({
          window,
          k: parseInt(k),
          pairs,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error('[ERROR] /top-trading-pairs error:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // GET /trading-stats - get comprehensive trading statistics
    app.get('/trading-stats', async (req, res) => {
      try {
        const { k = 20 } = req.query;
        const stats = tradingPairsTracker.getAllStats(parseInt(k));
        const memoryStats = tradingPairsTracker.getMemoryStats();
        
        res.json({
          stats,
          memory: memoryStats,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error('[ERROR] /trading-stats error:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // GET /pair-stats/:currency1/:currency2 - get stats for a specific pair
    app.get('/pair-stats/:currency1/:currency2', async (req, res) => {
      try {
        const { currency1, currency2 } = req.params;
        const { issuer1, issuer2 } = req.query;
        
        const takerGets = {
          currency: currency1.toUpperCase(),
          issuer: issuer1 || null
        };
        
        const takerPays = {
          currency: currency2.toUpperCase(),
          issuer: issuer2 || null
        };
        
        const stats = tradingPairsTracker.getPairStats(takerGets, takerPays);
        
        if (Object.keys(stats).length === 0) {
          return res.status(404).json({ 
            error: 'No trading data found for this pair' 
          });
        }
        
        res.json({
          pair: `${currency1}/${currency2}`,
          stats,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error('[ERROR] /pair-stats error:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // GET /trading-pairs/realtime - get real-time trading pairs with volume data
    app.get('/trading-pairs/realtime', async (req, res) => {
      try {
        const { window = '24h', k = 20 } = req.query;
        const validWindows = ['10m', '1h', '24h'];
        
        if (!validWindows.includes(window)) {
          return res.status(400).json({ 
            error: `Invalid window. Must be one of: ${validWindows.join(', ')}` 
          });
        }
        
        const pairs = tradingPairsTracker.getTopKPairs(window, parseInt(k));
        
        // Format the response for better readability
        const formattedPairs = pairs.map((pair, index) => ({
          rank: index + 1,
          pair: `${pair.takerGets.currency}/${pair.takerPays.currency}`,
          volume: pair.volume,
          count: pair.count,
          lastUpdate: pair.lastUpdate,
          currency1: pair.takerGets.currency,
          currency2: pair.takerPays.currency,
          issuer1: pair.takerGets.issuer,
          issuer2: pair.takerPays.issuer
        }));
        
        res.json({
          window,
          k: parseInt(k),
          pairs: formattedPairs,
          totalPairs: tradingPairsTracker.tradingData[window].size,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error('[ERROR] /trading-pairs/realtime error:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // GET /xrp-pairs/flashy - get XRP trading pairs with bid/ask breakdown for trader's view
    app.get('/xrp-pairs/flashy', async (req, res) => {
      try {
        const { window = '24h', k = 20 } = req.query;
        const validWindows = ['10m', '1h', '24h'];
        
        if (!validWindows.includes(window)) {
          return res.status(400).json({ 
            error: `Invalid window. Must be one of: ${validWindows.join(', ')}` 
          });
        }
        
        const pairs = tradingPairsTracker.getTopKXRPPairs(window, parseInt(k));
        
        // Format for flashy trader's view
        const formattedPairs = pairs.map((pair, index) => {
          // Determine the non-XRP currency
          const otherCurrency = pair.takerGets.currency === 'XRP' 
            ? pair.takerPays.currency 
            : pair.takerGets.currency;
          
          const otherIssuer = pair.takerGets.currency === 'XRP' 
            ? pair.takerPays.issuer 
            : pair.takerGets.issuer;
          
          // Calculate bid/ask percentages
          const totalVolume = pair.volume || 1;
          const bidPercentage = (pair.bidVolume / totalVolume) * 100;
          const askPercentage = (pair.askVolume / totalVolume) * 100;
          
          return {
            rank: index + 1,
            pair: `${otherCurrency}/XRP`,
            otherCurrency,
            otherIssuer,
            totalVolume: pair.volume,
            totalCount: pair.count,
            bidVolume: pair.bidVolume,
            askVolume: pair.askVolume,
            bidCount: pair.bidCount,
            askCount: pair.askCount,
            bidPercentage: parseFloat(bidPercentage.toFixed(1)),
            askPercentage: parseFloat(askPercentage.toFixed(1)),
            lastPrice: pair.lastPrice,
            priceChange: pair.priceChange,
            trend: pair.trend,
            heatLevel: pair.heatLevel,
            lastUpdate: pair.lastUpdate
          };
        });
        
        res.json({
          window,
          k: parseInt(k),
          pairs: formattedPairs,
          totalXRPPairs: pairs.length,
          timestamp: Date.now(),
          traderView: true
        });
      } catch (err) {
        console.error('[ERROR] /xrp-pairs/flashy error:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  return app
}

module.exports = createApp 