import dotenv from 'dotenv';
dotenv.config();

import { sql } from './server/db';

async function checkForDataToMigrate() {
  try {
    console.log('Checking for existing data to migrate...\n');
    
    // Check users table
    const users = await sql`SELECT COUNT(*) as count FROM users`;
    console.log(`Users: ${users[0].count} records`);
    
    if (Number(users[0].count) > 0) {
      const userSample = await sql`SELECT id, username, email, role FROM users LIMIT 5`;
      console.log('Sample users:', userSample);
    }
    
    // Check readings table
    const readings = await sql`SELECT COUNT(*) as count FROM readings`;
    console.log(`Readings: ${readings[0].count} records`);
    
    // Check products table
    const products = await sql`SELECT COUNT(*) as count FROM products`;
    console.log(`Products: ${products[0].count} records`);
    
    // Check orders table
    const orders = await sql`SELECT COUNT(*) as count FROM orders`;
    console.log(`Orders: ${orders[0].count} records`);
    
    // Check livestreams table
    const livestreams = await sql`SELECT COUNT(*) as count FROM livestreams`;
    console.log(`Livestreams: ${livestreams[0].count} records`);
    
    // Check forum posts
    const forumPosts = await sql`SELECT COUNT(*) as count FROM forum_posts`;
    console.log(`Forum Posts: ${forumPosts[0].count} records`);
    
    // Check gifts table
    const gifts = await sql`SELECT COUNT(*) as count FROM gifts`;
    console.log(`Gifts: ${gifts[0].count} records`);
    
    // Check session logs table
    const sessionLogs = await sql`SELECT COUNT(*) as count FROM session_logs`;
    console.log(`Session Logs: ${sessionLogs[0].count} records`);
    
    console.log('\nData check complete');
  } catch (error) {
    console.error('Error checking data:', error);
  }
}

checkForDataToMigrate();