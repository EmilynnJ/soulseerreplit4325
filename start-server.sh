
#!/bin/bash
echo "Building client..."
npm run build

echo "Starting server..."
node server-vite-bypass.js
