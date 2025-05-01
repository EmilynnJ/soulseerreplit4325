import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get directory information
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection string
const DATABASE_URL = 'postgresql://neondb_owner:npg_Pbpz9TuH5AhX@ep-lively-base-a4k2rid7-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Create PostgreSQL client
const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addMissingVoiceColumns() {
  try {
    // Connect to the database
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected to database successfully');
    
    // Load and execute the SQL script
    const sqlFilePath = path.join(__dirname, 'add-missing-voice-columns.sql');
    console.log(`Loading SQL from ${sqlFilePath}`);
    
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('SQL content loaded successfully');
    
    console.log('Executing SQL to add missing voice columns...');
    await client.query(sqlContent);
    console.log('✅ Missing voice columns added successfully');
    
    // Verify columns exist
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name LIKE 'scheduled_voice_%'
    `);
    
    console.log('\nVerifying added columns:');
    result.rows.forEach(row => {
      console.log(`✅ Column exists: ${row.column_name}`);
    });
    
    console.log('\nDatabase update completed successfully');
  } catch (error) {
    console.error('Error adding missing voice columns:', error);
  } finally {
    await client.end();
  }
}

// Execute the function
addMissingVoiceColumns().catch(console.error); 