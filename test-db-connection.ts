import dotenv from 'dotenv';
dotenv.config();

import { pool, sql } from './server/db';

async function testDatabaseConnection() {
  try {
    console.log('Testing database connection with Pool...');
    const poolClient = await pool.connect();
    const poolResult = await poolClient.query('SELECT version()');
    console.log('Pool connection successful:', poolResult.rows[0].version);
    poolClient.release();
    
    console.log('\nTesting database connection with Neon serverless...');
    const neonResult = await sql`SELECT version()`;
    console.log('Neon serverless connection successful:', neonResult[0].version);
    
    console.log('\nConnection tests completed successfully');
  } catch (error) {
    console.error('Error connecting to database:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testDatabaseConnection();