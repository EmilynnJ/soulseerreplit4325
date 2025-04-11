require('dotenv').config();

const { Pool } = require('pg');
const crypto = require('crypto');

// Connect to database
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

async function populateDatabase() {
  console.log('Starting database population...');
  
  try {
    // 1. Create users with various roles
    console.log('Creating users...');
    
    // Admin user
    const adminPassword = await hashPassword('admin123');
    await pool.query(`
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

    // Reader user
    const readerPassword = await hashPassword('reader123');
    await pool.query(`
      INSERT INTO users (
        username, password, email, full_name, role, bio, specialties, verified,
        rate_per_minute, created_at, profile_image, earnings, is_online,
        scheduled_chat_price_15, scheduled_chat_price_30, scheduled_chat_price_60,
        scheduled_voice_price_15, scheduled_voice_price_30, scheduled_voice_price_60,
        scheduled_video_price_15, scheduled_video_price_30, scheduled_video_price_60
      ) VALUES (
        'mysticreader', $1, 'mysticreader@soulseer.com', 'Mystic Reader', 'reader',
        'Expert tarot reader with 10 years of experience in spiritual guidance.',
        ARRAY['Tarot', 'Clairvoyance', 'Love Readings'], true,
        5.99, NOW(), '/images/readers/default-reader.svg', 0, true,
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
        rate_per_minute = 5.99
    `, [readerPassword]);
    console.log('- Reader user created');
    
    // Client user
    const clientPassword = await hashPassword('client123');
    await pool.query(`
      INSERT INTO users (
        username, password, email, full_name, role, created_at, balance
      ) VALUES (
        'client1', $1, 'client1@email.com', 'Sample Client', 'client', NOW(), 50.00
      ) ON CONFLICT (username) DO UPDATE SET
        password = EXCLUDED.password,
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = 'client',
        balance = 50.00
    `, [clientPassword]);
    console.log('- Client user created');
    
    // 2. Create products for the shop
    console.log('Creating shop products...');
    
    await pool.query(`
      INSERT INTO products (
        name, description, price, image_url, category, stock, featured, created_at
      ) VALUES (
        'Crystal Healing Set', 
        'A set of 5 healing crystals including Amethyst, Rose Quartz, Clear Quartz, Black Tourmaline, and Citrine.',
        2999, 
        '/images/products/crystal-healing-set.jpg',
        'crystals',
        10,
        true,
        NOW()
      ) ON CONFLICT DO NOTHING
    `);
    console.log('- Sample product created');

    // 3. Create session logs for pay-per-minute system
    console.log('Creating session logs...');
    
    const sessionLog = {
      roomId: 'reading_a1b2c3d4',
      readerId: 44, // mysticreader (ID from database)
      clientId: 38, // client1 (ID from database)
      sessionType: 'video',
      startTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
      duration: 15,
      totalAmount: 89.85,
      readerEarned: 62.90,
      platformEarned: 26.95,
      status: 'ended',
      endReason: 'completed'
    };
    
    try {
      await pool.query(`
        INSERT INTO session_logs (
          room_id, reader_id, client_id, session_type, start_time, end_time,
          duration, total_amount, reader_earned, platform_earned, status, end_reason, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
        )
      `, [
        sessionLog.roomId,
        sessionLog.readerId,
        sessionLog.clientId,
        sessionLog.sessionType,
        sessionLog.startTime,
        sessionLog.endTime,
        sessionLog.duration,
        sessionLog.totalAmount,
        sessionLog.readerEarned,
        sessionLog.platformEarned,
        sessionLog.status,
        sessionLog.endReason
      ]);
      console.log('- Session log created');
    } catch (e) {
      console.log('- Failed to create session log:', e.message);
      // Create the session_logs table if it doesn't exist
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS session_logs (
            id SERIAL PRIMARY KEY,
            room_id TEXT NOT NULL,
            reader_id INTEGER NOT NULL,
            client_id INTEGER NOT NULL,
            session_type TEXT NOT NULL,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP,
            duration INTEGER,
            total_amount NUMERIC(10,2),
            reader_earned NUMERIC(10,2),
            platform_earned NUMERIC(10,2),
            status TEXT NOT NULL,
            end_reason TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            FOREIGN KEY (reader_id) REFERENCES users(id),
            FOREIGN KEY (client_id) REFERENCES users(id)
          );
        `);
        console.log('- Created session_logs table');
        
        await pool.query(`
          INSERT INTO session_logs (
            room_id, reader_id, client_id, session_type, start_time, end_time,
            duration, total_amount, reader_earned, platform_earned, status, end_reason, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
          )
        `, [
          sessionLog.roomId,
          sessionLog.readerId,
          sessionLog.clientId,
          sessionLog.sessionType,
          sessionLog.startTime,
          sessionLog.endTime,
          sessionLog.duration,
          sessionLog.totalAmount,
          sessionLog.readerEarned,
          sessionLog.platformEarned,
          sessionLog.status,
          sessionLog.endReason
        ]);
        console.log('- Session log created after table creation');
      } catch (tableError) {
        console.log('- Failed to create session_logs table:', tableError.message);
      }
    }
    
    // 4. Create a livestream
    console.log('Creating livestream record...');
    
    try {
      await pool.query(`
        INSERT INTO livestreams (
          user_id, title, description, thumbnail_url, status, category,
          viewer_count, created_at, room_id
        ) VALUES (
          44, 'Weekly Tarot Guidance', 
          'Join me for weekly tarot readings and spiritual guidance.',
          '/images/livestreams/default-thumbnail.svg',
          'scheduled',
          'tarot',
          0,
          NOW(),
          $1
        )
      `, [`livestream_${crypto.randomBytes(8).toString('hex')}`]);
      console.log('- Livestream record created');
    } catch (e) {
      console.log('- Failed to create livestream:', e.message);
      
      // Create the livestreams table if it doesn't exist
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS livestreams (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            thumbnail_url TEXT,
            status TEXT NOT NULL,
            category TEXT,
            viewer_count INTEGER DEFAULT 0,
            scheduled_for TIMESTAMP,
            started_at TIMESTAMP,
            ended_at TIMESTAMP,
            duration NUMERIC(10,2),
            room_id TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            FOREIGN KEY (user_id) REFERENCES users(id)
          );
        `);
        console.log('- Created livestreams table');
        
        await pool.query(`
          INSERT INTO livestreams (
            user_id, title, description, thumbnail_url, status, category,
            viewer_count, created_at, room_id
          ) VALUES (
            44, 'Weekly Tarot Guidance', 
            'Join me for weekly tarot readings and spiritual guidance.',
            '/images/livestreams/default-thumbnail.svg',
            'scheduled',
            'tarot',
            0,
            NOW(),
            $1
          )
        `, [`livestream_${crypto.randomBytes(8).toString('hex')}`]);
        console.log('- Livestream record created after table creation');
      } catch (tableError) {
        console.log('- Failed to create livestreams table:', tableError.message);
      }
    }

    // 5. Create gifts table and sample gift
    console.log('Creating gift record...');
    
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gifts (
          id SERIAL PRIMARY KEY,
          sender_id INTEGER NOT NULL,
          recipient_id INTEGER NOT NULL,
          livestream_id INTEGER,
          amount INTEGER NOT NULL,
          gift_type TEXT NOT NULL,
          message TEXT,
          reader_amount INTEGER NOT NULL,
          platform_amount INTEGER NOT NULL,
          processed BOOLEAN DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          FOREIGN KEY (sender_id) REFERENCES users(id),
          FOREIGN KEY (recipient_id) REFERENCES users(id),
          FOREIGN KEY (livestream_id) REFERENCES livestreams(id)
        );
      `);
      console.log('- Gifts table created or verified');
      
      // Get a livestream id
      const livestreamResult = await pool.query(`
        SELECT id FROM livestreams LIMIT 1
      `);
      
      if (livestreamResult.rows.length > 0) {
        await pool.query(`
          INSERT INTO gifts (
            sender_id, recipient_id, livestream_id, amount, gift_type, message,
            reader_amount, platform_amount, processed, created_at
          ) VALUES (
            38, 44, $1, 1000, 'heart', 'Thank you for the amazing insights!',
            700, 300, true, NOW()
          )
        `, [livestreamResult.rows[0].id]);
        console.log('- Gift record created');
      } else {
        console.log('- No livestream found for gift creation');
      }
    } catch (e) {
      console.log('- Gift table/record error:', e.message);
    }
    
    // 6. Create gift_logs table
    console.log('Creating gift logs table...');
    
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS gift_logs (
          id SERIAL PRIMARY KEY,
          livestream_id INTEGER,
          sender_id INTEGER NOT NULL,
          receiver_id INTEGER NOT NULL,
          gift_type TEXT NOT NULL,
          gift_value NUMERIC(10,2) NOT NULL,
          receiver_earned NUMERIC(10,2) NOT NULL,
          platform_earned NUMERIC(10,2) NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          FOREIGN KEY (livestream_id) REFERENCES livestreams(id),
          FOREIGN KEY (sender_id) REFERENCES users(id),
          FOREIGN KEY (receiver_id) REFERENCES users(id)
        );
      `);
      console.log('- Gift logs table created or verified');
    } catch (e) {
      console.log('- Gift logs table error:', e.message);
    }
    
    // 7. Create forum posts table
    console.log('Creating forum tables...');
    
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS forum_posts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          category TEXT NOT NULL,
          likes INTEGER DEFAULT 0,
          views INTEGER DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
        
        CREATE TABLE IF NOT EXISTS forum_comments (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          post_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          likes INTEGER DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (post_id) REFERENCES forum_posts(id)
        );
      `);
      console.log('- Forum tables created or verified');
      
      // Add a sample forum post
      await pool.query(`
        INSERT INTO forum_posts (
          user_id, title, content, category, likes, views, created_at, updated_at
        ) VALUES (
          44, 'Understanding the Major Arcana',
          'The Major Arcana cards in a tarot deck represent significant life events and spiritual lessons.',
          'education',
          28,
          103,
          NOW(), NOW()
        )
      `);
      console.log('- Sample forum post created');
    } catch (e) {
      console.log('- Forum tables/post error:', e.message);
    }
    
    console.log('Database population completed successfully');
  } catch (error) {
    console.error('Error populating database:', error);
  } finally {
    await pool.end();
  }
}

populateDatabase();