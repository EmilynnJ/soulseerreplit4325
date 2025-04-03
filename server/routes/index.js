const { createServer } = require('http');

function registerRoutes(app) {
  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
  });
  
  // Add more routes as needed
  
  const httpServer = createServer(app);
  return httpServer;
}

module.exports = { registerRoutes };