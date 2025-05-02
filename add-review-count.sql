-- Add the missing review_count column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0; 