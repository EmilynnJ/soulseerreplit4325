#!/bin/bash

# Ensure Appwrite environment variables are set
if [ -z "$APPWRITE_API_ENDPOINT" ]; then
  echo "Setting default APPWRITE_API_ENDPOINT"
  export APPWRITE_API_ENDPOINT="https://nyc.cloud.appwrite.io/v1"
fi

if [ -z "$VITE_APPWRITE_PROJECT_ID" ]; then
  echo "Setting default VITE_APPWRITE_PROJECT_ID"
  export VITE_APPWRITE_PROJECT_ID="681831b30038fbc171cf"
fi

if [ -z "$VITE_APPWRITE_API_ENDPOINT" ]; then
  echo "Setting default VITE_APPWRITE_API_ENDPOINT"
  export VITE_APPWRITE_API_ENDPOINT="https://nyc.cloud.appwrite.io/v1"
fi

# Create .env file for client
echo "Creating client .env file"
echo "VITE_APPWRITE_API_ENDPOINT=$VITE_APPWRITE_API_ENDPOINT" > client/.env
echo "VITE_APPWRITE_PROJECT_ID=$VITE_APPWRITE_PROJECT_ID" >> client/.env

# Create .env file for server
echo "Creating server .env file"
echo "APPWRITE_API_ENDPOINT=$APPWRITE_API_ENDPOINT" > .env
echo "VITE_APPWRITE_PROJECT_ID=$VITE_APPWRITE_PROJECT_ID" >> .env
echo "VITE_APPWRITE_API_ENDPOINT=$VITE_APPWRITE_API_ENDPOINT" >> .env

# First run the Vite build for the client
echo "Building client..."
npx vite build

# Then build the server with ES Module compatibility fixes
echo "Building server..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --banner:js="import { createRequire } from 'module'; import path from 'path'; import { fileURLToPath } from 'url'; const require = createRequire(import.meta.url); const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename);"

echo "Build completed successfully!"
