-- Remove Mux-related fields from livestreams table
ALTER TABLE livestreams
DROP COLUMN IF EXISTS stream_key,
DROP COLUMN IF EXISTS playback_id;

-- Add comment for migration tracking
COMMENT ON TABLE livestreams IS 'Removed Mux-related fields stream_key and playback_id';