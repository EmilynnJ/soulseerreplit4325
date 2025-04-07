-- Add room_id column to livestreams table
ALTER TABLE livestreams
ADD COLUMN IF NOT EXISTS room_id TEXT;