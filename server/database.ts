import { neon, neonConfig } from '@neondatabase/serverless';
import { log } from './vite';
import pg from 'pg';

// Disable parsing of timestamps to JS Date objects to avoid version mismatches
pg.types.setTypeParser(1114, str => str); // timestamp without timezone
pg.types.setTypeParser(1184, str => str); // timestamp with timezone

// Enhanced configuration for neon with better retries and timeouts
neonConfig.fetchConnectionCache = true;
// Use any available neon configuration options
neonConfig.useSecureWebSocket = true; // Use secure connection

// Get database URL from environment with proper fallback
// First try POSTGRES_URL (main), then DATABASE_URL (fallback)
const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_1tA3DvNckXoW@ep-noisy-union-a5mhired-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=10';

// Connection pool for improved handling of multiple concurrent requests
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 20, // Maximum number of clients
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 10000, // How long to wait for a connection
  maxUses: 7500, // Close and replace a connection after it has been used this many times
});

// Log pool statistics periodically
setInterval(() => {
  log(`Database pool stats - Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`, 'database');
}, 60000); // Every minute

// Monitor pool errors
pool.on('error', (err) => {
  log(`Unexpected database pool error: ${err.message}`, 'database');
  console.error('Database pool error:', err);
});

// The neon SQL client (for transactions that need it)
const sql = neon(DATABASE_URL);

// Export enhanced query function with retries and better error handling
export const query = async (text: string, params?: any[]) => {
  const maxRetries = 3;
  let retries = 0;
  let lastError;

  while (retries < maxRetries) {
    const client = await pool.connect().catch(err => {
      log(`Failed to get database connection: ${err.message}`, 'database');
      throw err;
    });
    
    try {
      const start = Date.now();
      const result = await client.query(text, params);
      const duration = Date.now() - start;

      if (duration > 1000) { // Log slow queries (over 1 second)
        log(`[SLOW QUERY] ${text} - Duration: ${duration}ms`, 'database');
      } else {
        log(`Executed query: ${text} - Duration: ${duration}ms`, 'database');
      }

      return { rows: result.rows, rowCount: result.rowCount };
    } catch (error: any) {
      lastError = error;
      
      // Only retry on connection errors, not on syntax or constraint errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || 
          error.code === '08006' || error.code === '08001') {
        retries++;
        log(`Database connection error (attempt ${retries}/${maxRetries}): ${error.message}`, 'database');
        await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
        continue;
      } else {
        // Don't retry on query errors
        log(`Database query error: ${error.message} - Query: ${text}`, 'database');
        throw error;
      }
    } finally {
      client.release();
    }
  }

  // If we got here, we exhausted all retries
  console.error('Database query failed after max retries:', lastError);
  throw new Error(`Database query error after ${maxRetries} retries: ${lastError?.message}`);
};

// Test the database connection on startup
query('SELECT 1')
  .then(() => {
    log('PostgreSQL database connection established successfully', 'database');
  })
  .catch((err) => {
    log(`Error connecting to PostgreSQL database: ${err.message}`, 'database');
    console.error('Database connection error:', err);
  });

// Export pool for direct use when needed
export { pool, sql };
export default sql;