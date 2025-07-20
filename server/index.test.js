const { handleTransaction } = require('./index')
const { Pool } = require('pg')

jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
  }
  return { Pool: jest.fn(() => mPool) }
})

describe('handleTransaction', () => {
  let pool
  beforeEach(() => {
    pool = new Pool()
    pool.query.mockClear()
  })

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
    await handleTransaction(tx)
    expect(pool.query).toHaveBeenCalledTimes(2)
    expect(pool.query.mock.calls[0][0]).toMatch(/INSERT INTO offer_history/)
    expect(pool.query.mock.calls[1][0]).toMatch(/INSERT INTO offers/)
  })

  it('should insert and delete for OfferCancel', async () => {
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
    await handleTransaction(tx)
    expect(pool.query).toHaveBeenCalledTimes(2)
    expect(pool.query.mock.calls[0][0]).toMatch(/INSERT INTO offer_history/)
    expect(pool.query.mock.calls[1][0]).toMatch(/DELETE FROM offers/)
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
    await handleTransaction(tx)
    expect(pool.query).toHaveBeenCalledTimes(2)
    expect(pool.query.mock.calls[0][0]).toMatch(/INSERT INTO offer_history/)
    expect(pool.query.mock.calls[1][0]).toMatch(/INSERT INTO offers/)
  })

  it('should do nothing for non-offer transactions', async () => {
    const tx = {
      transaction: {
        TransactionType: 'Payment',
        hash: 'NOTOFFER',
      },
      meta: {},
    }
    await handleTransaction(tx)
    expect(pool.query).not.toHaveBeenCalled()
  })
}) 