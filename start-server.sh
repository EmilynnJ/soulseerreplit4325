#!/bin/bash

# Add the stripe_customer_id column if it doesn't exist
psql $POSTGRES_URL -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100);"

# Start the server
node dist/index.js
