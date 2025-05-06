import { neon, neonConfig } from '@neondatabase/serverless';
import { log } from './vite';
import pg from 'pg';

// Disable parsing of timestamps to JS Date objects to avoid version mismatches
pg.types.setTypeParser(1114, str => str); // timestamp without timezone
pg.types.setTypeParser(1184, str => str); // timestamp with timezone

// Configure neon with retries and timeout
neonConfig.fetchConnectionCache = true;
neonConfig.wsReconnectMaxAttempts = 5;
neonConfig.wsReconnectTimeout = 5000;

// Use the connection URL from environment variables or fall back to default for Replit
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_1tA3DvNckXoW@ep-noisy-union-a5mhired-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=10';

const sql = neon(DATABASE_URL);

// Export query function for compatibility
export const query = async (text: string, params?: any[]) => {
  try {
    const start = Date.now();
    const result = await sql(text, params);
    const duration = Date.now() - start;

    log(`Executed query: ${text} - Duration: ${duration}ms`, 'database');

    return { rows: result, rowCount: result.length };
  } catch (error: any) {
    console.error('Database query error:', error);
    throw new Error(`Database query error: ${error.message}`);
  }
};

// Test the database connection
sql('SELECT 1')
  .then(() => {
    log('PostgreSQL database connection established successfully', 'database');
  })
  .catch((err) => {
    log(`Error connecting to PostgreSQL database: ${err.message}`, 'database');
    console.error('Database connection error:', err);
  });

export default sql;