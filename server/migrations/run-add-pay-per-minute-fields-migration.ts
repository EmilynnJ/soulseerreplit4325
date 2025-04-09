import { pool } from '../db';

const MIGRATION_NAME = 'add_pay_per_minute_fields';

async function runMigration() {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Check if migration has already been applied
    const migrationCheck = await client.query(
      'SELECT name FROM migrations WHERE name = $1',
      [MIGRATION_NAME]
    );
    
    if (migrationCheck.rowCount > 0) {
      console.log(`Migration "${MIGRATION_NAME}" has already been applied`);
      await client.query('ROLLBACK');
      return false;
    }
    
    console.log(`Running migration: ${MIGRATION_NAME}`);
    
    // Add balance field (user account balance in dollars)
    await client.query(`
      ALTER TABLE IF EXISTS users
      ADD COLUMN IF NOT EXISTS balance REAL NOT NULL DEFAULT 0;
    `);
    
    // Add earnings field (reader's earned money in dollars)
    await client.query(`
      ALTER TABLE IF EXISTS users
      ADD COLUMN IF NOT EXISTS earnings REAL NOT NULL DEFAULT 0;
    `);
    
    // Add ratePerMinute field (reader's rate per minute in dollars)
    await client.query(`
      ALTER TABLE IF EXISTS users
      ADD COLUMN IF NOT EXISTS rate_per_minute REAL NOT NULL DEFAULT 5.0;
    `);
    
    // Create session_logs table for tracking reading sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS session_logs (
        id SERIAL PRIMARY KEY,
        room_id TEXT NOT NULL,
        reader_id INTEGER NOT NULL REFERENCES users(id),
        client_id INTEGER NOT NULL REFERENCES users(id),
        session_type TEXT NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INTEGER, -- in minutes
        total_amount REAL, -- in dollars
        reader_earned REAL, -- in dollars (70% of total)
        platform_earned REAL, -- in dollars (30% of total)
        status TEXT NOT NULL,
        end_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create gift_logs table for tracking gifts during livestreams
    await client.query(`
      CREATE TABLE IF NOT EXISTS gift_logs (
        id SERIAL PRIMARY KEY,
        livestream_id INTEGER REFERENCES livestreams(id),
        sender_id INTEGER NOT NULL REFERENCES users(id),
        receiver_id INTEGER NOT NULL REFERENCES users(id),
        gift_type TEXT NOT NULL,
        gift_value REAL NOT NULL, -- in dollars
        receiver_earned REAL NOT NULL, -- in dollars (70% of gift value)
        platform_earned REAL NOT NULL, -- in dollars (30% of gift value)
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Record migration
    await client.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      [MIGRATION_NAME]
    );
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log(`Migration "${MIGRATION_NAME}" applied successfully`);
    return true;
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error(`Migration "${MIGRATION_NAME}" failed:`, error);
    throw error;
  } finally {
    client.release();
  }
}

// Execute the migration
runMigration()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });

export default runMigration;