-- Drop the check constraint if it exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_verified_check;

-- Modify the column to ensure it accepts boolean values properly
ALTER TABLE users 
  ALTER COLUMN verified DROP DEFAULT,
  ALTER COLUMN verified TYPE BOOLEAN USING verified::boolean,
  ALTER COLUMN verified SET DEFAULT FALSE;

-- If needed, update any NULL values to FALSE
UPDATE users SET verified = FALSE WHERE verified IS NULL; 