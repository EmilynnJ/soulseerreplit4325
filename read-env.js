import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the absolute path to the .env file
const envPath = path.resolve(__dirname, '.env');
console.log(`Looking for .env file at: ${envPath}`);

try {
  if (fs.existsSync(envPath)) {
    console.log('.env file found - reading keys');
    
    // Read the file and process each line
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envLines = envContent.split('\n');
    
    // Process each line
    envLines.forEach(line => {
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) return;
      
      // Extract the key name only (not the value)
      const keyMatch = line.match(/^([^=]+)=/);
      if (keyMatch && keyMatch[1]) {
        const key = keyMatch[1].trim();
        // Show key names and value lengths but not actual values
        const valueLength = line.substring(key.length + 1).trim().length;
        console.log(`Found key: ${key} (value length: ${valueLength})`);
      }
    });
    
    console.log(`Total lines in .env file: ${envLines.length}`);
  } else {
    console.error('.env file not found at:', envPath);
  }
} catch (error) {
  console.error('Error reading .env file:', error);
} 