import { runMigration } from './migration-manager.js';
import { log } from '../vite.js';

const migrationSql = `
-- Add LiveKit room name column to livestreams table
ALTER TABLE livestreams
ADD COLUMN IF NOT EXISTS livekit_room_name TEXT;
`;

async function main() {
  try {
    log('Running migration to add livekit_room_name to livestreams table', 'migration');
    await runMigration('add_livekit_room_name.sql', migrationSql);
    log('Migration completed successfully', 'migration');
  } catch (error) {
    log(`Migration failed: ${error}`, 'migration');
    process.exit(1);
  }
}

main();