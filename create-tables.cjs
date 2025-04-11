/**
 * PostgreSQL table creation script for Render PostgreSQL database
 */

require('dotenv').config();
const { Pool } = require('pg');

// Direct connection to the Render database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createTables() {
  const client = await pool.connect();
  
  try {
    console.log('Connected to Render PostgreSQL database successfully.');
    
    // First check existing tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('Current tables in the database:');
    tablesResult.rows.forEach(row => {
      console.log(` - ${row.table_name}`);
    });
    
    // Start transaction
    await client.query('BEGIN');
    
    // Create users table
    console.log('\nCreating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255),
        profile_image VARCHAR(255),
        role VARCHAR(50) NOT NULL,
        bio TEXT,
        specialties TEXT[],
        pricing INTEGER,
        rating DECIMAL,
        review_count INTEGER DEFAULT 0,
        verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP,
        is_online BOOLEAN DEFAULT false,
        karma_points INTEGER DEFAULT 0,
        account_balance INTEGER DEFAULT 0,
        stripe_customer_id VARCHAR(255),
        pricing_chat INTEGER,
        pricing_voice INTEGER,
        pricing_video INTEGER,
        scheduled_chat_price_15 INTEGER,
        scheduled_chat_price_30 INTEGER,
        scheduled_chat_price_60 INTEGER,
        scheduled_voice_price_15 INTEGER, 
        scheduled_voice_price_30 INTEGER,
        scheduled_voice_price_60 INTEGER,
        scheduled_video_price_15 INTEGER,
        scheduled_video_price_30 INTEGER,
        scheduled_video_price_60 INTEGER,
        balance INTEGER DEFAULT 0,
        earnings INTEGER DEFAULT 0,
        rate_per_minute DECIMAL(10, 2)
      )
    `);
    
    // Create products table
    console.log('Creating products table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price INTEGER NOT NULL,
        image_url VARCHAR(255),
        category VARCHAR(100),
        stock INTEGER DEFAULT 0,
        featured BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        stripe_product_id VARCHAR(255),
        stripe_price_id VARCHAR(255)
      )
    `);
    
    // Create readings table
    console.log('Creating readings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS readings (
        id SERIAL PRIMARY KEY,
        reader_id INTEGER REFERENCES users(id),
        client_id INTEGER REFERENCES users(id),
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        reading_mode VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        scheduled_for TIMESTAMP,
        completed_at TIMESTAMP,
        duration INTEGER,
        price INTEGER,
        price_per_minute INTEGER,
        total_price INTEGER,
        notes TEXT,
        started_at TIMESTAMP,
        rating INTEGER,
        review TEXT
      )
    `);
    
    // Create orders table
    console.log('Creating orders table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        total INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payment_status VARCHAR(50) DEFAULT 'pending',
        payment_link_url TEXT,
        shipping_address JSONB,
        square_order_id VARCHAR(255),
        square_payment_id VARCHAR(255)
      )
    `);
    
    // Create order_items table
    console.log('Creating order_items table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        price INTEGER NOT NULL
      )
    `);
    
    // Create livestreams table
    console.log('Creating livestreams table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS livestreams (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        status VARCHAR(50) DEFAULT 'scheduled',
        thumbnail_url VARCHAR(255),
        room_id VARCHAR(255),
        live_token VARCHAR(255),
        viewer_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        scheduled_for TIMESTAMP,
        started_at TIMESTAMP,
        ended_at TIMESTAMP
      )
    `);
    
    // Create forum_posts table
    console.log('Creating forum_posts table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS forum_posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(100),
        likes INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create forum_comments table
    console.log('Creating forum_comments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS forum_comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES forum_posts(id),
        user_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        likes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create messages table
    console.log('Creating messages table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id),
        recipient_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create gifts table
    console.log('Creating gifts table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS gifts (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id),
        recipient_id INTEGER REFERENCES users(id),
        livestream_id INTEGER REFERENCES livestreams(id),
        amount INTEGER NOT NULL,
        gift_type VARCHAR(50),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reader_amount INTEGER,
        platform_amount INTEGER,
        processed BOOLEAN DEFAULT false,
        processed_at TIMESTAMP
      )
    `);
    
    // Create session_logs table
    console.log('Creating session_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS session_logs (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(255) UNIQUE NOT NULL,
        reader_id INTEGER REFERENCES users(id),
        client_id INTEGER REFERENCES users(id),
        session_type VARCHAR(50) NOT NULL,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        duration INTEGER,
        total_amount DECIMAL(10, 2),
        reader_earned DECIMAL(10, 2),
        platform_earned DECIMAL(10, 2),
        status VARCHAR(50) NOT NULL,
        end_reason VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create gift_logs table
    console.log('Creating gift_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS gift_logs (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id),
        receiver_id INTEGER REFERENCES users(id),
        livestream_id INTEGER REFERENCES livestreams(id),
        gift_type VARCHAR(50),
        amount INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create migrations table if doesn't exist
    console.log('Creating migrations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert sample users
    console.log('\nAdding admin user...');
    await client.query(`
      INSERT INTO users (username, password, email, full_name, role, verified, is_online, rate_per_minute)
      VALUES (
        'admin',
        '5f167a141f4e850ef3083118c1a92d5dbfcc3d2d467d0607e664d8f3595ca79d93ae8b0d2ea24223e165a37213b2fd70df5e876714ac887151c37fb6b18a8253:41e1b1e40bfec3e6d613dbc9e7a0c436',
        'admin@soulseer.com',
        'System Administrator',
        'admin',
        true,
        false,
        5.00
      )
      ON CONFLICT (username) DO NOTHING
    `);
    
    console.log('Adding reader user...');
    await client.query(`
      INSERT INTO users (
        username, password, email, full_name, profile_image, role, bio, specialties, 
        verified, is_online, scheduled_chat_price_15, scheduled_chat_price_30, scheduled_chat_price_60,
        scheduled_voice_price_15, scheduled_voice_price_30, scheduled_voice_price_60,
        scheduled_video_price_15, scheduled_video_price_30, scheduled_video_price_60,
        rate_per_minute
      )
      VALUES (
        'mysticreader',
        'db9b6ff7dbc1752668cb2d3fd192015966580c5934639ff8de7bfea970893b65fe0616af37bf321c343c651f7f5de6d07c5af0f2f82369eda09064976e47fc53:0a74957201f071053b0a4f8525c2b089',
        'mysticreader@soulseer.com',
        'Mystic Reader',
        '/images/readers/default-reader.svg',
        'reader',
        'Expert tarot reader with 10 years of experience in spiritual guidance.',
        ARRAY['Tarot', 'Clairvoyance', 'Love Readings'],
        true,
        true,
        1500, 2500, 4500,
        2000, 3500, 6500,
        2500, 4500, 8500,
        5.99
      )
      ON CONFLICT (username) DO NOTHING
    `);
    
    console.log('Adding client user...');
    await client.query(`
      INSERT INTO users (username, password, email, full_name, role, verified, is_online, balance, rate_per_minute)
      VALUES (
        'client1',
        'b513b6a4956a4e24f871898c30733b5b33b5def94d63426b9c53936ac1a6a3fd78cbd3e249580017eaa21cee44633b1f3f6ffb10cb57d2488e2accb4b88b7175:dad0ad712c2b3f1c46b7a2dc81250653',
        'client1@email.com',
        'Sample Client',
        'client',
        false,
        false,
        5000,
        5.00
      )
      ON CONFLICT (username) DO NOTHING
    `);
    
    // Insert sample products
    console.log('\nAdding products...');
    await client.query(`
      INSERT INTO products (name, description, price, image_url, category, stock, featured)
      VALUES 
        (
          'Crystal Healing Set',
          'A set of 5 healing crystals including Amethyst, Rose Quartz, Clear Quartz, Black Tourmaline, and Citrine.',
          2999,
          '/images/products/crystal-healing-set.jpg',
          'crystals',
          10,
          true
        ),
        (
          'Tarot Card Deck',
          'Complete 78-card traditional Rider-Waite tarot deck with guidebook.',
          3499,
          '/images/products/tarot-deck.jpg',
          'divination',
          15,
          true
        ),
        (
          'Sacred Sage Bundle',
          'White sage smudging bundle for cleansing and purification.',
          1499,
          '/images/products/sage-bundle.jpg',
          'herbs',
          20,
          true
        )
      ON CONFLICT DO NOTHING
    `);
    
    // Retrieve reader ID
    const readerResult = await client.query(`SELECT id FROM users WHERE username = 'mysticreader'`);
    const readerId = readerResult.rows[0]?.id;
    
    if (readerId) {
      // Create a livestream
      console.log('\nAdding livestream...');
      await client.query(`
        INSERT INTO livestreams (user_id, title, description, thumbnail_url, status, scheduled_for, room_id)
        VALUES (
          $1,
          'Weekly Tarot Guidance',
          'Join me for weekly tarot readings and spiritual guidance. Ask your questions live!',
          '/images/livestreams/tarot-livestream.jpg',
          'scheduled',
          NOW() + INTERVAL '1 day',
          'tarot_weekly_' || EXTRACT(EPOCH FROM NOW())::bigint
        )
        ON CONFLICT DO NOTHING
      `, [readerId]);
      
      // Create a forum post
      console.log('Adding forum post...');
      await client.query(`
        INSERT INTO forum_posts (user_id, title, content, category)
        VALUES (
          $1,
          'Understanding Dream Symbols',
          'I''ve been having recurring dreams about water. What could this symbolize in spiritual terms?',
          'dreams'
        )
        ON CONFLICT DO NOTHING
      `, [readerId]);
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    // Check tables after creation
    const finalTablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('\nTables in the database after setup:');
    finalTablesResult.rows.forEach(row => {
      console.log(` - ${row.table_name}`);
    });
    
    // Check for data
    console.log('\nVerifying data:');
    
    const usersCount = await client.query('SELECT COUNT(*) FROM users');
    console.log(`Users count: ${usersCount.rows[0].count}`);
    
    const productsCount = await client.query('SELECT COUNT(*) FROM products');
    console.log(`Products count: ${productsCount.rows[0].count}`);
    
    const livestreamsCount = await client.query('SELECT COUNT(*) FROM livestreams');
    console.log(`Livestreams count: ${livestreamsCount.rows[0].count}`);
    
    const forumPostsCount = await client.query('SELECT COUNT(*) FROM forum_posts');
    console.log(`Forum posts count: ${forumPostsCount.rows[0].count}`);
    
    console.log('\nAll tables have been created and populated successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating tables:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the function
createTables()
  .then(() => {
    console.log('Database setup complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Database setup failed:', err);
    process.exit(1);
  });