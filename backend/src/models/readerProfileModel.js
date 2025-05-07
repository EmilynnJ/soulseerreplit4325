// c:\Users\emily\soulseerreplit4325-1\backend\src\models\readerProfileModel.js

/*
This table stores reader-specific information, linked to the main users table.

CREATE TABLE reader_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Foreign key to users table
    bio TEXT,
    specialties TEXT[], -- Array of strings, e.g., ['Tarot', 'Astrology']
    rate_per_minute DECIMAL(5, 2) DEFAULT 0.00, -- e.g., 2.99
    is_online BOOLEAN DEFAULT FALSE,
    profile_image_url VARCHAR(255),
    banner_image_url VARCHAR(255),
    years_of_experience INTEGER DEFAULT 0,
    -- Add other reader-specific fields like average_rating, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
*/
console.log("readerProfileModel.js loaded - define DB interactions for reader profiles here if needed, or handle in userService/readerService.");
