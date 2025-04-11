import dotenv from 'dotenv';
dotenv.config();

import { sql, db } from './server/db';
import * as schema from './shared/schema';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

async function migrateToNeon() {
  try {
    console.log('Starting database migration to Neon...');
    
    // Step 1: Test connection
    console.log('Testing database connection...');
    const result = await sql`SELECT version()`;
    console.log(`Connected to: ${result[0].version}`);
    
    // Step 2: Push schema to database
    console.log('\nPushing schema to database...');
    
    // Create tables
    await pushSchema();
    
    console.log('\nMigration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

async function pushSchema() {
  try {
    // Create migrations table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    
    // Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        profile_image TEXT,
        role TEXT NOT NULL DEFAULT 'client',
        bio TEXT,
        specialties TEXT[],
        pricing INTEGER,
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
        rating INTEGER,
        review_count INTEGER DEFAULT 0,
        verified BOOLEAN DEFAULT false,
        account_balance INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        last_active TIMESTAMP DEFAULT NOW(),
        is_online BOOLEAN DEFAULT false,
        stripe_customer_id TEXT,
        balance REAL DEFAULT 0,
        earnings REAL DEFAULT 0,
        rate_per_minute REAL DEFAULT 5.0
      )
    `;
    console.log('- Users table created');
    
    // Messages table
    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id),
        receiver_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        is_paid BOOLEAN DEFAULT false,
        price INTEGER,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('- Messages table created');
    
    // Readings table
    await sql`
      CREATE TABLE IF NOT EXISTS readings (
        id SERIAL PRIMARY KEY,
        reader_id INTEGER NOT NULL REFERENCES users(id),
        client_id INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL,
        type TEXT NOT NULL,
        reading_mode TEXT NOT NULL,
        scheduled_for TIMESTAMP,
        duration INTEGER NOT NULL,
        price INTEGER NOT NULL,
        price_per_minute INTEGER NOT NULL,
        total_price INTEGER,
        notes TEXT,
        started_at TIMESTAMP,
        payment_status TEXT DEFAULT 'pending',
        payment_id TEXT,
        payment_link_url TEXT,
        stripe_customer_id TEXT,
        rating INTEGER,
        review TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `;
    console.log('- Readings table created');
    
    // Products table
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        price INTEGER NOT NULL,
        image_url TEXT NOT NULL,
        category TEXT NOT NULL,
        stock INTEGER NOT NULL,
        featured BOOLEAN DEFAULT false,
        stripe_product_id TEXT,
        stripe_price_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('- Products table created');
    
    // Orders table
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL,
        total INTEGER NOT NULL,
        shipping_address JSONB NOT NULL,
        payment_status TEXT DEFAULT 'pending',
        stripe_payment_intent_id TEXT,
        stripe_session_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('- Orders table created');
    
    // Order Items table
    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL,
        price INTEGER NOT NULL
      )
    `;
    console.log('- Order Items table created');
    
    // Livestreams table
    await sql`
      CREATE TABLE IF NOT EXISTS livestreams (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        thumbnail_url TEXT,
        status TEXT NOT NULL,
        scheduled_for TIMESTAMP,
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        category TEXT NOT NULL,
        viewer_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        room_id TEXT,
        recording_url TEXT,
        livekit_room_name TEXT,
        duration REAL
      )
    `;
    console.log('- Livestreams table created');
    
    // Forum Posts table
    await sql`
      CREATE TABLE IF NOT EXISTS forum_posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        likes INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('- Forum Posts table created');
    
    // Forum Comments table
    await sql`
      CREATE TABLE IF NOT EXISTS forum_comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        post_id INTEGER NOT NULL REFERENCES forum_posts(id),
        content TEXT NOT NULL,
        likes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('- Forum Comments table created');
    
    // Gifts table
    await sql`
      CREATE TABLE IF NOT EXISTS gifts (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id),
        recipient_id INTEGER NOT NULL REFERENCES users(id),
        livestream_id INTEGER REFERENCES livestreams(id),
        amount INTEGER NOT NULL,
        gift_type TEXT NOT NULL,
        message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        reader_amount INTEGER NOT NULL,
        platform_amount INTEGER NOT NULL,
        processed BOOLEAN DEFAULT false,
        processed_at TIMESTAMP
      )
    `;
    console.log('- Gifts table created');
    
    // Session Logs table
    await sql`
      CREATE TABLE IF NOT EXISTS session_logs (
        id SERIAL PRIMARY KEY,
        room_id TEXT NOT NULL,
        reader_id INTEGER NOT NULL REFERENCES users(id),
        client_id INTEGER NOT NULL REFERENCES users(id),
        session_type TEXT NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INTEGER,
        total_amount REAL,
        reader_earned REAL,
        platform_earned REAL,
        status TEXT NOT NULL,
        end_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('- Session Logs table created');
    
    // Gift Logs table
    await sql`
      CREATE TABLE IF NOT EXISTS gift_logs (
        id SERIAL PRIMARY KEY,
        livestream_id INTEGER REFERENCES livestreams(id),
        sender_id INTEGER NOT NULL REFERENCES users(id),
        receiver_id INTEGER NOT NULL REFERENCES users(id),
        gift_type TEXT NOT NULL,
        gift_value REAL NOT NULL,
        receiver_earned REAL NOT NULL,
        platform_earned REAL NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('- Gift Logs table created');
    
    console.log('Schema creation completed');
  } catch (error) {
    console.error('Error pushing schema:', error);
    throw error;
  }
}

migrateToNeon();