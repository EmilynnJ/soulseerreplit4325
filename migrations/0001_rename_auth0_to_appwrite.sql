-- Rename auth0_id column to appwrite_id in users table
ALTER TABLE users RENAME COLUMN auth0_id TO appwrite_id;

-- Update any indexes or constraints that reference auth0_id
DROP INDEX IF EXISTS users_auth0_id_unique;
CREATE UNIQUE INDEX users_appwrite_id_unique ON users(appwrite_id);

-- Make sure any foreign key references are also updated
-- No foreign key references to auth0_id in this schema 