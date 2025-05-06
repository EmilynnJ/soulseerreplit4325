const { Pool } = require('pg');
require('dotenv').config({ path: '../../../.env' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false // Required for NeonDB, Heroku, etc.
  }
});

console.log('Database URL:', process.env.POSTGRES_URL ? 'Loaded' : 'Not Loaded');

module.exports = pool;