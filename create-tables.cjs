/**
 * SoulSeer Database Table Creation Script
 * This script creates all required tables in the Neon PostgreSQL database
 */

require('dotenv').config();
const { Pool } = require('pg');

// Configure PostgreSQL client for Neon
const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT || 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

// Main function to create database tables
async function createTables() {
  const client = await pool.connect();
  
  try {
    console.log('Connected to Neon database successfully.');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Create users table
    console.log('Creating users table...');
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
        square_customer_id VARCHAR(255),
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
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('All tables have been created successfully!');
    
    // Verify tables
    console.log('\nVerifying tables...');
    const tableQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    const tables = await client.query(tableQuery);
    console.log('Tables in the database:');
    tables.rows.forEach((table, i) => {
      console.log(`${i+1}. ${table.table_name}`);
    });
    
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
    console.log('\nDatabase tables created successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\nFailed to create database tables:', err);
    process.exit(1);
  });