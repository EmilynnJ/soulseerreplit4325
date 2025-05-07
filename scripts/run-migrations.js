// Run SQL migrations from the migrations directory
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to the database
const { Pool } = pg;

// Use the connection string from .env file
const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('POSTGRES_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function runMigration() {
  console.log('Running SQL migrations...');
  
  try {
    // Get the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '0001_rename_auth0_to_appwrite.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    
    // Execute the migration
    const client = await pool.connect();
    
    try {
      // Start a transaction
      await client.query('BEGIN');
      
      console.log('Executing SQL migration to rename auth0_id to appwrite_id...');
      await client.query(migrationSql);
      
      // Commit the transaction
      await client.query('COMMIT');
      console.log('Migration completed successfully!');
    } catch (error) {
      // Rollback the transaction if there was an error
      await client.query('ROLLBACK');
      console.error('Migration failed:', error);
      throw error;
    } finally {
      // Release the client back to the pool
      client.release();
    }
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the migration
runMigration(); 