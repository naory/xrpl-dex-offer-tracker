const { handleTransaction } = require('./index')
const request = require('supertest')
const pool = require('./db')
const createApp = require('./app');
const app = createApp(pool);

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

beforeAll(async () => {
  console.log('beforeAll: Checking DB readiness and truncating tables...');
  // Wait for DB readiness
  let connected = false;
  for (let i = 0; i < 10; i++) {
    try {
      await pool.query('SELECT 1');
      connected = true;
      break;
    } catch (e) {
      console.log('Waiting for DB...');
      await new Promise(res => setTimeout(res, 1000));
    }
  }
  if (!connected) throw new Error('DB not ready');
  await pool.query('TRUNCATE offers, offer_history;');
  console.log('beforeAll: DB ready and tables truncated.');
});

afterAll(async () => {
  console.log('afterAll: Closing DB pool...');
  await pool.end();
  console.log('afterAll: DB pool closed.');
});

beforeEach(async () => {
  await pool.query('DELETE FROM offer_history')
  await pool.query('DELETE FROM offers')
})

describe('handleTransaction integration', () => {
  it('should insert and upsert for OfferCreate', async () => {
    const tx = {
      transaction: {
        TransactionType: 'OfferCreate',
        Account: 'rEXAMPLE',
        TakerGets: '1000000', // XRP in drops
        TakerPays: { currency: 'USD', issuer: 'rUSD', value: '10' },
        Flags: 0,
        Expiration: null,
        hash: 'OFFERHASH1',
      },
      meta: {},
    }
    try {
      await handleTransaction(tx, pool)
    } catch (e) {
      console.error(e)
      throw e
    }
    const offers = await pool.query('SELECT * FROM offers WHERE offer_id = $1', ['OFFERHASH1'])
    const history = await pool.query('SELECT * FROM offer_history WHERE offer_id = $1', ['OFFERHASH1'])
    expect(offers.rows.length).toBe(1)
    expect(history.rows.length).toBe(1)
    expect(history.rows[0].event_type).toBe('created')
  })

  it('should insert and delete for OfferCancel', async () => {
    // First, insert an offer
    await pool.query(`INSERT INTO offers (offer_id, account, taker_gets_currency, taker_gets_value, taker_pays_currency, taker_pays_value) VALUES ('OFFERHASH2', 'rEXAMPLE', 'XRP', 1, 'USD', 1)`)
    const tx = {
      transaction: {
        TransactionType: 'OfferCancel',
        Account: 'rEXAMPLE',
        TakerGets: '1000000',
        TakerPays: { currency: 'USD', issuer: 'rUSD', value: '10' },
        Flags: 0,
        Expiration: null,
        hash: 'OFFERHASH2',
      },
      meta: {},
    }
    try {
      await handleTransaction(tx, pool)
    } catch (e) {
      console.error(e)
      throw e
    }
    const offers = await pool.query('SELECT * FROM offers WHERE offer_id = $1', ['OFFERHASH2'])
    const history = await pool.query('SELECT * FROM offer_history WHERE offer_id = $1', ['OFFERHASH2'])
    expect(offers.rows.length).toBe(0)
    expect(history.rows.length).toBe(1)
    expect(history.rows[0].event_type).toBe('cancelled')
  })

  it('should insert and upsert for OfferModify', async () => {
    const tx = {
      transaction: {
        TransactionType: 'OfferModify',
        Account: 'rEXAMPLE',
        TakerGets: { currency: 'USD', issuer: 'rUSD', value: '10' },
        TakerPays: '1000000',
        Flags: 0,
        Expiration: null,
        hash: 'OFFERHASH3',
      },
      meta: {},
    }
    try {
      await handleTransaction(tx, pool)
    } catch (e) {
      console.error(e)
      throw e
    }
    const offers = await pool.query('SELECT * FROM offers WHERE offer_id = $1', ['OFFERHASH3'])
    const history = await pool.query('SELECT * FROM offer_history WHERE offer_id = $1', ['OFFERHASH3'])
    expect(offers.rows.length).toBe(1)
    expect(history.rows.length).toBe(1)
    expect(history.rows[0].event_type).toBe('modified')
  })

  it('should do nothing for non-offer transactions', async () => {
    const tx = {
      transaction: {
        TransactionType: 'Payment',
        hash: 'NOTOFFER',
      },
      meta: {},
    }
    try {
      await handleTransaction(tx, pool)
    } catch (e) {
      console.error(e)
      throw e
    }
    const offers = await pool.query('SELECT * FROM offers WHERE offer_id = $1', ['NOTOFFER'])
    const history = await pool.query('SELECT * FROM offer_history WHERE offer_id = $1', ['NOTOFFER'])
    expect(offers.rows.length).toBe(0)
    expect(history.rows.length).toBe(0)
  })
})

describe('Offer lifecycle end-to-end', () => {
  it('should create, modify, and cancel an offer and reflect in DB/API', async () => {
    console.log('TEST: Starting Offer lifecycle end-to-end test');
    // Simulate OfferCreate
    console.log('TEST: Simulating OfferCreate...');
    const offerCreateTx = {
      transaction: {
        TransactionType: 'OfferCreate',
        Account: 'rE2E',
        TakerGets: '1000',
        TakerPays: {
          currency: 'USD',
          issuer: 'rUSD',
          value: '10'
        },
        hash: 'E2EOFFER1'
      },
      meta: { AffectedNodes: [] }
    }
    await handleTransaction(offerCreateTx, pool)
    console.log('TEST: OfferCreate handled. Querying offers...');
    let res = await request(app).get('/offers?account=rE2E')
    console.log('TEST: OfferCreate GET /offers result:', res.body);
    expect(res.body.some(o => o.offer_id === 'E2EOFFER1')).toBe(true)

    // Simulate OfferModify
    console.log('TEST: Simulating OfferModify...');
    const offerModifyTx = {
      transaction: {
        TransactionType: 'OfferModify',
        Account: 'rE2E',
        TakerGets: '2000',
        TakerPays: {
          currency: 'USD',
          issuer: 'rUSD',
          value: '20'
        },
        hash: 'E2EOFFER1'
      },
      meta: { AffectedNodes: [] }
    }
    await handleTransaction(offerModifyTx, pool)
    console.log('TEST: OfferModify handled. Querying offers...');
    res = await request(app).get('/offers?account=rE2E')
    console.log('TEST: OfferModify GET /offers result:', res.body);
    expect(res.body.find(o => o.offer_id === 'E2EOFFER1').taker_gets_value).toBe('0.002000000000000000')

    // Simulate OfferCancel
    console.log('TEST: Simulating OfferCancel...');
    const offerCancelTx = {
      transaction: {
        TransactionType: 'OfferCancel',
        Account: 'rE2E',
        TakerGets: '2000',
        TakerPays: {
          currency: 'USD',
          issuer: 'rUSD',
          value: '20'
        },
        hash: 'E2EOFFER1'
      },
      meta: { AffectedNodes: [] }
    }
    await handleTransaction(offerCancelTx, pool)
    console.log('TEST: OfferCancel handled. Querying offers...');
    res = await request(app).get('/offers?account=rE2E')
    console.log('TEST: OfferCancel GET /offers result:', res.body);
    expect(res.body.find(o => o.offer_id === 'E2EOFFER1')).toBeUndefined()
    console.log('TEST: Offer lifecycle end-to-end test complete.');
  }, 60000)
}) 