import sql from './server/database';
import { config } from 'dotenv';

// Load environment variables from all possible .env files
config({ path: '.env' });
config({ path: '.env.local' });
config({ path: '.env.production' });

async function checkDatabaseTables() {
  try {
    console.log('Checking database connection and tables...');
    
    // Test database connection
    try {
      console.log('Database URL:', process.env.DATABASE_URL ? 'Set (value hidden)' : 'Not set');
      
      const result = await sql`SELECT 1 as connected`;
      if (result && result[0] && result[0].connected === 1) {
        console.log('✅ Database connection successful');
      } else {
        console.log('❌ Database connection returned unexpected result');
      }
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    }
    
    // List of tables to check from schema.ts
    const tablesToCheck = [
      'users',
      'messages',
      'readings',
      'products',
      'orders',
      'order_items',
      'livestreams',
      'forum_posts',
      'forum_comments',
      'gifts',
      'session'
    ];
    
    // Check if tables exist
    console.log('\nChecking tables:');
    for (const table of tablesToCheck) {
      try {
        // This query checks if the table exists in the public schema
        const exists = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name = ${table}
          );
        `;
        
        if (exists[0].exists) {
          console.log(`✅ Table '${table}' exists`);
          
          // Count the number of rows in the table
          const count = await sql`SELECT COUNT(*) FROM "${table}"`;
          console.log(`   - ${count[0].count} rows`);
        } else {
          console.log(`❌ Table '${table}' DOES NOT exist`);
        }
      } catch (error) {
        console.error(`❌ Error checking table '${table}':`, error);
      }
    }
    
    console.log('\nDatabase check completed');
  } catch (error) {
    console.error('Error in database check:', error);
    process.exit(1);
  }
}

checkDatabaseTables().catch(console.error).finally(() => {
  console.log('\nTo initialize the database with all tables and an admin user, run:');
  console.log('npx tsx init-database.ts');
  process.exit(0);
}); 