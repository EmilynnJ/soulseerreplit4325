/**
 * Complete database initialization script for SoulSeer
 * This script creates all required tables and populates them with initial data
 */

const { Pool } = require('pg');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

// Establish database connection
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

// Helper function to hash passwords using scrypt
async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    // Generate a random salt
    const salt = crypto.randomBytes(16).toString('hex');
    
    // Hash the password with the salt
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      // Format as salt:hash
      resolve(`${derivedKey.toString('hex')}:${salt}`);
    });
  });
}

async function initializeDatabase() {
  let client;
  
  try {
    console.log('Connecting to database...');
    client = await pool.connect();
    console.log('Connected successfully.');
    
    // Create tables if they don't exist
    console.log('Creating tables...');

    // Users table
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
      );
    `);
    
    // Products table
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
      );
    `);
    
    // Readings table
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
      );
    `);
    
    // Orders table
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
      );
    `);
    
    // OrderItems table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        price INTEGER NOT NULL
      );
    `);
    
    // Livestreams table
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
      );
    `);
    
    // ForumPosts table
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
      );
    `);
    
    // ForumComments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS forum_comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES forum_posts(id),
        user_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        likes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id),
        recipient_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Gifts table
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
      );
    `);
    
    // SessionLogs table for pay-per-minute readings
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
      );
    `);
    
    // GiftLogs table for livestream gifts
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
      );
    `);
    
    console.log('Tables created successfully.');
    
    // Insert users if they don't exist
    console.log('Creating users...');
    
    // Check if admin user exists
    const adminExists = await client.query(`
      SELECT * FROM users WHERE username = 'admin'
    `);
    
    if (adminExists.rows.length === 0) {
      // Create admin user
      const adminPassword = await hashPassword('admin123');
      await client.query(`
        INSERT INTO users (
          username, password, email, full_name, role, verified, is_online
        ) VALUES (
          'admin', $1, 'admin@soulseer.com', 'System Administrator', 'admin', true, false
        )
      `, [adminPassword]);
      console.log('Admin user created.');
    }
    
    // Check if reader user exists
    const readerExists = await client.query(`
      SELECT * FROM users WHERE username = 'mysticreader'
    `);
    
    if (readerExists.rows.length === 0) {
      // Create reader user
      const readerPassword = await hashPassword('reader123');
      await client.query(`
        INSERT INTO users (
          username, password, email, full_name, profile_image, role, bio, specialties,
          verified, is_online, rate_per_minute,
          scheduled_chat_price_15, scheduled_chat_price_30, scheduled_chat_price_60,
          scheduled_voice_price_15, scheduled_voice_price_30, scheduled_voice_price_60,
          scheduled_video_price_15, scheduled_video_price_30, scheduled_video_price_60
        ) VALUES (
          'mysticreader', $1, 'mysticreader@soulseer.com', 'Mystic Reader', 
          '/images/readers/default-reader.svg', 'reader', 
          'Expert tarot reader with 10 years of experience in spiritual guidance.',
          ARRAY['Tarot', 'Clairvoyance', 'Love Readings'],
          true, true, 5.99,
          1500, 2500, 4500,
          2000, 3500, 6500,
          2500, 4500, 8500
        )
      `, [readerPassword]);
      console.log('Reader user created.');
    }
    
    // Check if client user exists
    const clientExists = await client.query(`
      SELECT * FROM users WHERE username = 'client1'
    `);
    
    if (clientExists.rows.length === 0) {
      // Create client user
      const clientPassword = await hashPassword('client123');
      await client.query(`
        INSERT INTO users (
          username, password, email, full_name, role, verified, is_online, balance, rate_per_minute
        ) VALUES (
          'client1', $1, 'client1@email.com', 'Sample Client', 'client', false, false, 50, 5
        )
      `, [clientPassword]);
      console.log('Client user created.');
    }
    
    // Create featured products if they don't exist
    const productsExist = await client.query(`
      SELECT * FROM products WHERE featured = true
    `);
    
    if (productsExist.rows.length === 0) {
      await client.query(`
        INSERT INTO products (
          name, description, price, image_url, category, stock, featured
        ) VALUES (
          'Crystal Healing Set', 
          'A set of 5 healing crystals including Amethyst, Rose Quartz, Clear Quartz, Black Tourmaline, and Citrine.', 
          2999, 
          '/images/products/crystal-healing-set.jpg', 
          'crystals', 
          10, 
          true
        )
      `);
      
      await client.query(`
        INSERT INTO products (
          name, description, price, image_url, category, stock, featured
        ) VALUES (
          'Tarot Card Deck', 
          'Complete 78-card traditional Rider-Waite tarot deck with guidebook.', 
          3499, 
          '/images/products/tarot-deck.jpg', 
          'divination', 
          15, 
          true
        )
      `);
      
      await client.query(`
        INSERT INTO products (
          name, description, price, image_url, category, stock, featured
        ) VALUES (
          'Sacred Sage Bundle', 
          'White sage smudging bundle for cleansing and purification.', 
          1499, 
          '/images/products/sage-bundle.jpg', 
          'herbs', 
          20, 
          true
        )
      `);
      
      console.log('Featured products created.');
    }
    
    // Create a livestream if none exist
    const livestreamsExist = await client.query(`
      SELECT * FROM livestreams
    `);
    
    if (livestreamsExist.rows.length === 0) {
      // Get reader ID
      const readerResult = await client.query(`
        SELECT id FROM users WHERE username = 'mysticreader'
      `);
      
      if (readerResult.rows.length > 0) {
        const readerId = readerResult.rows[0].id;
        
        await client.query(`
          INSERT INTO livestreams (
            user_id, title, description, category, status, thumbnail_url,
            room_id, scheduled_for
          ) VALUES (
            $1, 
            'Weekly Tarot Guidance', 
            'Join me for weekly tarot readings and spiritual guidance. Ask your questions live!',
            'Tarot',
            'scheduled',
            '/images/livestreams/tarot-livestream.jpg',
            'tarot_weekly_${Date.now()}',
            NOW() + INTERVAL '1 day'
          )
        `, [readerId]);
        
        console.log('Livestream created.');
      }
    }
    
    // Create a session log if none exist
    const sessionLogsExist = await client.query(`
      SELECT * FROM session_logs
    `);
    
    if (sessionLogsExist.rows.length === 0) {
      // Get user IDs
      const usersResult = await client.query(`
        SELECT id, username FROM users WHERE username IN ('mysticreader', 'client1')
      `);
      
      const userMap = usersResult.rows.reduce((map, user) => {
        map[user.username] = user.id;
        return map;
      }, {});
      
      if (userMap.mysticreader && userMap.client1) {
        // Create a completed reading session
        const startTime = new Date();
        startTime.setHours(startTime.getHours() - 1); // 1 hour ago
        
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + 15); // 15 minute session
        
        const minutesRate = 5.99;
        const duration = 15;
        const totalAmount = parseFloat((minutesRate * duration).toFixed(2));
        const readerAmount = parseFloat((totalAmount * 0.7).toFixed(2)); // 70%
        const platformAmount = parseFloat((totalAmount * 0.3).toFixed(2)); // 30%
        
        await client.query(`
          INSERT INTO session_logs (
            room_id, reader_id, client_id, session_type, start_time, end_time,
            duration, total_amount, reader_earned, platform_earned, status, end_reason
          ) VALUES (
            'reading_a1b2c3d4',
            $1,
            $2,
            'video',
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            'ended',
            'completed'
          )
        `, [
          userMap.mysticreader,
          userMap.client1,
          startTime,
          endTime,
          duration,
          totalAmount,
          readerAmount,
          platformAmount
        ]);
        
        console.log('Session log created.');
      }
    }
    
    // Create forum posts if none exist
    const forumPostsExist = await client.query(`
      SELECT * FROM forum_posts
    `);
    
    if (forumPostsExist.rows.length === 0) {
      // Get reader ID
      const readerResult = await client.query(`
        SELECT id FROM users WHERE username = 'mysticreader'
      `);
      
      if (readerResult.rows.length > 0) {
        const readerId = readerResult.rows[0].id;
        
        await client.query(`
          INSERT INTO forum_posts (
            user_id, title, content, category, likes, views
          ) VALUES (
            $1,
            'Understanding the Major Arcana',
            'The Major Arcana cards in a tarot deck represent significant life events and spiritual lessons.',
            'education',
            28,
            103
          )
        `, [readerId]);
        
        console.log('Forum post created.');
      }
    }
    
    // Create a gift if none exist
    const giftsExist = await client.query(`
      SELECT * FROM gifts
    `);
    
    if (giftsExist.rows.length === 0) {
      // Get user IDs and livestream ID
      const usersResult = await client.query(`
        SELECT id, username FROM users WHERE username IN ('mysticreader', 'client1')
      `);
      
      const userMap = usersResult.rows.reduce((map, user) => {
        map[user.username] = user.id;
        return map;
      }, {});
      
      const livestreamResult = await client.query(`
        SELECT id FROM livestreams LIMIT 1
      `);
      
      if (userMap.mysticreader && userMap.client1 && livestreamResult.rows.length > 0) {
        const livestreamId = livestreamResult.rows[0].id;
        const giftAmount = 1000; // $10.00
        const readerAmount = giftAmount * 0.7; // 70%
        const platformAmount = giftAmount * 0.3; // 30%
        
        await client.query(`
          INSERT INTO gifts (
            sender_id, recipient_id, livestream_id, amount, gift_type, message,
            reader_amount, platform_amount, processed
          ) VALUES (
            $1,
            $2,
            $3,
            $4,
            'heart',
            'Thank you for the amazing insights!',
            $5,
            $6,
            true
          )
        `, [
          userMap.client1,
          userMap.mysticreader,
          livestreamId,
          giftAmount,
          readerAmount,
          platformAmount
        ]);
        
        console.log('Gift created.');
      }
    }
    
    console.log('Database initialization completed successfully!');
    
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run the initialization
initializeDatabase()
  .then(() => {
    console.log('Database setup complete, exiting...');
    process.exit(0);
  })
  .catch(err => {
    console.error('Database setup failed:', err);
    process.exit(1);
  });