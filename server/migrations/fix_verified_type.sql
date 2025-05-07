-- Fix the verified column type
ALTER TABLE users 
  ALTER COLUMN verified TYPE BOOLEAN USING 
    CASE 
      WHEN verified = 'true' THEN TRUE
      WHEN verified = 'false' THEN FALSE
      ELSE FALSE
    END;

-- Set default value and ensure no nulls
ALTER TABLE users 
  ALTER COLUMN verified SET DEFAULT FALSE;

UPDATE users SET verified = FALSE WHERE verified IS NULL; 