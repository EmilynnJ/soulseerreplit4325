import pg from 'pg';

// Direct connection string
const DATABASE_URL = 'postgresql://neondb_owner:npg_Pbpz9TuH5AhX@ep-lively-base-a4k2rid7-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Create client
const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Tables to check
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

async function checkDatabase() {
  try {
    // Connect to database
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Database connection successful');
    
    // Check if tables exist
    console.log('\nChecking tables:');
    for (const table of tablesToCheck) {
      try {
        const exists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name = $1
          );
        `, [table]);
        
        if (exists.rows[0].exists) {
          // Table exists, count rows
          const count = await client.query(`SELECT COUNT(*) FROM "${table}"`);
          console.log(`✅ Table '${table}' exists - ${count.rows[0].count} rows`);
        } else {
          console.log(`❌ Table '${table}' DOES NOT exist`);
        }
      } catch (error) {
        console.error(`❌ Error checking table '${table}':`, error.message);
      }
    }
    
    // Check admin user
    try {
      const adminQuery = await client.query(`
        SELECT * FROM users WHERE role = 'admin' LIMIT 1
      `);
      
      if (adminQuery.rows.length > 0) {
        console.log('\n✅ Admin user exists:', adminQuery.rows[0].username);
      } else {
        console.log('\n❌ No admin user found');
      }
    } catch (error) {
      console.error('\n❌ Error checking admin user:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await client.end();
  }
}

checkDatabase().catch(console.error); 