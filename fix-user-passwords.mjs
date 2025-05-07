// Script to fix user passwords in the database
import pg from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);

// Hardcode the database URL from .env
const dbUrl = "postgresql://neondb_owner:npg_Pbpz9TuH5AhX@ep-lively-base-a4k2rid7-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";

// Create a sanitized version for logging
const sanitizedUrl = dbUrl.replace(/:[^:@]+@/, ':***@');
console.log(`Using database: ${sanitizedUrl}`);

// Password hashing function (copied from auth.ts)
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64));
  return `${buf.toString("hex")}.${salt}`;
}

// Format validation function for password
function isValidPasswordFormat(password) {
  if (!password) return false;
  
  // Check if it has the hash.salt format
  const parts = password.split('.');
  if (parts.length !== 2) return false;
  
  const [hash, salt] = parts;
  return hash && salt && hash.length > 0 && salt.length > 0;
}

async function fixUserPasswords() {
  const client = new pg.Client({
    connectionString: dbUrl
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully');

    // Get all users
    console.log('Fetching all users...');
    const result = await client.query('SELECT id, username, email, password FROM users');
    console.log(`Found ${result.rows.length} users`);
    
    // Stats
    let fixedCount = 0;
    let skippedCount = 0;
    let auth0Count = 0;
    let alreadyValidCount = 0;
    
    // Process each user
    for (const user of result.rows) {
      const { id, username, email, password } = user;
      
      if (!password) {
        // Auth0 user - no password
        console.log(`User ${username} (${id}) has no password - likely an Auth0 user`);
        auth0Count++;
        continue;
      }
      
      if (isValidPasswordFormat(password)) {
        // Password already in valid format
        console.log(`User ${username} (${id}) already has a valid password format`);
        alreadyValidCount++;
        continue;
      }
      
      // Generate default password - use email as base for consistency
      // This will allow users to still log in after the fix
      console.log(`Fixing password for user ${username} (${id})...`);
      try {
        const newPassword = await hashPassword(email);
        await client.query(
          'UPDATE users SET password = $1 WHERE id = $2',
          [newPassword, id]
        );
        console.log(`✅ Fixed password for user ${username} (${id})`);
        fixedCount++;
      } catch (err) {
        console.error(`Error fixing password for user ${username} (${id}):`, err);
        skippedCount++;
      }
    }
    
    // Print summary
    console.log('\n---- SUMMARY ----');
    console.log(`Total users: ${result.rows.length}`);
    console.log(`Auth0 users (no password): ${auth0Count}`);
    console.log(`Users with valid password format: ${alreadyValidCount}`);
    console.log(`Users with fixed passwords: ${fixedCount}`);
    console.log(`Users skipped due to errors: ${skippedCount}`);
    console.log('----------------\n');
    
    console.log('Password fix complete!');
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

fixUserPasswords().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 