// Simple launcher script for SoulSeer
const { exec } = require('child_process');
const path = require('path');

console.log('Starting SoulSeer application...');

// Run the server using tsx
const server = exec('cd server && npx tsx index.ts');

server.stdout.on('data', (data) => {
  console.log(`SERVER: ${data}`);
});

server.stderr.on('data', (data) => {
  console.error(`SERVER ERROR: ${data}`);
});

server.on('error', (error) => {
  console.error(`Failed to start server: ${error}`);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});