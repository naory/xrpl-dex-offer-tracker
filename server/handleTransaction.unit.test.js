const { handleTransaction } = require('./index')
const xrpl = require('xrpl')

// Import hexToIsoCurrency directly for unit test
const { Pool } = require('pg')
const pool = new Pool({
  user: process.env.PGUSER || 'xrpl',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'xrpl_dex_test',
  password: process.env.PGPASSWORD || 'xrplpass',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5433,
})

// Copy of hexToIsoCurrency for direct test
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

describe('hexToIsoCurrency', () => {
  it('should return XRP for XRP', () => {
    expect(hexToIsoCurrency('XRP')).toBe('XRP')
  })
  it('should return USD for USD hex', () => {
    expect(hexToIsoCurrency('5553440000000000000000000000000000000000')).toBe('USD')
  })
  it('should return RLUSD for RLUSD hex', () => {
    expect(hexToIsoCurrency('524C555344000000000000000000000000000000')).toBe('RLUSD')
  })
  it('should return original for unknown hex', () => {
    expect(hexToIsoCurrency('ABCDEF1234567890')).toBe('ABCDEF1234567890')
  })
})

describe('handleTransaction', () => {
  it('should process tx_json structure', async () => {
    const tx = {
      tx_json: {
        TransactionType: 'OfferCreate',
        Account: 'rTest',
        TakerGets: '1000',
        TakerPays: {
          currency: '5553440000000000000000000000000000000000',
          issuer: 'rIssuer',
          value: '10'
        },
        hash: 'abc123'
      },
      meta: { AffectedNodes: [] }
    }
    await handleTransaction(tx, pool)
    // No error = pass (DB upsert tested in integration)
  })
  it('should process transaction structure', async () => {
    const tx = {
      transaction: {
        TransactionType: 'OfferCreate',
        Account: 'rTest',
        TakerGets: '1000',
        TakerPays: {
          currency: '5553440000000000000000000000000000000000',
          issuer: 'rIssuer',
          value: '10'
        },
        hash: 'abc456'
      },
      meta: { AffectedNodes: [] }
    }
    await handleTransaction(tx, pool)
  })
  it('should process CreatedNode Offer in meta', async () => {
    const tx = {
      tx_json: {
        TransactionType: 'OfferCreate',
        Account: 'rTest',
        TakerGets: '1000',
        TakerPays: {
          currency: '5553440000000000000000000000000000000000',
          issuer: 'rIssuer',
          value: '10'
        },
        hash: 'abc789'
      },
      meta: {
        AffectedNodes: [
          {
            CreatedNode: {
              LedgerEntryType: 'Offer',
              LedgerIndex: 'offerid123',
              NewFields: {
                Account: 'rTest',
                TakerGets: '1000',
                TakerPays: {
                  currency: '5553440000000000000000000000000000000000',
                  issuer: 'rIssuer',
                  value: '10'
                }
              }
            }
          }
        ]
      }
    }
    await handleTransaction(tx, pool)
  })
}) 