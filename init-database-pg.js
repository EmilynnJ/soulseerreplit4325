import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pg from 'pg';
import bcrypt from 'bcryptjs';

// Load environment variables
config({ path: '.env' });
config({ path: '.env.local' });
config({ path: '.env.production' });

// Get directory information for file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Setup PostgreSQL client
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_Pbpz9TuH5AhX@ep-lively-base-a4k2rid7-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Function to run SQL from a file
async function runSqlFile(filePath) {
  try {
    console.log(`Running SQL file: ${filePath}`);
    const sqlFile = fs.readFileSync(filePath, 'utf8');
    
    // Execute the SQL
    await client.query(sqlFile);
    
    console.log(`✅ Successfully executed SQL file: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error executing SQL file ${filePath}:`, error);
    return false;
  }
}

// Run all migration files in order
async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'server', 'migrations');
  
  // Check initial schema first
  const initialSchemaPath = path.join(migrationsDir, '01_initial_schema.sql');
  if (fs.existsSync(initialSchemaPath)) {
    const success = await runSqlFile(initialSchemaPath);
    if (!success) {
      throw new Error('Failed to execute initial schema migration');
    }
  } else {
    console.error(`❌ Initial schema file not found at ${initialSchemaPath}`);
    throw new Error('Initial schema file not found');
  }
  
  // Get all other SQL files and run them
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql') && file !== '01_initial_schema.sql')
    .sort();
    
  console.log(`Found ${files.length} additional migration files`);
  
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const success = await runSqlFile(filePath);
    if (!success) {
      console.warn(`⚠️ Warning: Migration file ${file} failed, continuing anyway`);
    }
  }
}

// Create admin user function
async function createAdminUser() {
  try {
    // Check if admin user exists
    const adminCheck = await client.query(`
      SELECT * FROM users WHERE role = 'admin' LIMIT 1
    `);
    
    if (adminCheck.rows.length > 0) {
      console.log('✅ Admin user already exists, skipping creation');
      return;
    }
    
    console.log('Creating admin user...');
    
    // Generate secure password hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    // Insert admin user
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
      )
    `, [hashedPassword]);
    
    console.log('✅ Admin user created successfully:');
    console.log('   Username: admin');
    console.log('   Email: admin@soulseer.app');
    console.log('   Password: admin123');
    console.log('   IMPORTANT: Change this password immediately after first login!');
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
}

// Main function to initialize database
async function initializeDatabase() {
  try {
    console.log('===== Database Initialization =====');
    console.log('Database URL:', DATABASE_URL ? DATABASE_URL.substring(0, 35) + '...' : 'Not set');
    
    // Connect to the database
    await client.connect();
    console.log('✅ Database connection successful');
    
    // Run migrations
    console.log('\n--- Running Migrations ---');
    await runMigrations();
    console.log('✅ Migrations completed successfully');
    
    // Create admin user
    console.log('\n--- Creating Admin User ---');
    await createAdminUser();
    
    console.log('\n✅ Database initialization completed successfully');
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await client.end();
  }
}

// Run the initialization
initializeDatabase().catch(console.error).finally(() => {
  console.log('\nNext steps:');
  console.log('1. Set up Clerk users with: node setup-clerk-users.js');
  console.log('2. Check database tables with your admin credentials');
}); 