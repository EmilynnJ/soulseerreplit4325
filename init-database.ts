import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import sql from './server/database';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import bcrypt from 'bcryptjs';

// Load environment variables
config({ path: '.env' });
config({ path: '.env.local' });
config({ path: '.env.production' });

// Get directory information for file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to run SQL from a file
async function runSqlFile(filePath: string) {
  try {
    console.log(`Running SQL file: ${filePath}`);
    const sql_file = fs.readFileSync(filePath, 'utf8');
    await sql.unsafe(sql_file);
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
    .sort(); // Sort to ensure consistent order
    
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
    const adminCheck = await sql`
      SELECT * FROM users WHERE role = 'admin' LIMIT 1
    `;
    
    if (adminCheck && adminCheck.length > 0) {
      console.log('✅ Admin user already exists, skipping creation');
      return;
    }
    
    console.log('Creating admin user...');
    
    // Generate secure password hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    // Insert admin user
    await sql`
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
        ${hashedPassword}, 
        'System Administrator', 
        'admin', 
        false, 
        NOW(), 
        NOW()
      )
    `;
    
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
    console.log('Database URL:', process.env.DATABASE_URL ? 'Set (value hidden)' : 'Not set');
    
    // Test database connection first
    try {
      const result = await sql`SELECT 1 as connected`;
      if (result && result[0] && result[0].connected === 1) {
        console.log('✅ Database connection successful');
      } else {
        console.log('❌ Database connection returned unexpected result');
        return;
      }
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      console.error('Please check your database credentials and try again.');
      return;
    }
    
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
  }
}

// Run the initialization
initializeDatabase().catch(console.error).finally(() => {
  console.log('\nNext steps:');
  console.log('1. Set up Clerk users with: npx tsx setup-clerk-users.ts');
  console.log('2. Check database status with: npx tsx check-database.ts');
}); 