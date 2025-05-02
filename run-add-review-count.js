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

async function addReviewCountColumn() {
  try {
    // Connect to the database
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected to database successfully');
    
    // Load and execute the SQL script
    const sqlFilePath = path.join(__dirname, 'add-review-count.sql');
    console.log(`Loading SQL from ${sqlFilePath}`);
    
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('SQL content loaded successfully');
    
    console.log('Executing SQL to add review_count column...');
    await client.query(sqlContent);
    console.log('✅ review_count column added successfully');
    
    // Verify column exists
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'review_count'
    `);
    
    console.log('\nVerifying added column:');
    if (result.rows.length > 0) {
      console.log(`✅ Column exists: ${result.rows[0].column_name}`);
    } else {
      console.log('❌ Column was not added correctly');
    }
    
    console.log('\nDatabase update completed successfully');
  } catch (error) {
    console.error('Error adding review_count column:', error);
  } finally {
    await client.end();
  }
}

// Execute the function
addReviewCountColumn().catch(console.error); 