// Simple server starter that avoids vite.config.ts during startup
// This will let us bypass the ESM/CJS issues
const { spawn } = require('child_process');
const path = require('path');

// Set the NODE_OPTIONS environment variable to enable ESM for TypeScript
process.env.NODE_OPTIONS = '--loader ts-node/esm';

// Run the server with ts-node
const server = spawn('npx', ['ts-node', '--skipProject', 'server/index.ts'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    TS_NODE_TRANSPILE_ONLY: 'true',
    TS_NODE_PROJECT: path.resolve(__dirname, 'tsconfig.json')
  }
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code);
});

// Handle process termination signals
process.on('SIGINT', () => {
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
});