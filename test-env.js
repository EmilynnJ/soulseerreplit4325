// ES Module format for compatibility with the project
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load environment variables
config();

// Get directory of current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Environment variables:');
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

// List all .env files in the current directory
console.log('\nLooking for .env files:');
const files = fs.readdirSync(__dirname);
const envFiles = files.filter(file => file.startsWith('.env') || file.includes('env'));
console.log('Found env files:', envFiles);

// If .env exists, check its content
if (envFiles.includes('.env')) {
  console.log('\nContents of .env file:');
  const envContent = fs.readFileSync(join(__dirname, '.env'), 'utf8');
  console.log(envContent);
} 