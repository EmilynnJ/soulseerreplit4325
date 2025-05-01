-- Add the missing columns for reader pricing tiers
ALTER TABLE users
ADD COLUMN IF NOT EXISTS scheduled_chat_price_15 DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS scheduled_chat_price_30 DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS scheduled_chat_price_60 DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS scheduled_call_price_15 DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS scheduled_call_price_30 DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS scheduled_call_price_60 DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS scheduled_video_price_15 DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS scheduled_video_price_30 DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS scheduled_video_price_60 DECIMAL(10, 2);

-- Update existing reader users with default pricing
UPDATE users 
SET scheduled_chat_price_15 = 20.00,
    scheduled_chat_price_30 = 35.00,
    scheduled_chat_price_60 = 60.00,
    scheduled_call_price_15 = 25.00,
    scheduled_call_price_30 = 40.00,
    scheduled_call_price_60 = 70.00,
    scheduled_video_price_15 = 30.00,
    scheduled_video_price_30 = 50.00,
    scheduled_video_price_60 = 80.00
WHERE role = 'reader'; 