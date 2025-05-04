-- Add stripe_customer_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100);

-- Ensure no constraints are blocking its usage
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_stripe_customer_id_check;

-- Make sure the column accepts the right type and has default null
ALTER TABLE users 
  ALTER COLUMN stripe_customer_id TYPE VARCHAR(100),
  ALTER COLUMN stripe_customer_id DROP NOT NULL,
  ALTER COLUMN stripe_customer_id DROP DEFAULT; 