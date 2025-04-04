const express = require('express');
const path = require('path');
const cors = require('cors');
const { createServer } = require('http');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 5000;

// Basic middleware
app.use(cors());
app.use(express.json());

// Serve static files from dist/public (built client)
const publicDir = path.join(__dirname, 'dist/public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  console.log(`Serving static files from ${publicDir}`);
}

// Serve uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Server API routes if they exist
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
  });
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  res.send('Server is running but client is not built. Run "npm run build" first.');
});

// Create HTTP server
const server = createServer(app);

// Start server
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});

// Error handler (preserved from original, adapted)
app.use((err, req, res, next) => {
  console.error(`Error: ${err.message}`); // Simplified logging
  res.status(err.status || 500).json({
    message: err.message,
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});