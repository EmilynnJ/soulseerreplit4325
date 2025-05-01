require('dotenv').config({ path: '.env.local' });
const pg = require('pg');
const crypto = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function createUsers() {
  let pool;
  try {
    console.log('Connecting to database...');
    console.log('Database URL:', process.env.DATABASE_URL ? `${process.env.DATABASE_URL.substring(0, 30)}...` : 'not set');
    
    // Connect to the database directly
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    // Test the connection
    console.log('Testing database connection...');
    const testResult = await pool.query('SELECT NOW()');
    console.log('Database connection successful:', testResult.rows[0].now);
    
    console.log('Creating user accounts...');
    
    // Create admin account
    const admin = {
      username: 'emilynn_admin',
      email: 'emilynn@angelic.com',
      password: await hashPassword('JayJas1423!'),
      full_name: 'Admin Emily',
      role: 'admin',
      bio: 'System administrator',
      specialties: [],
      profile_image: '',
      verified: true
    };
    
    // Create reader account
    const reader = {
      username: 'emilynn_reader',
      email: 'emilynn992@gmail.com',
      password: await hashPassword('JayJas1423!'),
      full_name: 'Reader Emily',
      role: 'reader',
      bio: 'Professional psychic reader with 10 years of experience',
      specialties: ['tarot', 'astrology', 'medium'],
      profile_image: '',
      verified: true,
      rate_per_minute: 4.99,
      rating: 4.8
    };
    
    // Create client account
    const client = {
      username: 'emily_client',
      email: 'emily81292@gmail.com',
      password: await hashPassword('Jade2014!'),
      full_name: 'Client Emily',
      role: 'client',
      bio: '',
      specialties: [],
      profile_image: '',
      verified: false
    };
    
    // Check if users already exist
    console.log('Checking for existing users...');
    
    const { rows: existingAdmins } = await pool.query('SELECT * FROM users WHERE email = $1', [admin.email]);
    const { rows: existingReaders } = await pool.query('SELECT * FROM users WHERE email = $1', [reader.email]);
    const { rows: existingClients } = await pool.query('SELECT * FROM users WHERE email = $1', [client.email]);
    
    if (existingAdmins.length > 0) {
      console.log(`Admin account ${admin.email} already exists, skipping creation`);
    } else {
      // Insert admin
      console.log('Creating admin account...');
      const result = await pool.query(
        `INSERT INTO users (username, email, password, full_name, role, bio, specialties, profile_image, 
          verified, created_at, last_active, is_online) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), false) RETURNING id`,
        [admin.username, admin.email, admin.password, admin.full_name, admin.role, admin.bio, 
          JSON.stringify(admin.specialties), admin.profile_image, admin.verified]
      );
      console.log(`Admin account created: ${admin.email} (ID: ${result.rows[0].id})`);
    }
    
    if (existingReaders.length > 0) {
      console.log(`Reader account ${reader.email} already exists, skipping creation`);
    } else {
      // Insert reader
      console.log('Creating reader account...');
      const result = await pool.query(
        `INSERT INTO users (username, email, password, full_name, role, bio, specialties, profile_image, 
          verified, rate_per_minute, rating, created_at, last_active, is_online) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), false) RETURNING id`,
        [reader.username, reader.email, reader.password, reader.full_name, reader.role, reader.bio, 
          JSON.stringify(reader.specialties), reader.profile_image, reader.verified, reader.rate_per_minute, reader.rating]
      );
      console.log(`Reader account created: ${reader.email} (ID: ${result.rows[0].id})`);
    }
    
    if (existingClients.length > 0) {
      console.log(`Client account ${client.email} already exists, skipping creation`);
    } else {
      // Insert client
      console.log('Creating client account...');
      const result = await pool.query(
        `INSERT INTO users (username, email, password, full_name, role, bio, specialties, profile_image, 
          verified, created_at, last_active, is_online) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), false) RETURNING id`,
        [client.username, client.email, client.password, client.full_name, client.role, client.bio, 
          JSON.stringify(client.specialties), client.profile_image, client.verified]
      );
      console.log(`Client account created: ${client.email} (ID: ${result.rows[0].id})`);
    }
    
    console.log('User creation complete!');
    
    // Close the pool
    await pool.end();
    
    // Exit the process
    process.exit(0);
  } catch (error) {
    console.error('Error creating users:', error);
    
    // Try to close the pool if it exists
    if (pool) {
      try {
        await pool.end();
      } catch (err) {
        console.error('Error closing pool:', err);
      }
    }
    
    process.exit(1);
  }
}

createUsers(); 