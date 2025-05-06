import { runMigration } from './migration-manager';

const migrationName = 'remove_mux_fields.sql';
const migrationSql = `
-- Remove Mux-related fields from livestreams table
ALTER TABLE livestreams
DROP COLUMN IF EXISTS stream_key,
DROP COLUMN IF EXISTS playback_id;

-- Add comment for migration tracking
COMMENT ON TABLE livestreams IS 'Removed Mux-related fields stream_key and playback_id';
`;

async function main() {
  try {
    await runMigration(migrationName, migrationSql);
    console.log('Successfully removed Mux fields from livestreams table');
    process.exit(0);
  } catch (error) {
    console.error('Failed to remove Mux fields:', error);
    process.exit(1);
  }
}

main();
