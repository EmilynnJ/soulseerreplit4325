
import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize database connection
const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_GvNe3Z2qKHoB@ep-lively-frog-a66uvr1j.us-west-2.aws.neon.tech/neondb?sslmode=require');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static('dist/public'));
app.use('/uploads', express.static('public/uploads'));
app.use('/images', express.static('public/images'));

// API Routes
app.get('/api/readers', async (req, res) => {
  try {
    const readers = await sql`
      SELECT id, username, full_name, role, specialties, rating, is_online, pricing_chat, pricing_voice, pricing_video, profile_image 
      FROM users 
      WHERE role = 'reader'
    `;
    res.json(readers);
  } catch (error) {
    console.error('Error fetching readers:', error);
    res.status(500).json({ error: 'Failed to fetch readers' });
  }
});

app.get('/api/readers/online', async (req, res) => {
  try {
    const onlineReaders = await sql`
      SELECT id, username, full_name, role, specialties, rating, is_online, pricing_chat, pricing_voice, pricing_video, profile_image 
      FROM users 
      WHERE role = 'reader' AND is_online = true
    `;
    res.json(onlineReaders);
  } catch (error) {
    console.error('Error fetching online readers:', error);
    res.status(500).json({ error: 'Failed to fetch online readers' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(__dirname, 'dist/public/index.html'));
});

const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
