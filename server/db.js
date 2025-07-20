const { Pool } = require('pg')

const pool = new Pool({
  user: process.env.PGUSER || 'xrpl',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'xrpl_dex_test',
  password: process.env.PGPASSWORD || 'xrplpass',
  port: process.env.PGPORT || 5433,
})

module.exports = pool 