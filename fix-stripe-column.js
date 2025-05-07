// Script to add stripe_customer_id column to users table
require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Check if the column exists
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'stripe_customer_id'
      );
    `);

    const columnExists = checkResult.rows[0].exists;
    if (!columnExists) {
      console.log('Adding stripe_customer_id column to users table...');
      await client.query(`ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(100);`);
      console.log('Column added successfully!');
    } else {
      console.log('stripe_customer_id column already exists.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('Connection closed.');
  }
}

main(); 