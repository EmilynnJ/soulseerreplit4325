// Script to find and fix Auth0 references in client code
const fs = require('fs');
const path = require('path');

const CLIENT_DIR = path.join(__dirname, 'client', 'src');

// Function to find files recursively
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      findFiles(filePath, fileList);
    } else if (stats.isFile() && (filePath.endsWith('.ts') || filePath.endsWith('.tsx'))) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Find all TypeScript files in client directory
const files = findFiles(CLIENT_DIR);
console.log(`Found ${files.length} TypeScript files to check`);

// Check each file for Auth0 references
let auth0Files = [];
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('Auth0')) {
    auth0Files.push({ file, content });
    console.log(`Found Auth0 reference in: ${file}`);
  }
});

console.log(`Found ${auth0Files.length} files with Auth0 references`);

// Look specifically for "Auth0 Configuration Status" log
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('Auth0 Configuration Status')) {
    console.log(`\nFound Auth0 Configuration Status log in: ${file}`);
    console.log('This is likely causing the Auth0 configuration messages in the console');
  }
});

// Print usage instructions
console.log('\nTo fix Auth0 references:');
console.log('1. Remove Auth0 configuration from environment files');
console.log('2. Replace Auth0 references with Appwrite');
console.log('3. Update login and authentication flows to use only Appwrite'); 