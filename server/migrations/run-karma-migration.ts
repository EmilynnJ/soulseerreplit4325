import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../database';
import { query } from '../database';

// Get current file directory (ESM compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('[database] Running karma points migration...');
    
    // First check if migrations table exists
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (err) {
      console.log('[database] Error creating migrations table:', err);
    }
    
    // Check if migration has already been applied
    const result = await query(
      'SELECT * FROM migrations WHERE name = $1',
      ['add_karma_points']
    );
    
    if (result.rows && result.rows.length > 0) {
      console.log('[database] Migration add_karma_points already applied');
      return;
    }
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'add_karma_points.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    await query(sql);
    
    // Record that the migration was applied
    await query(
      'INSERT INTO migrations (name) VALUES ($1)',
      ['add_karma_points']
    );
    
    console.log('[database] Migration add_karma_points applied successfully');
  } catch (error) {
    console.error('[database] Error applying migration:', error);
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log('[database] Migration process complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('[database] Migration failed:', error);
    process.exit(1);
  });
