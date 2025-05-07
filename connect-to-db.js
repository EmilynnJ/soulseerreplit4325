// Connect to the database and add the stripe_customer_id column
require('dotenv').config();
const { Client } = require('pg');

// Log the URL being used (sanitized)
const dbUrl = process.env.POSTGRES_URL || '';
if (dbUrl) {
  const sanitizedUrl = dbUrl.replace(/:[^:@]+@/, ':***@');
  console.log(`Database URL: ${sanitizedUrl}`);
} else {
  console.error('No database URL found in environment variables!');
  process.exit(1);
}

async function executeQuery(query) {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL
  });

  try {
    await client.connect();
    console.log('Connected to database');
    console.log(`Executing: ${query}`);
    const result = await client.query(query);
    console.log('Query executed successfully');
    console.log(result);
    return result;
  } catch (err) {
    console.error('Error executing query:', err);
    throw err;
  } finally {
    await client.end();
    console.log('Connection closed');
  }
}

async function main() {
  try {
    // Check if the column exists
    const checkResult = await executeQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'stripe_customer_id'
      );
    `);
    
    const columnExists = checkResult.rows[0].exists;
    
    if (columnExists) {
      console.log('Column "stripe_customer_id" already exists');
    } else {
      console.log('Column "stripe_customer_id" does not exist, adding it...');
      await executeQuery(`
        ALTER TABLE users 
        ADD COLUMN stripe_customer_id VARCHAR(100);
      `);
      console.log('Column added successfully');
    }
    
    console.log('Database operation completed successfully');
  } catch (error) {
    console.error('Failed to complete database operation:', error);
    process.exit(1);
  }
}

main(); 