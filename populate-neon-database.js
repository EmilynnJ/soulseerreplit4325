/**
 * SoulSeer database population script for Neon
 * This script specifically targets the Neon PostgreSQL database and populates it with essential data
 */

require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');
const { promisify } = require('util');

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

// Helper functions
const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}:${salt}`;
}

// Main function to populate the database
async function populateDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Connected to Neon database successfully.');
    
    // Start transaction
    await client.query('BEGIN');
    
    console.log('Step 1: Truncating existing data...');
    // Truncate tables in reverse dependency order
    const tables = [
      'gift_logs',
      'session_logs',
      'gifts',
      'messages',
      'forum_comments',
      'forum_posts',
      'livestreams',
      'order_items',
      'orders',
      'readings',
      'products',
      'users'
    ];
    
    for (const table of tables) {
      await client.query(`TRUNCATE TABLE ${table} CASCADE`);
      console.log(`  - Truncated ${table}`);
    }
    
    console.log('Step a: Creating admin user...');
    const adminPassword = await hashPassword('admin123');
    const adminResult = await client.query(`
      INSERT INTO users (
        username, password, email, full_name, role, verified, is_online
      ) VALUES (
        'admin', $1, 'admin@soulseer.com', 'System Administrator', 'admin', true, false
      ) RETURNING id
    `, [adminPassword]);
    const adminId = adminResult.rows[0].id;
    console.log(`  - Created admin user with ID: ${adminId}`);
    
    console.log('Step b: Creating reader user...');
    const readerPassword = await hashPassword('reader123');
    const readerResult = await client.query(`
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
      ) RETURNING id
    `, [readerPassword]);
    const readerId = readerResult.rows[0].id;
    console.log(`  - Created reader user with ID: ${readerId}`);
    
    console.log('Step c: Creating client user...');
    const clientPassword = await hashPassword('client123');
    const clientResult = await client.query(`
      INSERT INTO users (
        username, password, email, full_name, role, verified, is_online, balance, rate_per_minute
      ) VALUES (
        'client1', $1, 'client1@email.com', 'Sample Client', 'client', false, false, 5000, 5
      ) RETURNING id
    `, [clientPassword]);
    const clientId = clientResult.rows[0].id;
    console.log(`  - Created client user with ID: ${clientId}`);
    
    console.log('Step d: Creating products...');
    const products = [
      {
        name: 'Crystal Healing Set',
        description: 'A set of 5 healing crystals including Amethyst, Rose Quartz, Clear Quartz, Black Tourmaline, and Citrine.',
        price: 2999,
        imageUrl: '/images/products/crystal-healing-set.jpg',
        category: 'crystals',
        stock: 10,
        featured: true
      },
      {
        name: 'Tarot Card Deck',
        description: 'Complete 78-card traditional Rider-Waite tarot deck with guidebook.',
        price: 3499,
        imageUrl: '/images/products/tarot-deck.jpg',
        category: 'divination',
        stock: 15,
        featured: true
      },
      {
        name: 'Sacred Sage Bundle',
        description: 'White sage smudging bundle for cleansing and purification.',
        price: 1499,
        imageUrl: '/images/products/sage-bundle.jpg',
        category: 'herbs',
        stock: 20,
        featured: true
      }
    ];
    
    const productIds = [];
    for (const product of products) {
      const result = await client.query(`
        INSERT INTO products (
          name, description, price, image_url, category, stock, featured
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7
        ) RETURNING id
      `, [
        product.name,
        product.description,
        product.price,
        product.imageUrl,
        product.category,
        product.stock,
        product.featured
      ]);
      productIds.push(result.rows[0].id);
      console.log(`  - Created product: ${product.name} with ID: ${result.rows[0].id}`);
    }
    
    console.log('Step e: Creating livestream...');
    const roomId = `tarot_weekly_${Date.now()}`;
    const livestreamResult = await client.query(`
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
        $2,
        NOW() + INTERVAL '1 day'
      ) RETURNING id
    `, [readerId, roomId]);
    const livestreamId = livestreamResult.rows[0].id;
    console.log(`  - Created livestream with ID: ${livestreamId}`);
    
    console.log('Step f: Creating forum post...');
    const forumResult = await client.query(`
      INSERT INTO forum_posts (
        user_id, title, content, category, likes, views
      ) VALUES (
        $1,
        'Understanding the Major Arcana',
        'The Major Arcana cards in a tarot deck represent significant life events and spiritual lessons.',
        'education',
        28,
        103
      ) RETURNING id
    `, [readerId]);
    const forumId = forumResult.rows[0].id;
    console.log(`  - Created forum post with ID: ${forumId}`);
    
    console.log('Step g: Creating session log...');
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - 1); // 1 hour ago
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 15); // 15 minute session
    
    const minutesRate = 5.99;
    const duration = 15;
    const totalAmount = parseFloat((minutesRate * duration).toFixed(2));
    const readerAmount = parseFloat((totalAmount * 0.7).toFixed(2)); // 70%
    const platformAmount = parseFloat((totalAmount * 0.3).toFixed(2)); // 30%
    
    const sessionResult = await client.query(`
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
      ) RETURNING id
    `, [
      readerId,
      clientId,
      startTime,
      endTime,
      duration,
      totalAmount,
      readerAmount,
      platformAmount
    ]);
    const sessionId = sessionResult.rows[0].id;
    console.log(`  - Created session log with ID: ${sessionId}`);
    
    console.log('Step h: Creating gift record...');
    const giftAmount = 1000; // $10.00
    const readerGiftAmount = giftAmount * 0.7; // 70%
    const platformGiftAmount = giftAmount * 0.3; // 30%
    
    const giftResult = await client.query(`
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
      ) RETURNING id
    `, [
      clientId,
      readerId,
      livestreamId,
      giftAmount,
      readerGiftAmount,
      platformGiftAmount
    ]);
    const giftId = giftResult.rows[0].id;
    console.log(`  - Created gift with ID: ${giftId}`);
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('All data has been successfully populated!');
    
    // Verify data
    console.log('\nVerifying data...');
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    console.log(`Users count: ${userCount.rows[0].count}`);
    
    const productCount = await client.query('SELECT COUNT(*) FROM products');
    console.log(`Products count: ${productCount.rows[0].count}`);
    
    const livestreamCount = await client.query('SELECT COUNT(*) FROM livestreams');
    console.log(`Livestreams count: ${livestreamCount.rows[0].count}`);
    
    const forumCount = await client.query('SELECT COUNT(*) FROM forum_posts');
    console.log(`Forum posts count: ${forumCount.rows[0].count}`);
    
    const sessionCount = await client.query('SELECT COUNT(*) FROM session_logs');
    console.log(`Session logs count: ${sessionCount.rows[0].count}`);
    
    const giftCount = await client.query('SELECT COUNT(*) FROM gifts');
    console.log(`Gifts count: ${giftCount.rows[0].count}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error populating database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the populate function
populateDatabase()
  .then(() => {
    console.log('\nDatabase population completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\nDatabase population failed!', err);
    process.exit(1);
  });