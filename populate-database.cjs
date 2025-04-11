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

async function populateDatabase() {
  console.log('Starting database population...');
  
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    // Create admin user
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
    console.log('Admin user created');
    
    // Create a reader
    const readerPassword = await hashPassword('reader123');
    await client.query(`
      INSERT INTO users (
        username, password, email, full_name, role, bio, specialties, verified,
        rate_per_minute, created_at, profile_image
      ) VALUES (
        'psychic1', $1, 'psychic1@soulseer.com', 'Mystic Reader', 'reader',
        'Expert tarot reader with 10 years of experience in spiritual guidance.',
        ARRAY['Tarot', 'Clairvoyance', 'Love Readings'], true, 5.99, NOW(),
        '/images/readers/reader1.jpg'
      ) ON CONFLICT (username) DO UPDATE SET
        password = EXCLUDED.password,
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        bio = EXCLUDED.bio,
        specialties = EXCLUDED.specialties,
        role = EXCLUDED.role,
        verified = true,
        rate_per_minute = EXCLUDED.rate_per_minute
    `, [readerPassword]);
    console.log('Reader user created');
    
    // Create a client
    const clientPassword = await hashPassword('client123');
    await client.query(`
      INSERT INTO users (
        username, password, email, full_name, role, created_at
      ) VALUES (
        'client1', $1, 'client1@email.com', 'Sample Client', 'client', NOW()
      ) ON CONFLICT (username) DO UPDATE SET
        password = EXCLUDED.password,
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role
    `, [clientPassword]);
    console.log('Client user created');
    
    // Create a sample product
    await client.query(`
      INSERT INTO products (
        name, description, price, image_url, category, stock, featured, created_at
      ) VALUES (
        'Crystal Healing Set', 
        'A set of 5 healing crystals including Amethyst, Rose Quartz, Clear Quartz, Black Tourmaline, and Citrine.',
        2999, 
        '/images/products/crystal-set.jpg',
        'crystals',
        10,
        true,
        NOW()
      ) ON CONFLICT DO NOTHING
    `);
    console.log('Sample product created');
    
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