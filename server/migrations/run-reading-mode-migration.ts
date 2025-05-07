import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { runMigration } from './migration-manager';

// ES Module alternative for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  try {
    const migrationName = 'add_reading_mode';
    const sqlFilePath = path.join(__dirname, `${migrationName}.sql`);
    
    console.log(`Reading migration SQL from ${sqlFilePath}`);
    const migrationSQL = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log(`Running migration: ${migrationName}`);
    await runMigration(migrationName, migrationSQL);
    
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
