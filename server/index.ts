import express from 'express';
import { registerRoutes } from './routes.js';

async function main() {
  const app = express();

  // Middleware
  app.use(express.json());

  // Register all routes
  const server = await registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Server error:", err);
    res.status(status).json({ message });
  });

  // Start the server
  const PORT = process.env.PORT || 5000;
  server.listen({
    port: PORT,
    host: "0.0.0.0",
  }, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

main().catch(err => {
  console.error("Error starting server:", err);
  process.exit(1);
});