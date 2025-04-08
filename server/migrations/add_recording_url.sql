-- Add recordingUrl field to livestreams table for storing recorded livestream URLs
ALTER TABLE livestreams ADD COLUMN IF NOT EXISTS recording_url TEXT;
