const express = require('express')
const cors = require('cors')

function createApp(pool) {
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

  return app
}

module.exports = createApp 