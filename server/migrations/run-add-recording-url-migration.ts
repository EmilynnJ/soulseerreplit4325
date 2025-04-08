import { pool } from '../db';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the equivalent of __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('Running add_recording_url migration...');
  
  try {
    const sqlFilePath = path.join(__dirname, 'add_recording_url.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('Executing SQL:', sql);
    
    // Execute the SQL migration using the pool directly
    const client = await pool.connect();
    try {
      await client.query(sql);
      console.log('Migration completed successfully');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration().then(() => {
  console.log('Migration process completed');
  process.exit(0);
});