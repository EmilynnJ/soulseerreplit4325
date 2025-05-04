// Minimal script to fix the database
import pg from 'pg';

// Hardcode the database URL (from .env)
const dbUrl = "postgresql://neondb_owner:npg_Pbpz9TuH5AhX@ep-lively-base-a4k2rid7-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";

// Create a sanitized version for logging
const sanitizedUrl = dbUrl.replace(/:[^:@]+@/, ':***@');
console.log(`Using database: ${sanitizedUrl}`);

// Create client
const client = new pg.Client({
  connectionString: dbUrl
});

async function main() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully');

    // Check if users table exists
    console.log('Checking if users table exists...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.error('Users table does not exist!');
      process.exit(1);
    }
    
    console.log('Users table exists, checking for stripe_customer_id column...');
    
    // Check if column exists
    const columnCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'stripe_customer_id'
      );
    `);
    
    if (columnCheck.rows[0].exists) {
      console.log('stripe_customer_id column already exists.');
    } else {
      console.log('Adding stripe_customer_id column...');
      await client.query('ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(100);');
      console.log('Column added successfully!');
    }
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    try {
      await client.end();
      console.log('Database connection closed');
    } catch (err) {
      console.error('Error closing connection:', err);
    }
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});