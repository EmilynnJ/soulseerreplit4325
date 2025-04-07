import { pool } from '../db';

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Starting migration to add room_id column to livestreams table');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Add the room_id column if it doesn't exist
    await client.query(`
      ALTER TABLE livestreams
      ADD COLUMN IF NOT EXISTS room_id TEXT;
    `);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Migration completed successfully');
  } catch (error) {
    // Rollback in case of error
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    // Release the client back to the pool
    client.release();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('Room ID column added to livestreams table');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed to run migration:', error);
    process.exit(1);
  });