
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { createServer } = require('http');

// Create Express app
const app = express();
const port = 5000;
const host = '0.0.0.0';

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from dist/public (built client)
const publicDir = path.join(__dirname, 'dist/public');
app.use(express.static(publicDir));

// Serve uploads and images directories
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Health check endpoint
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
  } else {
    res.send(`
      <html>
        <head><title>SoulSeer</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
          <h1>SoulSeer App</h1>
          <p>Server is running but client is not built yet.</p>
          <p>Please run: <code>npm run build</code> first.</p>
          <button onclick="window.location.reload()">Refresh</button>
        </body>
      </html>
    `);
  }
});

// Create HTTP server
const server = createServer(app);

// Start server
server.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
});
