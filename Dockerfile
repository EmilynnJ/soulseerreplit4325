FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Expose the application port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]