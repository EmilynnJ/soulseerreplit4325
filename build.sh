#!/bin/bash

# First run the Vite build for the client
echo "Building client..."
npx vite build

# Then build the server with ES Module compatibility fixes
echo "Building server..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --banner:js="import { createRequire } from 'module'; import path from 'path'; import { fileURLToPath } from 'url'; const require = createRequire(import.meta.url); const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename);"

echo "Build completed successfully!"
