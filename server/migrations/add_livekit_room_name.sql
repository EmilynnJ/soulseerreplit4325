-- Add LiveKit room name column to livestreams table
ALTER TABLE livestreams
ADD COLUMN IF NOT EXISTS livekit_room_name TEXT;