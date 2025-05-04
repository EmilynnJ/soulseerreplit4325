import { runMigrations } from './migrations/migration-manager';

async function main() {
  console.log('Starting database migrations...');
  try {
    await runMigrations();
    console.log('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
