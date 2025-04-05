
import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static('dist/public'));
app.use('/uploads', express.static('public/uploads'));

// Mock readers data for testing
const mockReaders = [
  {
    id: 1,
    fullName: "Luna Starweaver",
    role: "reader",
    specialties: ["Tarot", "Astrology"],
    rating: 4.9,
    isOnline: true,
    pricing: 299,
    profileImage: "/images/default-profile.jpg"
  },
  {
    id: 2, 
    fullName: "Sage Moonwhisper",
    role: "reader",
    specialties: ["Medium", "Energy Healing"],
    rating: 4.8,
    isOnline: true,
    pricing: 399,
    profileImage: "/images/default-profile.jpg"
  }
];

// API Routes
app.get('/api/readers', (req, res) => {
  res.json(mockReaders);
});

app.get('/api/readers/online', (req, res) => {
  const onlineReaders = mockReaders.filter(reader => reader.isOnline);
  res.json(onlineReaders);
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/public/index.html'));
});

const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
