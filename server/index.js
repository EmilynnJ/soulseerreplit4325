const express = require('express');
const { registerRoutes } = require('./routes');

async function main() {
  const app = express();
  
  // Middleware
  app.use(express.json());
  
  // Register all routes
  const server = await registerRoutes(app);
  
  // Start the server
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

main().catch(err => {
  console.error("Error starting server:", err);
  process.exit(1);
});