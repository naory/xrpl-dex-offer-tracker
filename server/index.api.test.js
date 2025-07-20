const request = require('supertest');
const app = require('./app');
const pool = require('./db');
const { Pool } = require('pg')
const createApp = require('./app')
const { handleTransaction } = require('./index')

// Setup test pool for integration
const testPool = new Pool({
  user: 'xrpl',
  host: 'localhost',
  database: 'xrpl_dex_test',
  password: 'xrplpass',
  port: 5433,
})

beforeAll(async () => {
  await pool.query('TRUNCATE offers, offer_history;');
});

afterAll(async () => {
  await pool.end();
});

describe('API /offers and /offer-history', () => {
  let app
  beforeAll(() => {
    app = createApp(testPool)
  })
  beforeEach(async () => {
    await testPool.query('DELETE FROM offer_history')
    await testPool.query('DELETE FROM offers')
    // Insert sample data
    await testPool.query(`INSERT INTO offers (offer_id, account, taker_gets_currency, taker_gets_value, taker_pays_currency, taker_pays_value, updated_at) VALUES ('OFFER1', 'rA', 'XRP', 1, 'USD', 2, NOW()), ('OFFER2', 'rB', 'USD', 2, 'XRP', 1, NOW())`)
    await testPool.query(`INSERT INTO offer_history (offer_id, account, taker_gets_currency, taker_gets_value, taker_pays_currency, taker_pays_value, event_type, event_time) VALUES ('OFFER1', 'rA', 'XRP', 1, 'USD', 2, 'created', NOW()), ('OFFER2', 'rB', 'USD', 2, 'XRP', 1, 'cancelled', NOW())`)
  })
  afterAll(async () => {
    await testPool.end()
  })

  it('GET /offers returns all offers', async () => {
    const res = await request(app).get('/offers')
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(2)
  })

  it('GET /offers filters by account', async () => {
    const res = await request(app).get('/offers').query({ account: 'rA' })
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0].account).toBe('rA')
  })

  it('GET /offer-history returns all history', async () => {
    const res = await request(app).get('/offer-history')
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(2)
  })

  it('GET /offer-history filters by event_type', async () => {
    const res = await request(app).get('/offer-history').query({ event_type: 'created' })
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0].event_type).toBe('created')
  })
})

describe('API /analytics/volume', () => {
  let app
  let pool
  beforeAll(() => {
    // nothing
  })
  beforeEach(async () => {
    pool = new Pool({
      user: 'xrpl',
      host: 'localhost',
      database: 'xrpl_dex_test',
      password: 'xrplpass',
      port: 5433,
    })
    app = createApp(pool)
    // Insert sample offer_history data
    await pool.query('DELETE FROM offer_history')
    await pool.query('DELETE FROM offers')
    await pool.query(`
      INSERT INTO offer_history (offer_id, account, taker_gets_currency, taker_gets_value, taker_pays_currency, taker_pays_value, event_type, event_time)
      VALUES
        ('OFFER1', 'rA', 'XRP', 100, 'USD', 50, 'created', NOW() - interval '1 hour'),
        ('OFFER2', 'rB', 'XRP', 200, 'USD', 100, 'created', NOW() - interval '2 hour'),
        ('OFFER3', 'rC', 'XRP', 300, 'USD', 150, 'cancelled', NOW() - interval '1 hour'),
        ('OFFER4', 'rD', 'USD', 400, 'XRP', 200, 'created', NOW() - interval '1 hour')
    `)
  })
  afterEach(async () => {
    await pool.query('DELETE FROM offer_history')
    await pool.query('DELETE FROM offers')
    await pool.end()
  })

  it('GET /analytics/volume requires params', async () => {
    const res = await request(app).get('/analytics/volume')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/)
  })

  it('GET /analytics/volume returns correct volume for pair', async () => {
    const res = await request(app).get('/analytics/volume').query({ taker_gets_currency: 'XRP', taker_pays_currency: 'USD' })
    expect(res.status).toBe(200)
    expect(Number(res.body.total_gets)).toBe(300) // Only 'created' events, XRP/USD
    expect(Number(res.body.total_pays)).toBe(150)
  })

  it('GET /analytics/volume returns 0 for no data', async () => {
    const res = await request(app).get('/analytics/volume').query({ taker_gets_currency: 'EUR', taker_pays_currency: 'USD' })
    expect(res.status).toBe(200)
    expect(res.body.total_gets).toBe('0')
    expect(res.body.total_pays).toBe('0')
  })
})

describe('API /analytics/price-trend', () => {
  let app
  let pool
  beforeEach(async () => {
    pool = new Pool({
      user: 'xrpl',
      host: 'localhost',
      database: 'xrpl_dex_test',
      password: 'xrplpass',
      port: 5433,
    })
    app = createApp(pool)
    await pool.query('DELETE FROM offer_history')
    await pool.query('DELETE FROM offers')
    await pool.query(`
      INSERT INTO offer_history (offer_id, account, taker_gets_currency, taker_gets_value, taker_pays_currency, taker_pays_value, event_type, event_time)
      VALUES
        ('OFFER1', 'rA', 'XRP', 100, 'USD', 50, 'created', NOW() - interval '1 hour'),
        ('OFFER2', 'rB', 'XRP', 200, 'USD', 100, 'created', NOW() - interval '2 hour'),
        ('OFFER3', 'rC', 'XRP', 400, 'USD', 200, 'created', NOW() - interval '3 hour'),
        ('OFFER4', 'rD', 'USD', 400, 'XRP', 200, 'created', NOW() - interval '1 hour')
    `)
  })
  afterEach(async () => {
    await pool.query('DELETE FROM offer_history')
    await pool.query('DELETE FROM offers')
    await pool.end()
  })

  it('GET /analytics/price-trend requires params', async () => {
    const res = await request(app).get('/analytics/price-trend')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/)
  })

  it('GET /analytics/price-trend returns correct price stats for pair', async () => {
    const res = await request(app).get('/analytics/price-trend').query({ taker_gets_currency: 'XRP', taker_pays_currency: 'USD' })
    expect(res.status).toBe(200)
    // Prices: 50/100=0.5, 100/200=0.5, 200/400=0.5
    expect(Number(res.body.avg_price)).toBeCloseTo(0.5)
    expect(Number(res.body.min_price)).toBeCloseTo(0.5)
    expect(Number(res.body.max_price)).toBeCloseTo(0.5)
    expect(Number(res.body.median_price)).toBeCloseTo(0.5)
  })

  it('GET /analytics/price-trend returns 0 for no data', async () => {
    const res = await request(app).get('/analytics/price-trend').query({ taker_gets_currency: 'EUR', taker_pays_currency: 'USD' })
    expect(res.status).toBe(200)
    expect(Number(res.body.avg_price)).toBe(0)
    expect(Number(res.body.min_price)).toBe(0)
    expect(Number(res.body.max_price)).toBe(0)
    expect(Number(res.body.median_price)).toBe(0)
  })
})

describe('API /analytics/orderbook', () => {
  let app
  let pool
  beforeEach(async () => {
    pool = new Pool({
      user: 'xrpl',
      host: 'localhost',
      database: 'xrpl_dex_test',
      password: 'xrplpass',
      port: 5433,
    })
    app = createApp(pool)
    await pool.query('DELETE FROM offers')
    await pool.query('DELETE FROM offer_history')
    // Insert sample offers
    await pool.query(`
      INSERT INTO offers (offer_id, account, taker_gets_currency, taker_gets_value, taker_pays_currency, taker_pays_value, updated_at)
      VALUES
        ('BID1', 'rA', 'XRP', 100, 'USD', 50, NOW()),
        ('BID2', 'rB', 'XRP', 200, 'USD', 120, NOW()),
        ('ASK1', 'rC', 'USD', 50, 'XRP', 100, NOW()),
        ('ASK2', 'rD', 'USD', 120, 'XRP', 200, NOW())
    `)
  })
  afterEach(async () => {
    await pool.query('DELETE FROM offers')
    await pool.query('DELETE FROM offer_history')
    await pool.end()
  })

  it('GET /analytics/orderbook requires params', async () => {
    const res = await request(app).get('/analytics/orderbook')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/)
  })

  it('GET /analytics/orderbook returns correct bids and asks', async () => {
    const res = await request(app).get('/analytics/orderbook').query({ taker_gets_currency: 'XRP', taker_pays_currency: 'USD', depth: 2 })
    expect(res.status).toBe(200)
    // Bids: XRP/USD, price DESC
    expect(res.body.bids.length).toBe(2)
    expect(Number(res.body.bids[0].price)).toBeCloseTo(0.6)
    expect(Number(res.body.bids[1].price)).toBeCloseTo(0.5)
    // Asks: USD/XRP, price ASC
    expect(res.body.asks.length).toBe(2)
    expect(Number(res.body.asks[0].price)).toBeCloseTo(1.6667)
    expect(Number(res.body.asks[1].price)).toBeCloseTo(2)
  })

  it('GET /analytics/orderbook returns empty for no data', async () => {
    const res = await request(app).get('/analytics/orderbook').query({ taker_gets_currency: 'EUR', taker_pays_currency: 'USD' })
    expect(res.status).toBe(200)
    expect(res.body.bids.length).toBe(0)
    expect(res.body.asks.length).toBe(0)
  })
})

describe('API /analytics/offer-counts', () => {
  let app
  let pool
  beforeEach(async () => {
    pool = new Pool({
      user: 'xrpl',
      host: 'localhost',
      database: 'xrpl_dex_test',
      password: 'xrplpass',
      port: 5433,
    })
    app = createApp(pool)
    await pool.query('DELETE FROM offer_history')
    await pool.query('DELETE FROM offers')
    await pool.query(`
      INSERT INTO offer_history (offer_id, account, taker_gets_currency, taker_gets_value, taker_pays_currency, taker_pays_value, event_type, event_time)
      VALUES
        ('OFFER1', 'rA', 'XRP', 100, 'USD', 50, 'created', NOW() - interval '1 hour'),
        ('OFFER2', 'rB', 'XRP', 200, 'USD', 100, 'created', NOW() - interval '2 hour'),
        ('OFFER3', 'rC', 'XRP', 400, 'USD', 200, 'cancelled', NOW() - interval '3 hour'),
        ('OFFER4', 'rD', 'USD', 400, 'XRP', 200, 'created', NOW() - interval '1 hour'),
        ('OFFER5', 'rE', 'XRP', 500, 'USD', 250, 'cancelled', NOW() - interval '4 hour')
    `)
  })
  afterEach(async () => {
    await pool.query('DELETE FROM offer_history')
    await pool.query('DELETE FROM offers')
    await pool.end()
  })

  it('GET /analytics/offer-counts requires params', async () => {
    const res = await request(app).get('/analytics/offer-counts')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/)
  })

  it('GET /analytics/offer-counts returns correct counts for pair', async () => {
    const res = await request(app).get('/analytics/offer-counts').query({ taker_gets_currency: 'XRP', taker_pays_currency: 'USD' })
    expect(res.status).toBe(200)
    // Only 'created' and 'cancelled' for XRP/USD in last 24h
    expect(res.body.created).toBe(2)
    expect(res.body.cancelled).toBe(2)
  })

  it('GET /analytics/offer-counts returns 0 for no data', async () => {
    const res = await request(app).get('/analytics/offer-counts').query({ taker_gets_currency: 'EUR', taker_pays_currency: 'USD' })
    expect(res.status).toBe(200)
    expect(res.body.created).toBe(0)
    expect(res.body.cancelled).toBe(0)
  })
})

describe('API /analytics/account-orders', () => {
  let app
  let pool
  beforeEach(async () => {
    pool = new Pool({
      user: 'xrpl',
      host: 'localhost',
      database: 'xrpl_dex_test',
      password: 'xrplpass',
      port: 5433,
    })
    app = createApp(pool)
    await pool.query('DELETE FROM offer_history')
    await pool.query('DELETE FROM offers')
    await pool.query(`
      INSERT INTO offer_history (offer_id, account, taker_gets_currency, taker_gets_value, taker_pays_currency, taker_pays_value, event_type, event_time)
      VALUES
        ('OFFER1', 'rA', 'XRP', 100, 'USD', 50, 'created', NOW() - interval '1 hour'),
        ('OFFER2', 'rA', 'XRP', 200, 'USD', 100, 'cancelled', NOW() - interval '2 hour'),
        ('OFFER3', 'rB', 'XRP', 400, 'USD', 200, 'created', NOW() - interval '3 hour'),
        ('OFFER4', 'rC', 'XRP', 500, 'USD', 250, 'created', NOW() - interval '4 hour'),
        ('OFFER5', 'rC', 'XRP', 600, 'USD', 300, 'cancelled', NOW() - interval '5 hour')
    `)
  })
  afterEach(async () => {
    await pool.query('DELETE FROM offer_history')
    await pool.query('DELETE FROM offers')
    await pool.end()
  })

  it('GET /analytics/account-orders requires params', async () => {
    const res = await request(app).get('/analytics/account-orders')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/)
  })

  it('GET /analytics/account-orders returns correct per-account counts', async () => {
    const res = await request(app).get('/analytics/account-orders').query({ taker_gets_currency: 'XRP', taker_pays_currency: 'USD' })
    expect(res.status).toBe(200)
    expect(res.body.accounts.rA.created).toBe(1)
    expect(res.body.accounts.rA.cancelled).toBe(1)
    expect(res.body.accounts.rB.created).toBe(1)
    expect(res.body.accounts.rB.cancelled).toBe(0)
    expect(res.body.accounts.rC.created).toBe(1)
    expect(res.body.accounts.rC.cancelled).toBe(1)
  })

  it('GET /analytics/account-orders returns empty for no data', async () => {
    const res = await request(app).get('/analytics/account-orders').query({ taker_gets_currency: 'EUR', taker_pays_currency: 'USD' })
    expect(res.status).toBe(200)
    expect(res.body.accounts).toEqual({})
  })
})

describe('Analytics API edge cases', () => {
  let app
  let pool
  beforeEach(async () => {
    pool = new Pool({
      user: 'xrpl',
      host: 'localhost',
      database: 'xrpl_dex_test',
      password: 'xrplpass',
      port: 5433,
    })
    app = createApp(pool)
    await pool.query('DELETE FROM offers')
    await pool.query('DELETE FROM offer_history')
  })
  afterEach(async () => {
    await pool.query('DELETE FROM offers')
    await pool.query('DELETE FROM offer_history')
    await pool.end()
  })
  it('should return empty orderbook for unknown pair', async () => {
    const res = await request(app).get('/analytics/orderbook?taker_gets_currency=FOO&taker_pays_currency=BAR')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('bids')
    expect(res.body).toHaveProperty('asks')
    expect(res.body.bids.length).toBe(0)
    expect(res.body.asks.length).toBe(0)
  }, 20000)
  it('should return error for missing params', async () => {
    const res = await request(app).get('/analytics/orderbook')
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  }, 20000)
  it('should handle extreme price buckets', async () => {
    // Insert an extreme price offer (let DB compute price)
    await pool.query(`INSERT INTO offers (offer_id, account, taker_gets_currency, taker_gets_issuer, taker_gets_value, taker_pays_currency, taker_pays_issuer, taker_pays_value, updated_at) VALUES ('extreme1', 'rTest', 'USD', 'rUSD', 1, 'XRP', NULL, 1000000, NOW())`)
    const res = await request(app).get('/analytics/orderbook?taker_gets_currency=XRP&taker_pays_currency=USD')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('asks')
    expect(res.body.asks.some(a => a.price >= 1000000)).toBe(true)
  }, 20000)
}) 