import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

async function runMigration() {
  console.log('Running add verified column migration...');
  
  // Create a PostgreSQL connection pool
  const pool = new Pool({
    connectionString: config.DATABASE_URL
  });

  try {
    // Read the SQL migration file
    const migrationSql = fs.readFileSync(
      path.join(__dirname, 'add_verified_column.sql'),
      'utf8'
    );

    // Execute the migration
    await pool.query(migrationSql);
    
    console.log('Successfully added verified column to users table.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close the connection pool
    await pool.end();
  }
}

// Execute the migration if this script is run directly
if (require.main === module) {
  runMigration().catch(err => {
    console.error('Error running migration:', err);
    process.exit(1);
  });
}

export default runMigration; 