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

// Function to ensure the verified column exists and is properly configured
async function fixVerifiedColumn() {
  try {
    log('Checking and fixing "verified" column in users table...', 'database');
    
    // First, check if the users table exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      log('Users table does not exist yet, skipping verified column fix', 'database');
      return;
    }
    
    // Check if the verified column exists
    const columnCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'verified'
      );
    `);
    
    if (!columnCheck.rows[0].exists) {
      // Column doesn't exist, add it
      log('Adding "verified" column to users table', 'database');
      await query(`ALTER TABLE users ADD COLUMN verified BOOLEAN DEFAULT FALSE;`);
    } else {
      // Column exists, check if there's a constraint issue
      try {
        // Try to drop any constraint on the verified column
        await query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_verified_check;`);
        
        // Update column type and default value
        await query(`
          ALTER TABLE users 
            ALTER COLUMN verified TYPE BOOLEAN USING 
              CASE 
                WHEN verified::text = 'true' THEN TRUE
                WHEN verified::text = 'false' THEN FALSE
                ELSE FALSE
              END,
            ALTER COLUMN verified SET DEFAULT FALSE;
        `);
        
        // Update any NULL values to FALSE
        await query(`UPDATE users SET verified = FALSE WHERE verified IS NULL;`);
        
        log('Successfully fixed "verified" column in users table', 'database');
      } catch (err: any) {
        log(`Error fixing verified column: ${err.message}`, 'database');
        console.error('Could not fix verified column:', err);
        
        // Last resort: recreate the column
        try {
          log('Attempting to recreate verified column...', 'database');
          await query(`
            ALTER TABLE users DROP COLUMN IF EXISTS verified;
            ALTER TABLE users ADD COLUMN verified BOOLEAN DEFAULT FALSE;
          `);
          log('Successfully recreated verified column', 'database');
        } catch (dropErr: any) {
          log(`Failed to recreate verified column: ${dropErr.message}`, 'database');
          console.error('Failed to recreate verified column:', dropErr);
        }
      }
    }
  } catch (error: any) {
    log(`Error checking/fixing verified column: ${error.message}`, 'database');
    console.error('Error in fixVerifiedColumn:', error);
  }
}

// Test the database connection on startup and run fixes
query('SELECT 1')
  .then(async () => {
    log('PostgreSQL database connection established successfully', 'database');
    
    // Run schema fixes
    await fixVerifiedColumn().catch(err => {
      log(`Error running verified column fix: ${err.message}`, 'database');
      console.error('Error running verified column fix:', err);
    });
  })
  .catch((err) => {
    log(`Error connecting to PostgreSQL database: ${err.message}`, 'database');
    console.error('Database connection error:', err);
  });

// Export pool for direct use when needed
export { pool, sql };
export default sql;