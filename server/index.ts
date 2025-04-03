
import express from 'express';
import { registerRoutes } from './routes';
import { setupVite } from './vite';

async function main() {
  const app = express();
  app.use(express.json());

  const server = await registerRoutes(app);
  
  if (process.env.NODE_ENV !== 'production') {
    await setupVite(app, server);
  }

  const PORT = process.env.PORT || 3000;
  server.listen({
    port: PORT,
    host: "0.0.0.0"
  }, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main().catch(err => {
  console.error("Error starting server:", err);
  process.exit(1);
});
