-- First approach: Drop verified column and recreate it
DO $$
BEGIN
    -- Check if verified column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'verified'
    ) THEN
        -- Drop the column
        ALTER TABLE users DROP COLUMN verified;
    END IF;
    
    -- Add it back with proper definition
    ALTER TABLE users ADD COLUMN verified BOOLEAN DEFAULT FALSE;
END $$;

-- Second approach: If the column exists but has a check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_verified_check;

-- Third approach: Modify the column type if needed
DO $$
BEGIN
    -- Check if verified column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'verified'
    ) THEN
        -- Modify column type
        ALTER TABLE users 
            ALTER COLUMN verified TYPE BOOLEAN USING 
                CASE 
                    WHEN verified = 'true' THEN TRUE
                    WHEN verified = 'false' THEN FALSE
                    ELSE FALSE
                END,
            ALTER COLUMN verified SET DEFAULT FALSE;
    END IF;
END $$; 