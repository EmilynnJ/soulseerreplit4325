// c:\Users\emily\soulseerreplit4325-1\backend\src\services\readerService.js
const pool = require('../config/database'); // Assuming your NeonDB pool is configured here

exports.fetchAvailableReaders = async () => {
    // Placeholder: In a real app, query the database for readers marked as 'available' or 'online'
    console.log("readerService: Fetching available readers from DB");
    try {
        const query = `
            SELECT 
                u.id AS user_id, 
                u.username AS name, 
                u.email,
                rp.id AS profile_id,
                rp.bio,
                rp.specialties, 
                rp.is_online, 
                rp.rate_per_minute, 
                rp.profile_image_url,
                rp.years_of_experience
            FROM users u
            INNER JOIN reader_profiles rp ON u.id = rp.user_id
            WHERE u.role = 'reader' 
            -- AND rp.is_online = TRUE; -- Optionally filter by online status here or let frontend do it
            ORDER BY rp.is_online DESC, u.username ASC;
        `;
        const { rows } = await pool.query(query);
        return rows;
    } catch (error) {
        console.error("Error fetching readers from DB:", error);
        throw error;
    }
};

exports.fetchReaderProfileById = async (readerId) => {
    console.log(`readerService: Fetching profile for reader ${readerId} from DB`);
    try {
        const query = `
            SELECT 
                u.id AS user_id, u.username AS name, u.email,
                rp.id AS profile_id, rp.bio, rp.specialties, rp.is_online, 
                rp.rate_per_minute, rp.profile_image_url, rp.banner_image_url,
                rp.years_of_experience
                -- Add other fields like schedule, reviews by joining other tables
            FROM users u
            INNER JOIN reader_profiles rp ON u.id = rp.user_id
            WHERE u.id = $1 AND u.role = 'reader';
        `;
        const { rows } = await pool.query(query, [readerId]);
        return rows[0] || null; // Return the profile or null if not found
    } catch (error) {
        console.error(`Error fetching profile for reader ${readerId} from DB:`, error);
        throw error;
    }
};
