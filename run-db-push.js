// Script to run drizzle-kit push with correct environment variables
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

// Set the POSTGRES_URL to the DATABASE_URL
process.env.POSTGRES_URL = process.env.DATABASE_URL;

// Execute drizzle-kit generate and db:push commands
try {
  console.log('Generating migrations...');
  execSync('npx drizzle-kit generate:pg', { stdio: 'inherit' });
  console.log('Pushing schema to database...');
  execSync('ts-node --transpile-only ./server/run-migration.ts', { stdio: 'inherit' });
  console.log('Database schema updated successfully!');
} catch (error) {
  console.error('Error updating database schema:', error.message);
  process.exit(1);
}