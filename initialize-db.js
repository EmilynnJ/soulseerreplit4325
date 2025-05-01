import pg from 'pg';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

// Get directory information
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load SQL file
const initialSchemaPath = join(__dirname, 'server', 'migrations', '01_initial_schema.sql');
console.log('Loading schema from:', initialSchemaPath);

let initialSchema;
try {
  initialSchema = fs.readFileSync(initialSchemaPath, 'utf8');
  console.log('Successfully loaded schema file');
} catch (error) {
  console.error('Error loading schema file:', error);
  process.exit(1);
}

// Database connection
const DATABASE_URL = process.env.DATABASE_URL;
console.log('DATABASE_URL:', DATABASE_URL ? `${DATABASE_URL.substring(0, 30)}...` : 'Not set');

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initializeDb() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Successfully connected to database');
    
    console.log('Running initial schema...');
    await client.query(initialSchema);
    console.log('Successfully created database schema');

    // Create admin user
    console.log('Creating admin user...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    await client.query(`
      INSERT INTO users (
        username, 
        email, 
        password, 
        full_name, 
        role, 
        is_online, 
        created_at, 
        updated_at
      ) VALUES (
        'admin', 
        'admin@soulseer.app', 
        $1, 
        'System Administrator', 
        'admin', 
        false, 
        NOW(), 
        NOW()
      ) ON CONFLICT (email) DO NOTHING
    `, [hashedPassword]);
    
    console.log('Admin user created or already exists');
    
    // Additional migrations
    const migrationsDir = join(__dirname, 'server', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql') && file !== '01_initial_schema.sql')
      .sort();
      
    console.log(`Found ${files.length} additional migration files`);
    
    for (const file of files) {
      const filePath = join(migrationsDir, file);
      console.log(`Running migration: ${file}`);
      try {
        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);
        console.log(`Successfully ran migration: ${file}`);
      } catch (error) {
        console.warn(`Warning: Migration ${file} failed:`, error.message);
      }
    }
    
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await client.end();
  }
}

// Run the initialization
console.log('Starting database initialization...');
initializeDb().catch(console.error); 