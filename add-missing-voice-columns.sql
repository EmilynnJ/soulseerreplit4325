-- Add the missing voice pricing columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS scheduled_voice_price_15 DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS scheduled_voice_price_30 DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS scheduled_voice_price_60 DECIMAL(10, 2);

-- Update existing reader users with default pricing for voice calls
UPDATE users 
SET scheduled_voice_price_15 = 25.00,
    scheduled_voice_price_30 = 40.00,
    scheduled_voice_price_60 = 70.00
WHERE role = 'reader'; 