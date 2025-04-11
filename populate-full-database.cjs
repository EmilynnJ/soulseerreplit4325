require('dotenv').config();

const { Pool } = require('pg');
const crypto = require('crypto');

// Connect to new database
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    // Generate a salt
    crypto.randomBytes(16, (err, salt) => {
      if (err) return reject(err);
      
      // Hash the password with the salt
      crypto.pbkdf2(password, salt, 1000, 64, 'sha512', (err, derivedKey) => {
        if (err) return reject(err);
        
        // Store the salt with the hashed password
        resolve(salt.toString('hex') + ':' + derivedKey.toString('hex'));
      });
    });
  });
}

// Generate a random date within the past month
function randomRecentDate() {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 30); // 0-30 days ago
  now.setDate(now.getDate() - daysAgo);
  return now;
}

async function populateDatabase() {
  console.log('Starting comprehensive database population...');
  
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    // 1. Create users with various roles
    console.log('Creating users...');
    
    // Admin user
    const adminPassword = await hashPassword('admin123');
    await client.query(`
      INSERT INTO users (
        username, password, email, full_name, role, verified, created_at
      ) VALUES (
        'admin', $1, 'admin@soulseer.com', 'Administrator', 'admin', true, NOW()
      ) ON CONFLICT (username) DO UPDATE SET
        password = EXCLUDED.password,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        verified = true
    `, [adminPassword]);
    console.log('- Admin user created');

    // Readers
    const readerNames = [
      { username: 'mysticreader', name: 'Mystic Reader', bio: 'Expert tarot reader with 10 years of experience in spiritual guidance.', specialties: ['Tarot', 'Clairvoyance', 'Love Readings'], rate: 5.99 },
      { username: 'celestial_guide', name: 'Celestial Guide', bio: 'Astrologist and spiritual counselor offering insights into your future.', specialties: ['Astrology', 'Numerology', 'Career Guidance'], rate: 6.99 },
      { username: 'crystal_seer', name: 'Crystal Seer', bio: 'Crystal healer and intuitive empath connecting you with your higher self.', specialties: ['Crystal Healing', 'Chakra Alignment', 'Past Life'], rate: 4.99 }
    ];
    
    for (const reader of readerNames) {
      const readerPassword = await hashPassword('reader123');
      await client.query(`
        INSERT INTO users (
          username, password, email, full_name, role, bio, specialties, verified,
          rate_per_minute, created_at, profile_image, earnings, is_online,
          scheduled_chat_price_15, scheduled_chat_price_30, scheduled_chat_price_60,
          scheduled_voice_price_15, scheduled_voice_price_30, scheduled_voice_price_60,
          scheduled_video_price_15, scheduled_video_price_30, scheduled_video_price_60
        ) VALUES (
          $1, $2, $3, $4, 'reader', $5, $6, true,
          $7, NOW(), '/images/readers/default-reader.svg', 0, true,
          1500, 2500, 4500,
          2000, 3500, 6500,
          2500, 4500, 8500
        ) ON CONFLICT (username) DO UPDATE SET
          password = EXCLUDED.password,
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          bio = EXCLUDED.bio,
          specialties = EXCLUDED.specialties,
          role = 'reader',
          verified = true,
          is_online = true,
          rate_per_minute = EXCLUDED.rate_per_minute,
          scheduled_chat_price_15 = EXCLUDED.scheduled_chat_price_15,
          scheduled_chat_price_30 = EXCLUDED.scheduled_chat_price_30,
          scheduled_chat_price_60 = EXCLUDED.scheduled_chat_price_60,
          scheduled_voice_price_15 = EXCLUDED.scheduled_voice_price_15,
          scheduled_voice_price_30 = EXCLUDED.scheduled_voice_price_30,
          scheduled_voice_price_60 = EXCLUDED.scheduled_voice_price_60,
          scheduled_video_price_15 = EXCLUDED.scheduled_video_price_15,
          scheduled_video_price_30 = EXCLUDED.scheduled_video_price_30,
          scheduled_video_price_60 = EXCLUDED.scheduled_video_price_60
      `, [
        reader.username, 
        readerPassword, 
        `${reader.username}@soulseer.com`, 
        reader.name, 
        reader.bio, 
        reader.specialties, 
        reader.rate
      ]);
    }
    console.log('- Reader users created');
    
    // Clients
    const clientNames = [
      { username: 'client1', name: 'Sample Client' },
      { username: 'seekergirl', name: 'Seeker Soul' },
      { username: 'spiritual_journey', name: 'Journey Walker' }
    ];
    
    for (const client of clientNames) {
      const clientPassword = await hashPassword('client123');
      await client.query(`
        INSERT INTO users (
          username, password, email, full_name, role, created_at, balance
        ) VALUES (
          $1, $2, $3, $4, 'client', NOW(), 50.00
        ) ON CONFLICT (username) DO UPDATE SET
          password = EXCLUDED.password,
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          role = 'client',
          balance = 50.00
      `, [
        client.username, 
        clientPassword, 
        `${client.username}@email.com`, 
        client.name
      ]);
    }
    console.log('- Client users created');
    
    // 2. Create products for the shop
    console.log('Creating shop products...');
    
    const products = [
      {
        name: 'Crystal Healing Set',
        description: 'A set of 5 healing crystals including Amethyst, Rose Quartz, Clear Quartz, Black Tourmaline, and Citrine.',
        price: 2999,
        category: 'crystals',
        stock: 10,
        featured: true
      },
      {
        name: 'Tarot Deck - Mystic Symbolism',
        description: 'Beautiful 78-card tarot deck with guidebook for spiritual readings and self-discovery.',
        price: 3499,
        category: 'tarot',
        stock: 15,
        featured: true
      },
      {
        name: 'Meditation Cushion Set',
        description: 'Ergonomic meditation cushion with matching mat, designed for comfort during long meditation sessions.',
        price: 4999,
        category: 'meditation',
        stock: 8,
        featured: false
      },
      {
        name: 'Essential Oil Diffuser',
        description: 'Handcrafted ceramic essential oil diffuser with LED light and 3 aromatherapy oils included.',
        price: 3999,
        category: 'aromatherapy',
        stock: 12,
        featured: true
      },
      {
        name: 'Pendulum Kit',
        description: 'Handcrafted pendulum with instruction guide for divination and decision making.',
        price: 1999,
        category: 'divination',
        stock: 20,
        featured: false
      }
    ];
    
    for (const product of products) {
      await client.query(`
        INSERT INTO products (
          name, description, price, image_url, category, stock, featured, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, NOW()
        ) ON CONFLICT DO NOTHING
      `, [
        product.name,
        product.description,
        product.price,
        `/images/products/${product.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.jpg`,
        product.category,
        product.stock,
        product.featured
      ]);
    }
    console.log('- Products created');
    
    // 3. Create sample orders
    console.log('Creating sample orders...');
    
    const orders = [
      {
        userId: 4, // assuming client1 is id 4
        status: 'delivered',
        total: 7498,
        shippingAddress: { name: 'Sample Client', address: '123 Main St', city: 'Soulville', state: 'CA', zip: '90210', country: 'US' },
        paymentStatus: 'paid',
        items: [
          { productId: 1, quantity: 1, price: 2999 },
          { productId: 2, quantity: 1, price: 3499 },
          { productId: 5, quantity: 1, price: 1000 } // some discount applied
        ]
      },
      {
        userId: 5, // assuming seekergirl is id 5
        status: 'processing',
        total: 4999,
        shippingAddress: { name: 'Seeker Soul', address: '456 Spiritual Ave', city: 'Mystical City', state: 'NY', zip: '10001', country: 'US' },
        paymentStatus: 'paid',
        items: [
          { productId: 3, quantity: 1, price: 4999 }
        ]
      }
    ];
    
    for (const order of orders) {
      // Insert order
      const orderResult = await client.query(`
        INSERT INTO orders (
          user_id, status, total, shipping_address, payment_status, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, NOW()
        ) RETURNING id
      `, [
        order.userId,
        order.status,
        order.total,
        JSON.stringify(order.shippingAddress),
        order.paymentStatus
      ]);
      
      const orderId = orderResult.rows[0].id;
      
      // Insert order items
      for (const item of order.items) {
        await client.query(`
          INSERT INTO order_items (
            order_id, product_id, quantity, price
          ) VALUES (
            $1, $2, $3, $4
          )
        `, [
          orderId,
          item.productId,
          item.quantity,
          item.price
        ]);
      }
    }
    console.log('- Orders created');
    
    // 4. Create forum posts and comments
    console.log('Creating forum content...');
    
    const forumPosts = [
      {
        userId: 4, // client1
        title: 'My First Tarot Reading Experience',
        content: 'I recently had my first tarot reading and wanted to share my experience. The reader was incredibly insightful and helped me understand some challenges I've been facing. Has anyone else had a transformative first reading?',
        category: 'experiences',
        likes: 12,
        views: 45
      },
      {
        userId: 2, // mysticreader
        title: 'Understanding the Major Arcana',
        content: 'The Major Arcana cards in a tarot deck represent significant life events and spiritual lessons. In this post, I want to explain some key interpretations and how they might appear in your readings.',
        category: 'education',
        likes: 28,
        views: 103
      },
      {
        userId: 5, // seekergirl
        title: 'Meditation Techniques for Beginners',
        content: 'If you're new to meditation, it can be overwhelming to know where to start. Here are some simple techniques I've found helpful in my spiritual journey.',
        category: 'practices',
        likes: 19,
        views: 87
      }
    ];
    
    for (const post of forumPosts) {
      const postResult = await client.query(`
        INSERT INTO forum_posts (
          user_id, title, content, category, likes, views, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, NOW(), NOW()
        ) RETURNING id
      `, [
        post.userId,
        post.title,
        post.content,
        post.category,
        post.likes,
        post.views
      ]);
      
      const postId = postResult.rows[0].id;
      
      // Add some comments to each post
      const comments = [
        { userId: 3, content: 'Thank you for sharing this valuable information!' },
        { userId: 6, content: 'I had a similar experience and found it life-changing.' },
        { userId: 2, content: 'Great post! I would also add that regular practice makes a huge difference.' }
      ];
      
      for (const comment of comments) {
        await client.query(`
          INSERT INTO forum_comments (
            user_id, post_id, content, likes, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, NOW(), NOW()
          )
        `, [
          comment.userId,
          postId,
          comment.content,
          Math.floor(Math.random() * 10)
        ]);
      }
    }
    console.log('- Forum posts and comments created');
    
    // 5. Create completed readings
    console.log('Creating reading records...');
    
    const completedReadings = [
      {
        readerId: 2, // mysticreader
        clientId: 4, // client1
        type: 'video',
        readingMode: 'on_demand',
        duration: 15,
        price: 5999,
        pricePerMinute: 599,
        totalPrice: 5990,
        status: 'completed',
        paymentStatus: 'paid',
        rating: 5,
        review: 'Excellent reading! Very insightful and helped me gain clarity.'
      },
      {
        readerId: 3, // celestial_guide
        clientId: 5, // seekergirl
        type: 'chat',
        readingMode: 'scheduled',
        scheduledFor: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        duration: 30,
        price: 6990,
        pricePerMinute: 699,
        totalPrice: 13980,
        status: 'completed',
        paymentStatus: 'paid',
        rating: 4,
        review: 'Good insights, though I wish we had more time to explore certain topics.'
      },
      {
        readerId: 4, // crystal_seer
        clientId: 6, // spiritual_journey
        type: 'voice',
        readingMode: 'on_demand',
        duration: 45,
        price: 4990,
        pricePerMinute: 499,
        totalPrice: 17960,
        status: 'completed',
        paymentStatus: 'paid',
        rating: 5,
        review: 'Amazing experience! The reader was spot on with everything.'
      }
    ];
    
    for (const reading of completedReadings) {
      const startedAt = new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
      const completedAt = new Date(startedAt.getTime() + reading.duration * 60 * 1000);
      
      await client.query(`
        INSERT INTO readings (
          reader_id, client_id, status, type, reading_mode, scheduled_for,
          duration, price, price_per_minute, total_price, payment_status,
          rating, review, created_at, started_at, completed_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
      `, [
        reading.readerId,
        reading.clientId,
        reading.status,
        reading.type,
        reading.readingMode,
        reading.scheduledFor || null,
        reading.duration,
        reading.price,
        reading.pricePerMinute,
        reading.totalPrice,
        reading.paymentStatus,
        reading.rating,
        reading.review,
        startedAt,
        startedAt,
        completedAt
      ]);
    }
    
    // Create scheduled readings
    const scheduledReadings = [
      {
        readerId: 2, // mysticreader
        clientId: 5, // seekergirl
        type: 'video',
        readingMode: 'scheduled',
        scheduledFor: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days in future
        duration: 30,
        price: 8500,
        pricePerMinute: 0, // fixed price for scheduled
        totalPrice: 8500,
        status: 'scheduled',
        paymentStatus: 'authorized'
      },
      {
        readerId: 3, // celestial_guide
        clientId: 6, // spiritual_journey
        type: 'chat',
        readingMode: 'scheduled',
        scheduledFor: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days in future
        duration: 15,
        price: 2500,
        pricePerMinute: 0, // fixed price for scheduled
        totalPrice: 2500,
        status: 'scheduled',
        paymentStatus: 'authorized'
      }
    ];
    
    for (const reading of scheduledReadings) {
      const createdAt = new Date(Date.now() - Math.floor(Math.random() * 3) * 24 * 60 * 60 * 1000);
      
      await client.query(`
        INSERT INTO readings (
          reader_id, client_id, status, type, reading_mode, scheduled_for,
          duration, price, price_per_minute, total_price, payment_status,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
      `, [
        reading.readerId,
        reading.clientId,
        reading.status,
        reading.type,
        reading.readingMode,
        reading.scheduledFor,
        reading.duration,
        reading.price,
        reading.pricePerMinute,
        reading.totalPrice,
        reading.paymentStatus,
        createdAt
      ]);
    }
    console.log('- Reading records created');
    
    // 6. Create session logs for pay-per-minute system
    console.log('Creating session logs...');
    
    const sessionLogs = [
      {
        roomId: 'reading_a1b2c3d4',
        readerId: 2, // mysticreader
        clientId: 4, // client1
        sessionType: 'video',
        startTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
        duration: 15,
        totalAmount: 89.85,
        readerEarned: 62.90,
        platformEarned: 26.95,
        status: 'ended',
        endReason: 'completed'
      },
      {
        roomId: 'reading_e5f6g7h8',
        readerId: 3, // celestial_guide
        clientId: 5, // seekergirl
        sessionType: 'chat',
        startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 22 * 60 * 1000),
        duration: 22,
        totalAmount: 153.78,
        readerEarned: 107.65,
        platformEarned: 46.13,
        status: 'ended',
        endReason: 'completed'
      }
    ];
    
    for (const log of sessionLogs) {
      await client.query(`
        INSERT INTO session_logs (
          room_id, reader_id, client_id, session_type, start_time, end_time,
          duration, total_amount, reader_earned, platform_earned, status, end_reason, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
        )
      `, [
        log.roomId,
        log.readerId,
        log.clientId,
        log.sessionType,
        log.startTime,
        log.endTime,
        log.duration,
        log.totalAmount,
        log.readerEarned,
        log.platformEarned,
        log.status,
        log.endReason
      ]);
    }
    console.log('- Session logs created');
    
    // 7. Create livestreams
    console.log('Creating livestream records...');
    
    const pastLivestreams = [
      {
        userId: 2, // mysticreader
        title: 'Weekly Tarot Guidance',
        description: 'Join me for weekly tarot readings and spiritual guidance. I'll be answering questions and providing insights for the collective.',
        status: 'ended',
        category: 'tarot',
        viewerCount: 78,
        duration: 45.5
      },
      {
        userId: 3, // celestial_guide
        title: 'Astrological Insights for April',
        description: 'Let's explore what the stars have in store for April. We'll cover major transits and what they mean for each sign.',
        status: 'ended',
        category: 'astrology',
        viewerCount: 122,
        duration: 62.3
      }
    ];
    
    for (const stream of pastLivestreams) {
      const startedAt = new Date(Date.now() - Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000);
      const endedAt = new Date(startedAt.getTime() + stream.duration * 60 * 1000);
      
      await client.query(`
        INSERT INTO livestreams (
          user_id, title, description, thumbnail_url, status, category,
          viewer_count, started_at, ended_at, created_at, duration, room_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
      `, [
        stream.userId,
        stream.title,
        stream.description,
        '/images/livestreams/default-thumbnail.svg',
        stream.status,
        stream.category,
        stream.viewerCount,
        startedAt,
        endedAt,
        startedAt,
        stream.duration,
        `livestream_${crypto.randomBytes(8).toString('hex')}`
      ]);
    }
    
    // Scheduled livestream
    const scheduledLivestream = {
      userId: 4, // crystal_seer
      title: 'Crystal Healing Demonstration',
      description: 'Learn how to use crystals for healing and balancing your energy. I'll demonstrate techniques and answer your questions.',
      status: 'scheduled',
      scheduledFor: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days in future
      category: 'healing'
    };
    
    await client.query(`
      INSERT INTO livestreams (
        user_id, title, description, thumbnail_url, status, scheduled_for,
        category, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, NOW()
      )
    `, [
      scheduledLivestream.userId,
      scheduledLivestream.title,
      scheduledLivestream.description,
      '/images/livestreams/default-thumbnail.svg',
      scheduledLivestream.status,
      scheduledLivestream.scheduledFor,
      scheduledLivestream.category
    ]);
    console.log('- Livestream records created');
    
    // 8. Create gifts for livestreams
    console.log('Creating gift records...');
    
    // Get past livestream IDs
    const livestreamResult = await client.query(`
      SELECT id FROM livestreams WHERE status = 'ended' LIMIT 2
    `);
    
    if (livestreamResult.rows.length > 0) {
      const gifts = [
        {
          senderId: 4, // client1
          recipientId: 2, // mysticreader (assuming owner of first livestream)
          livestreamId: livestreamResult.rows[0].id,
          amount: 1000, // $10
          giftType: 'heart',
          message: 'Thank you for the amazing insights!',
          readerAmount: 700, // 70%
          platformAmount: 300 // 30%
        },
        {
          senderId: 5, // seekergirl
          recipientId: 3, // celestial_guide (assuming owner of second livestream)
          livestreamId: livestreamResult.rows[1].id,
          amount: 5000, // $50
          giftType: 'diamond',
          message: 'Your reading changed my perspective completely!',
          readerAmount: 3500, // 70%
          platformAmount: 1500 // 30%
        },
        {
          senderId: 6, // spiritual_journey
          recipientId: 2, // mysticreader
          livestreamId: livestreamResult.rows[0].id,
          amount: 2000, // $20
          giftType: 'star',
          message: 'Loving your energy!',
          readerAmount: 1400, // 70%
          platformAmount: 600 // 30%
        }
      ];
      
      for (const gift of gifts) {
        await client.query(`
          INSERT INTO gifts (
            sender_id, recipient_id, livestream_id, amount, gift_type, message,
            reader_amount, platform_amount, processed, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, true, NOW()
          )
        `, [
          gift.senderId,
          gift.recipientId,
          gift.livestreamId,
          gift.amount,
          gift.giftType,
          gift.message,
          gift.readerAmount,
          gift.platformAmount
        ]);
        
        // Also add to gift_logs
        await client.query(`
          INSERT INTO gift_logs (
            livestream_id, sender_id, receiver_id, gift_type, gift_value,
            receiver_earned, platform_earned, timestamp, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
          )
        `, [
          gift.livestreamId,
          gift.senderId,
          gift.recipientId,
          gift.giftType,
          gift.amount / 100, // convert to dollars
          gift.readerAmount / 100, // convert to dollars
          gift.platformAmount / 100 // convert to dollars
        ]);
      }
      console.log('- Gift records created');
    }
    
    // 9. Add reader earnings (update from gifts and sessions)
    console.log('Updating reader earnings...');
    
    // Get sum of reader earnings from gifts
    const giftEarningsResult = await client.query(`
      SELECT recipient_id, SUM(reader_amount) as total_earnings
      FROM gifts
      GROUP BY recipient_id
    `);
    
    // Get sum of reader earnings from session logs
    const sessionEarningsResult = await client.query(`
      SELECT reader_id, SUM(reader_earned) as total_earnings
      FROM session_logs
      GROUP BY reader_id
    `);
    
    // Update reader earnings
    for (const row of giftEarningsResult.rows) {
      await client.query(`
        UPDATE users
        SET earnings = earnings + $1
        WHERE id = $2
      `, [
        parseFloat(row.total_earnings) / 100, // convert to dollars
        row.recipient_id
      ]);
    }
    
    for (const row of sessionEarningsResult.rows) {
      await client.query(`
        UPDATE users
        SET earnings = earnings + $1
        WHERE id = $2
      `, [
        parseFloat(row.total_earnings), // already in dollars
        row.reader_id
      ]);
    }
    console.log('- Reader earnings updated');
    
    // 10. Add a few direct messages between users
    console.log('Creating direct messages...');
    
    const directMessages = [
      {
        senderId: 4, // client1
        receiverId: 2, // mysticreader
        content: 'Hello, I really enjoyed our reading session. I was wondering if you have availability next week?',
        isPaid: false,
        readAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        senderId: 2, // mysticreader
        receiverId: 4, // client1
        content: 'Thank you for reaching out! I do have availability next Tuesday afternoon or Thursday morning. Would either of those work for you?',
        isPaid: false,
        readAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        senderId: 5, // seekergirl
        receiverId: 3, // celestial_guide
        content: 'I have some questions about my reading. Could you clarify what you meant about the career transition?',
        isPaid: false,
        readAt: null // unread
      }
    ];
    
    for (const message of directMessages) {
      await client.query(`
        INSERT INTO messages (
          sender_id, receiver_id, content, is_paid, read_at, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, NOW()
        )
      `, [
        message.senderId,
        message.receiverId,
        message.content,
        message.isPaid,
        message.readAt
      ]);
    }
    console.log('- Direct messages created');
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('Database population completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error populating database:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

populateDatabase();