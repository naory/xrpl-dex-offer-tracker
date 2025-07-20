const { Pool } = require('pg')
const nock = require('nock')
const { backfillOffersForTrackedPairs } = require('./index')

const XRPL_HTTP_URL = process.env.XRPL_NET === 'mainnet'
  ? 'https://s1.ripple.com:51234/'
  : 'https://s.altnet.rippletest.net:51234/'

describe('backfillOffersForTrackedPairs', () => {
  let pool
  beforeAll(async () => {
    pool = new Pool({
      user: 'xrpl',
      host: 'localhost',
      database: 'xrpl_dex_test',
      password: 'xrplpass',
      port: 5433,
    })
    await pool.query('DELETE FROM offers')
  })
  afterAll(async () => {
    await pool.end()
  })
  afterEach(async () => {
    await pool.query('DELETE FROM offers')
    nock.cleanAll()
  })

  it('populates the DB for a tracked pair', async () => {
    const trackedPairs = [
      {
        taker_gets: { currency: 'XRP' },
        taker_pays: { currency: 'USD', issuer: 'rUSD' }
      }
    ]
    // Mock XRPL HTTP API response
    nock(XRPL_HTTP_URL)
      .post('/', body => body.method === 'book_offers')
      .reply(200, {
        result: {
          offers: [
            {
              index: 'OFFER1',
              Account: 'rTest',
              TakerGets: '1000000', // 1 XRP
              TakerPays: { currency: '5553440000000000000000000000000000000000', issuer: 'rUSD', value: '10' },
              Flags: 0
            }
          ]
        }
      })
    await backfillOffersForTrackedPairs(pool, trackedPairs)
    const offers = await pool.query('SELECT * FROM offers WHERE offer_id = $1', ['OFFER1'])
    expect(offers.rows.length).toBe(1)
    expect(offers.rows[0].taker_gets_currency).toBe('XRP')
    expect(offers.rows[0].taker_pays_currency).toBe('USD')
    expect(offers.rows[0].taker_pays_issuer).toBe('rUSD')
    expect(Number(offers.rows[0].taker_gets_value)).toBeCloseTo(1)
    expect(Number(offers.rows[0].taker_pays_value)).toBeCloseTo(10)
  })

  it('is idempotent: running backfill twice does not duplicate or corrupt data', async () => {
    const trackedPairs = [
      {
        taker_gets: { currency: 'XRP' },
        taker_pays: { currency: 'USD', issuer: 'rUSD' }
      }
    ]
    nock(XRPL_HTTP_URL)
      .post('/', body => body.method === 'book_offers')
      .twice()
      .reply(200, {
        result: {
          offers: [
            {
              index: 'OFFER2',
              Account: 'rTest',
              TakerGets: '2000000', // 2 XRP
              TakerPays: { currency: '5553440000000000000000000000000000000000', issuer: 'rUSD', value: '20' },
              Flags: 0
            }
          ]
        }
      })
    await backfillOffersForTrackedPairs(pool, trackedPairs)
    await backfillOffersForTrackedPairs(pool, trackedPairs)
    const offers = await pool.query('SELECT * FROM offers WHERE offer_id = $1', ['OFFER2'])
    expect(offers.rows.length).toBe(1)
    expect(Number(offers.rows[0].taker_gets_value)).toBeCloseTo(2)
    expect(Number(offers.rows[0].taker_pays_value)).toBeCloseTo(20)
  })

  it('upserts: updates an existing offer with new values', async () => {
    const trackedPairs = [
      {
        taker_gets: { currency: 'XRP' },
        taker_pays: { currency: 'USD', issuer: 'rUSD' }
      }
    ]
    // First response: offer with value 3 XRP
    nock(XRPL_HTTP_URL)
      .post('/', body => body.method === 'book_offers')
      .reply(200, {
        result: {
          offers: [
            {
              index: 'OFFER3',
              Account: 'rTest',
              TakerGets: '3000000', // 3 XRP
              TakerPays: { currency: '5553440000000000000000000000000000000000', issuer: 'rUSD', value: '30' },
              Flags: 0
            }
          ]
        }
      })
    await backfillOffersForTrackedPairs(pool, trackedPairs)
    let offers = await pool.query('SELECT * FROM offers WHERE offer_id = $1', ['OFFER3'])
    expect(offers.rows.length).toBe(1)
    expect(Number(offers.rows[0].taker_gets_value)).toBeCloseTo(3)
    // Second response: same offer_id, new value 4 XRP
    nock(XRPL_HTTP_URL)
      .post('/', body => body.method === 'book_offers')
      .reply(200, {
        result: {
          offers: [
            {
              index: 'OFFER3',
              Account: 'rTest',
              TakerGets: '4000000', // 4 XRP
              TakerPays: { currency: '5553440000000000000000000000000000000000', issuer: 'rUSD', value: '40' },
              Flags: 0
            }
          ]
        }
      })
    await backfillOffersForTrackedPairs(pool, trackedPairs)
    offers = await pool.query('SELECT * FROM offers WHERE offer_id = $1', ['OFFER3'])
    expect(offers.rows.length).toBe(1)
    expect(Number(offers.rows[0].taker_gets_value)).toBeCloseTo(4)
    expect(Number(offers.rows[0].taker_pays_value)).toBeCloseTo(40)
  })

  it('handles XRPL API errors gracefully', async () => {
    const trackedPairs = [
      {
        taker_gets: { currency: 'XRP' },
        taker_pays: { currency: 'USD', issuer: 'rUSD' }
      }
    ]
    nock(XRPL_HTTP_URL)
      .post('/', body => body.method === 'book_offers')
      .reply(200, { result: { offers: null } }) // Malformed response
    // Should not throw, should log error, and not insert any offers
    await expect(backfillOffersForTrackedPairs(pool, trackedPairs)).resolves.toBeUndefined()
    const offers = await pool.query('SELECT * FROM offers')
    expect(offers.rows.length).toBe(0)
  })
}) 