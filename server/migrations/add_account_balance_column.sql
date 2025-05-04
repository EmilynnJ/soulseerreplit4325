-- Migration to add account_balance column to the users table
ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS account_balance INTEGER NOT NULL DEFAULT 0; 