require('dotenv').config();

// Store current (new) DATABASE_URL
const NEW_DATABASE_URL = process.env.DATABASE_URL;

// Old database connection (previous Neon database)
const OLD_DATABASE_URL = 'postgresql://neondb_owner:npg_1tA3DvNckXoW@ep-noisy-union-a5mhired-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';

// Import pg
const { Pool } = require('pg');

// Create pools for both databases
const oldPool = new Pool({ 
  connectionString: OLD_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const newPool = new Pool({ 
  connectionString: NEW_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrateData() {
  console.log('Starting data migration from old Neon database to new Neon database...');
  
  try {
    // Test connections
    await testConnections();
    
    // Migrate all tables
    await migrateUsers();
    await migrateMessages();
    await migrateReadings();
    await migrateProducts();
    await migrateOrders();
    await migrateOrderItems();
    await migrateLivestreams();
    await migrateForumPosts();
    await migrateForumComments();
    await migrateGifts();
    await migrateSessionLogs();
    await migrateGiftLogs();
    
    console.log('\nData migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    // Close connections
    await oldPool.end();
    await newPool.end();
  }
}

async function testConnections() {
  try {
    console.log('Testing database connections...');
    
    // Test old database
    const oldClient = await oldPool.connect();
    const oldResult = await oldClient.query('SELECT version()');
    console.log('Old database connection successful:', oldResult.rows[0].version);
    oldClient.release();
    
    // Test new database
    const newClient = await newPool.connect();
    const newResult = await newClient.query('SELECT version()');
    console.log('New database connection successful:', newResult.rows[0].version);
    newClient.release();
    
    console.log('Both connections successful!\n');
  } catch (error) {
    console.error('Connection test failed:', error);
    throw error;
  }
}

async function migrateUsers() {
  try {
    console.log('Migrating users...');
    
    // Get all users from old database
    const oldClient = await oldPool.connect();
    let users = [];
    try {
      const result = await oldClient.query('SELECT * FROM users');
      users = result.rows;
    } catch (err) {
      console.log('Error fetching users:', err.message);
    }
    oldClient.release();
    
    if (users.length === 0) {
      console.log('No users found in old database.');
      return;
    }
    
    // Insert users into new database
    const newClient = await newPool.connect();
    
    // First, clear the table in the new database
    await newClient.query('TRUNCATE users CASCADE');
    
    // Then insert all users
    let counter = 0;
    for (const user of users) {
      const query = `
        INSERT INTO users (
          id, username, password, email, full_name, profile_image, role, bio,
          specialties, pricing, pricing_chat, pricing_voice, pricing_video,
          scheduled_chat_price_15, scheduled_chat_price_30, scheduled_chat_price_60,
          scheduled_voice_price_15, scheduled_voice_price_30, scheduled_voice_price_60,
          scheduled_video_price_15, scheduled_video_price_30, scheduled_video_price_60,
          rating, review_count, verified, account_balance, created_at, last_active,
          is_online, stripe_customer_id, balance, earnings, rate_per_minute
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33
        )
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          password = EXCLUDED.password,
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          profile_image = EXCLUDED.profile_image,
          role = EXCLUDED.role,
          bio = EXCLUDED.bio,
          specialties = EXCLUDED.specialties,
          pricing = EXCLUDED.pricing,
          pricing_chat = EXCLUDED.pricing_chat,
          pricing_voice = EXCLUDED.pricing_voice,
          pricing_video = EXCLUDED.pricing_video,
          scheduled_chat_price_15 = EXCLUDED.scheduled_chat_price_15,
          scheduled_chat_price_30 = EXCLUDED.scheduled_chat_price_30,
          scheduled_chat_price_60 = EXCLUDED.scheduled_chat_price_60,
          scheduled_voice_price_15 = EXCLUDED.scheduled_voice_price_15,
          scheduled_voice_price_30 = EXCLUDED.scheduled_voice_price_30,
          scheduled_voice_price_60 = EXCLUDED.scheduled_voice_price_60,
          scheduled_video_price_15 = EXCLUDED.scheduled_video_price_15,
          scheduled_video_price_30 = EXCLUDED.scheduled_video_price_30,
          scheduled_video_price_60 = EXCLUDED.scheduled_video_price_60,
          rating = EXCLUDED.rating,
          review_count = EXCLUDED.review_count,
          verified = EXCLUDED.verified,
          account_balance = EXCLUDED.account_balance,
          created_at = EXCLUDED.created_at,
          last_active = EXCLUDED.last_active,
          is_online = EXCLUDED.is_online,
          stripe_customer_id = EXCLUDED.stripe_customer_id,
          balance = EXCLUDED.balance,
          earnings = EXCLUDED.earnings,
          rate_per_minute = EXCLUDED.rate_per_minute
      `;
      
      try {
        await newClient.query(query, [
          user.id, user.username, user.password, user.email, user.full_name, user.profile_image, 
          user.role, user.bio, user.specialties, user.pricing, user.pricing_chat, user.pricing_voice, 
          user.pricing_video, user.scheduled_chat_price_15, user.scheduled_chat_price_30, 
          user.scheduled_chat_price_60, user.scheduled_voice_price_15, user.scheduled_voice_price_30, 
          user.scheduled_voice_price_60, user.scheduled_video_price_15, user.scheduled_video_price_30, 
          user.scheduled_video_price_60, user.rating, user.review_count, user.verified, 
          user.account_balance, user.created_at, user.last_active, user.is_online, 
          user.stripe_customer_id, user.balance, user.earnings, user.rate_per_minute
        ]);
        counter++;
      } catch (err) {
        console.error(`Error inserting user ${user.id} (${user.username}):`, err);
      }
    }
    
    // Update the sequence
    await newClient.query(`
      SELECT setval('users_id_seq', (SELECT MAX(id) FROM users), true)
    `);
    
    newClient.release();
    console.log(`Migrated ${counter} of ${users.length} users`);
  } catch (error) {
    console.error('Error migrating users:', error);
  }
}

async function migrateMessages() {
  try {
    console.log('Migrating messages...');
    
    // Get all messages from old database
    const oldClient = await oldPool.connect();
    let messages = [];
    try {
      const result = await oldClient.query('SELECT * FROM messages');
      messages = result.rows;
    } catch (err) {
      console.log('Error fetching messages:', err.message);
    }
    oldClient.release();
    
    if (messages.length === 0) {
      console.log('No messages found in old database.');
      return;
    }
    
    // Insert messages into new database
    const newClient = await newPool.connect();
    
    // First, clear the table in the new database
    await newClient.query('TRUNCATE messages CASCADE');
    
    // Then insert all messages
    let counter = 0;
    for (const message of messages) {
      const query = `
        INSERT INTO messages (
          id, sender_id, receiver_id, content, is_paid, price, read_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          sender_id = EXCLUDED.sender_id,
          receiver_id = EXCLUDED.receiver_id,
          content = EXCLUDED.content,
          is_paid = EXCLUDED.is_paid,
          price = EXCLUDED.price,
          read_at = EXCLUDED.read_at,
          created_at = EXCLUDED.created_at
      `;
      
      try {
        await newClient.query(query, [
          message.id, message.sender_id, message.receiver_id, message.content,
          message.is_paid, message.price, message.read_at, message.created_at
        ]);
        counter++;
      } catch (err) {
        console.error(`Error inserting message ${message.id}:`, err);
      }
    }
    
    // Update the sequence
    await newClient.query(`
      SELECT setval('messages_id_seq', (SELECT MAX(id) FROM messages), true)
    `);
    
    newClient.release();
    console.log(`Migrated ${counter} of ${messages.length} messages`);
  } catch (error) {
    console.error('Error migrating messages:', error);
  }
}

async function migrateReadings() {
  try {
    console.log('Migrating readings...');
    
    // Get all readings from old database
    const oldClient = await oldPool.connect();
    let readings = [];
    try {
      const result = await oldClient.query('SELECT * FROM readings');
      readings = result.rows;
    } catch (err) {
      console.log('Error fetching readings:', err.message);
    }
    oldClient.release();
    
    if (readings.length === 0) {
      console.log('No readings found in old database.');
      return;
    }
    
    // Insert readings into new database
    const newClient = await newPool.connect();
    
    // First, clear the table in the new database
    await newClient.query('TRUNCATE readings CASCADE');
    
    // Then insert all readings
    let counter = 0;
    for (const reading of readings) {
      const query = `
        INSERT INTO readings (
          id, reader_id, client_id, status, type, reading_mode, scheduled_for,
          duration, price, price_per_minute, total_price, notes, started_at,
          payment_status, payment_id, payment_link_url, stripe_customer_id,
          rating, review, created_at, completed_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21
        )
        ON CONFLICT (id) DO UPDATE SET
          reader_id = EXCLUDED.reader_id,
          client_id = EXCLUDED.client_id,
          status = EXCLUDED.status,
          type = EXCLUDED.type,
          reading_mode = EXCLUDED.reading_mode,
          scheduled_for = EXCLUDED.scheduled_for,
          duration = EXCLUDED.duration,
          price = EXCLUDED.price,
          price_per_minute = EXCLUDED.price_per_minute,
          total_price = EXCLUDED.total_price,
          notes = EXCLUDED.notes,
          started_at = EXCLUDED.started_at,
          payment_status = EXCLUDED.payment_status,
          payment_id = EXCLUDED.payment_id,
          payment_link_url = EXCLUDED.payment_link_url,
          stripe_customer_id = EXCLUDED.stripe_customer_id,
          rating = EXCLUDED.rating,
          review = EXCLUDED.review,
          created_at = EXCLUDED.created_at,
          completed_at = EXCLUDED.completed_at
      `;
      
      try {
        await newClient.query(query, [
          reading.id, reading.reader_id, reading.client_id, reading.status, reading.type,
          reading.reading_mode, reading.scheduled_for, reading.duration, reading.price,
          reading.price_per_minute, reading.total_price, reading.notes, reading.started_at,
          reading.payment_status, reading.payment_id, reading.payment_link_url,
          reading.stripe_customer_id, reading.rating, reading.review, reading.created_at,
          reading.completed_at
        ]);
        counter++;
      } catch (err) {
        console.error(`Error inserting reading ${reading.id}:`, err);
      }
    }
    
    // Update the sequence
    await newClient.query(`
      SELECT setval('readings_id_seq', (SELECT MAX(id) FROM readings), true)
    `);
    
    newClient.release();
    console.log(`Migrated ${counter} of ${readings.length} readings`);
  } catch (error) {
    console.error('Error migrating readings:', error);
  }
}

async function migrateProducts() {
  try {
    console.log('Migrating products...');
    
    // Get all products from old database
    const oldClient = await oldPool.connect();
    let products = [];
    try {
      const result = await oldClient.query('SELECT * FROM products');
      products = result.rows;
    } catch (err) {
      console.log('Error fetching products:', err.message);
    }
    oldClient.release();
    
    if (products.length === 0) {
      console.log('No products found in old database.');
      return;
    }
    
    // Insert products into new database
    const newClient = await newPool.connect();
    
    // First, clear the table in the new database
    await newClient.query('TRUNCATE products CASCADE');
    
    // Then insert all products
    let counter = 0;
    for (const product of products) {
      const query = `
        INSERT INTO products (
          id, name, description, price, image_url, category, stock, featured,
          stripe_product_id, stripe_price_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          price = EXCLUDED.price,
          image_url = EXCLUDED.image_url,
          category = EXCLUDED.category,
          stock = EXCLUDED.stock,
          featured = EXCLUDED.featured,
          stripe_product_id = EXCLUDED.stripe_product_id,
          stripe_price_id = EXCLUDED.stripe_price_id,
          created_at = EXCLUDED.created_at
      `;
      
      try {
        await newClient.query(query, [
          product.id, product.name, product.description, product.price, product.image_url,
          product.category, product.stock, product.featured, product.stripe_product_id,
          product.stripe_price_id, product.created_at
        ]);
        counter++;
      } catch (err) {
        console.error(`Error inserting product ${product.id}:`, err);
      }
    }
    
    // Update the sequence
    await newClient.query(`
      SELECT setval('products_id_seq', (SELECT MAX(id) FROM products), true)
    `);
    
    newClient.release();
    console.log(`Migrated ${counter} of ${products.length} products`);
  } catch (error) {
    console.error('Error migrating products:', error);
  }
}

async function migrateOrders() {
  try {
    console.log('Migrating orders...');
    
    // Get all orders from old database
    const oldClient = await oldPool.connect();
    let orders = [];
    try {
      const result = await oldClient.query('SELECT * FROM orders');
      orders = result.rows;
    } catch (err) {
      console.log('Error fetching orders:', err.message);
    }
    oldClient.release();
    
    if (orders.length === 0) {
      console.log('No orders found in old database.');
      return;
    }
    
    // Insert orders into new database
    const newClient = await newPool.connect();
    
    // First, clear the table in the new database
    await newClient.query('TRUNCATE orders CASCADE');
    
    // Then insert all orders
    let counter = 0;
    for (const order of orders) {
      const query = `
        INSERT INTO orders (
          id, user_id, status, total, shipping_address, payment_status,
          stripe_payment_intent_id, stripe_session_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          status = EXCLUDED.status,
          total = EXCLUDED.total,
          shipping_address = EXCLUDED.shipping_address,
          payment_status = EXCLUDED.payment_status,
          stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id,
          stripe_session_id = EXCLUDED.stripe_session_id,
          created_at = EXCLUDED.created_at
      `;
      
      try {
        await newClient.query(query, [
          order.id, order.user_id, order.status, order.total, order.shipping_address,
          order.payment_status, order.stripe_payment_intent_id, order.stripe_session_id,
          order.created_at
        ]);
        counter++;
      } catch (err) {
        console.error(`Error inserting order ${order.id}:`, err);
      }
    }
    
    // Update the sequence
    await newClient.query(`
      SELECT setval('orders_id_seq', (SELECT MAX(id) FROM orders), true)
    `);
    
    newClient.release();
    console.log(`Migrated ${counter} of ${orders.length} orders`);
  } catch (error) {
    console.error('Error migrating orders:', error);
  }
}

async function migrateOrderItems() {
  try {
    console.log('Migrating order items...');
    
    // Get all order items from old database
    const oldClient = await oldPool.connect();
    let orderItems = [];
    try {
      const result = await oldClient.query('SELECT * FROM order_items');
      orderItems = result.rows;
    } catch (err) {
      console.log('Error fetching order items:', err.message);
    }
    oldClient.release();
    
    if (orderItems.length === 0) {
      console.log('No order items found in old database.');
      return;
    }
    
    // Insert order items into new database
    const newClient = await newPool.connect();
    
    // First, clear the table in the new database
    await newClient.query('TRUNCATE order_items CASCADE');
    
    // Then insert all order items
    let counter = 0;
    for (const item of orderItems) {
      const query = `
        INSERT INTO order_items (
          id, order_id, product_id, quantity, price
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          order_id = EXCLUDED.order_id,
          product_id = EXCLUDED.product_id,
          quantity = EXCLUDED.quantity,
          price = EXCLUDED.price
      `;
      
      try {
        await newClient.query(query, [
          item.id, item.order_id, item.product_id, item.quantity, item.price
        ]);
        counter++;
      } catch (err) {
        console.error(`Error inserting order item ${item.id}:`, err);
      }
    }
    
    // Update the sequence
    await newClient.query(`
      SELECT setval('order_items_id_seq', (SELECT MAX(id) FROM order_items), true)
    `);
    
    newClient.release();
    console.log(`Migrated ${counter} of ${orderItems.length} order items`);
  } catch (error) {
    console.error('Error migrating order items:', error);
  }
}

async function migrateLivestreams() {
  try {
    console.log('Migrating livestreams...');
    
    // Get all livestreams from old database
    const oldClient = await oldPool.connect();
    let livestreams = [];
    try {
      const result = await oldClient.query('SELECT * FROM livestreams');
      livestreams = result.rows;
    } catch (err) {
      console.log('Error fetching livestreams:', err.message);
    }
    oldClient.release();
    
    if (livestreams.length === 0) {
      console.log('No livestreams found in old database.');
      return;
    }
    
    // Insert livestreams into new database
    const newClient = await newPool.connect();
    
    // First, clear the table in the new database
    await newClient.query('TRUNCATE livestreams CASCADE');
    
    // Then insert all livestreams
    let counter = 0;
    for (const stream of livestreams) {
      const query = `
        INSERT INTO livestreams (
          id, user_id, title, description, thumbnail_url, status, scheduled_for,
          started_at, ended_at, category, viewer_count, created_at, room_id,
          recording_url, livekit_room_name, duration
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          thumbnail_url = EXCLUDED.thumbnail_url,
          status = EXCLUDED.status,
          scheduled_for = EXCLUDED.scheduled_for,
          started_at = EXCLUDED.started_at,
          ended_at = EXCLUDED.ended_at,
          category = EXCLUDED.category,
          viewer_count = EXCLUDED.viewer_count,
          created_at = EXCLUDED.created_at,
          room_id = EXCLUDED.room_id,
          recording_url = EXCLUDED.recording_url,
          livekit_room_name = EXCLUDED.livekit_room_name,
          duration = EXCLUDED.duration
      `;
      
      try {
        await newClient.query(query, [
          stream.id, stream.user_id, stream.title, stream.description, stream.thumbnail_url,
          stream.status, stream.scheduled_for, stream.started_at, stream.ended_at,
          stream.category, stream.viewer_count, stream.created_at, stream.room_id,
          stream.recording_url, stream.livekit_room_name, stream.duration
        ]);
        counter++;
      } catch (err) {
        console.error(`Error inserting livestream ${stream.id}:`, err);
      }
    }
    
    // Update the sequence
    await newClient.query(`
      SELECT setval('livestreams_id_seq', (SELECT MAX(id) FROM livestreams), true)
    `);
    
    newClient.release();
    console.log(`Migrated ${counter} of ${livestreams.length} livestreams`);
  } catch (error) {
    console.error('Error migrating livestreams:', error);
  }
}

async function migrateForumPosts() {
  try {
    console.log('Migrating forum posts...');
    
    // Get all forum posts from old database
    const oldClient = await oldPool.connect();
    let posts = [];
    try {
      const result = await oldClient.query('SELECT * FROM forum_posts');
      posts = result.rows;
    } catch (err) {
      console.log('Error fetching forum posts:', err.message);
    }
    oldClient.release();
    
    if (posts.length === 0) {
      console.log('No forum posts found in old database.');
      return;
    }
    
    // Insert forum posts into new database
    const newClient = await newPool.connect();
    
    // First, clear the table in the new database
    await newClient.query('TRUNCATE forum_posts CASCADE');
    
    // Then insert all forum posts
    let counter = 0;
    for (const post of posts) {
      const query = `
        INSERT INTO forum_posts (
          id, user_id, title, content, category, likes, views, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          category = EXCLUDED.category,
          likes = EXCLUDED.likes,
          views = EXCLUDED.views,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
      `;
      
      try {
        await newClient.query(query, [
          post.id, post.user_id, post.title, post.content, post.category,
          post.likes, post.views, post.created_at, post.updated_at
        ]);
        counter++;
      } catch (err) {
        console.error(`Error inserting forum post ${post.id}:`, err);
      }
    }
    
    // Update the sequence
    await newClient.query(`
      SELECT setval('forum_posts_id_seq', (SELECT MAX(id) FROM forum_posts), true)
    `);
    
    newClient.release();
    console.log(`Migrated ${counter} of ${posts.length} forum posts`);
  } catch (error) {
    console.error('Error migrating forum posts:', error);
  }
}

async function migrateForumComments() {
  try {
    console.log('Migrating forum comments...');
    
    // Get all forum comments from old database
    const oldClient = await oldPool.connect();
    let comments = [];
    try {
      const result = await oldClient.query('SELECT * FROM forum_comments');
      comments = result.rows;
    } catch (err) {
      console.log('Error fetching forum comments:', err.message);
    }
    oldClient.release();
    
    if (comments.length === 0) {
      console.log('No forum comments found in old database.');
      return;
    }
    
    // Insert forum comments into new database
    const newClient = await newPool.connect();
    
    // First, clear the table in the new database
    await newClient.query('TRUNCATE forum_comments CASCADE');
    
    // Then insert all forum comments
    let counter = 0;
    for (const comment of comments) {
      const query = `
        INSERT INTO forum_comments (
          id, user_id, post_id, content, likes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          post_id = EXCLUDED.post_id,
          content = EXCLUDED.content,
          likes = EXCLUDED.likes,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
      `;
      
      try {
        await newClient.query(query, [
          comment.id, comment.user_id, comment.post_id, comment.content,
          comment.likes, comment.created_at, comment.updated_at
        ]);
        counter++;
      } catch (err) {
        console.error(`Error inserting forum comment ${comment.id}:`, err);
      }
    }
    
    // Update the sequence
    await newClient.query(`
      SELECT setval('forum_comments_id_seq', (SELECT MAX(id) FROM forum_comments), true)
    `);
    
    newClient.release();
    console.log(`Migrated ${counter} of ${comments.length} forum comments`);
  } catch (error) {
    console.error('Error migrating forum comments:', error);
  }
}

async function migrateGifts() {
  try {
    console.log('Migrating gifts...');
    
    // Get all gifts from old database
    const oldClient = await oldPool.connect();
    let gifts = [];
    try {
      const result = await oldClient.query('SELECT * FROM gifts');
      gifts = result.rows;
    } catch (err) {
      console.log('Error fetching gifts:', err.message);
    }
    oldClient.release();
    
    if (gifts.length === 0) {
      console.log('No gifts found in old database.');
      return;
    }
    
    // Insert gifts into new database
    const newClient = await newPool.connect();
    
    // First, clear the table in the new database
    await newClient.query('TRUNCATE gifts CASCADE');
    
    // Then insert all gifts
    let counter = 0;
    for (const gift of gifts) {
      const query = `
        INSERT INTO gifts (
          id, sender_id, recipient_id, livestream_id, amount, gift_type, message,
          created_at, reader_amount, platform_amount, processed, processed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          sender_id = EXCLUDED.sender_id,
          recipient_id = EXCLUDED.recipient_id,
          livestream_id = EXCLUDED.livestream_id,
          amount = EXCLUDED.amount,
          gift_type = EXCLUDED.gift_type,
          message = EXCLUDED.message,
          created_at = EXCLUDED.created_at,
          reader_amount = EXCLUDED.reader_amount,
          platform_amount = EXCLUDED.platform_amount,
          processed = EXCLUDED.processed,
          processed_at = EXCLUDED.processed_at
      `;
      
      try {
        await newClient.query(query, [
          gift.id, gift.sender_id, gift.recipient_id, gift.livestream_id, gift.amount,
          gift.gift_type, gift.message, gift.created_at, gift.reader_amount,
          gift.platform_amount, gift.processed, gift.processed_at
        ]);
        counter++;
      } catch (err) {
        console.error(`Error inserting gift ${gift.id}:`, err);
      }
    }
    
    // Update the sequence
    await newClient.query(`
      SELECT setval('gifts_id_seq', (SELECT MAX(id) FROM gifts), true)
    `);
    
    newClient.release();
    console.log(`Migrated ${counter} of ${gifts.length} gifts`);
  } catch (error) {
    console.error('Error migrating gifts:', error);
  }
}

async function migrateSessionLogs() {
  try {
    console.log('Migrating session logs...');
    
    // Get all session logs from old database
    const oldClient = await oldPool.connect();
    let sessionLogs = [];
    try {
      const result = await oldClient.query('SELECT * FROM session_logs');
      sessionLogs = result.rows;
    } catch (err) {
      console.log('session_logs table may not exist in old database:', err.message);
    }
    oldClient.release();
    
    if (sessionLogs.length === 0) {
      console.log('No session logs found in old database.');
      return;
    }
    
    // Insert session logs into new database
    const newClient = await newPool.connect();
    
    // First, clear the table in the new database
    await newClient.query('TRUNCATE session_logs CASCADE');
    
    // Then insert all session logs
    let counter = 0;
    for (const log of sessionLogs) {
      const query = `
        INSERT INTO session_logs (
          id, room_id, reader_id, client_id, session_type, start_time, end_time,
          duration, total_amount, reader_earned, platform_earned, status, end_reason, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          room_id = EXCLUDED.room_id,
          reader_id = EXCLUDED.reader_id,
          client_id = EXCLUDED.client_id,
          session_type = EXCLUDED.session_type,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          duration = EXCLUDED.duration,
          total_amount = EXCLUDED.total_amount,
          reader_earned = EXCLUDED.reader_earned,
          platform_earned = EXCLUDED.platform_earned,
          status = EXCLUDED.status,
          end_reason = EXCLUDED.end_reason,
          created_at = EXCLUDED.created_at
      `;
      
      try {
        await newClient.query(query, [
          log.id, log.room_id, log.reader_id, log.client_id, log.session_type,
          log.start_time, log.end_time, log.duration, log.total_amount, log.reader_earned,
          log.platform_earned, log.status, log.end_reason, log.created_at
        ]);
        counter++;
      } catch (err) {
        console.error(`Error inserting session log ${log.id}:`, err);
      }
    }
    
    // Update the sequence
    await newClient.query(`
      SELECT setval('session_logs_id_seq', (SELECT COALESCE(MAX(id), 0) FROM session_logs), true)
    `);
    
    newClient.release();
    console.log(`Migrated ${counter} of ${sessionLogs.length} session logs`);
  } catch (error) {
    console.error('Error migrating session logs:', error);
  }
}

async function migrateGiftLogs() {
  try {
    console.log('Migrating gift logs...');
    
    // Get all gift logs from old database
    const oldClient = await oldPool.connect();
    let giftLogs = [];
    try {
      const result = await oldClient.query('SELECT * FROM gift_logs');
      giftLogs = result.rows;
    } catch (err) {
      console.log('gift_logs table may not exist in old database:', err.message);
    }
    oldClient.release();
    
    if (giftLogs.length === 0) {
      console.log('No gift logs found in old database.');
      return;
    }
    
    // Insert gift logs into new database
    const newClient = await newPool.connect();
    
    // First, clear the table in the new database
    await newClient.query('TRUNCATE gift_logs CASCADE');
    
    // Then insert all gift logs
    let counter = 0;
    for (const log of giftLogs) {
      const query = `
        INSERT INTO gift_logs (
          id, livestream_id, sender_id, receiver_id, gift_type, gift_value,
          receiver_earned, platform_earned, timestamp, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          livestream_id = EXCLUDED.livestream_id,
          sender_id = EXCLUDED.sender_id,
          receiver_id = EXCLUDED.receiver_id,
          gift_type = EXCLUDED.gift_type,
          gift_value = EXCLUDED.gift_value,
          receiver_earned = EXCLUDED.receiver_earned,
          platform_earned = EXCLUDED.platform_earned,
          timestamp = EXCLUDED.timestamp,
          created_at = EXCLUDED.created_at
      `;
      
      try {
        await newClient.query(query, [
          log.id, log.livestream_id, log.sender_id, log.receiver_id, log.gift_type,
          log.gift_value, log.receiver_earned, log.platform_earned, 
          log.timestamp, log.created_at
        ]);
        counter++;
      } catch (err) {
        console.error(`Error inserting gift log ${log.id}:`, err);
      }
    }
    
    // Update the sequence
    await newClient.query(`
      SELECT setval('gift_logs_id_seq', (SELECT COALESCE(MAX(id), 0) FROM gift_logs), true)
    `);
    
    newClient.release();
    console.log(`Migrated ${counter} of ${giftLogs.length} gift logs`);
  } catch (error) {
    console.error('Error migrating gift logs:', error);
  }
}

// Start the migration
migrateData();