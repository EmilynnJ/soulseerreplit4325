
#!/bin/bash
# Build client first
echo "Building client..."
npm run build

# Start simplified server
echo "Starting server..."
node server-vite-bypass.js
