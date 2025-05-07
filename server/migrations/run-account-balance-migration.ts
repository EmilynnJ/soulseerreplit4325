import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { runMigration } from './migration-manager.js';

// ES Module alternative for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runAccountBalanceMigration() {
  try {
    console.log('Running Account Balance Migration...');
    
    // Read migration SQL
    const migrationFile = path.join(__dirname, 'add_account_balance_column.sql');
    const migrationSql = fs.readFileSync(migrationFile, 'utf8');
    
    // Run migration
    await runMigration('add_account_balance_column.sql', migrationSql);
    
    console.log('Account Balance Migration completed successfully!');
  } catch (error) {
    console.error('Error running account balance migration:', error);
    process.exit(1);
  }
}

// Run migration
runAccountBalanceMigration(); 