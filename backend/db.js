const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'futurlab',
  password: 'ANKITx4',
  port: 5432,
});

module.exports = pool;