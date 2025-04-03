import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a function that returns the config
export default defineConfig(async () => {
  // Import the cartographer conditionally
  const cartographerPlugin = 
    process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [(await import("@replit/vite-plugin-cartographer")).cartographer()]
      : [];

  return {
    plugins: [
      react(),
      runtimeErrorOverlay(),
      themePlugin(),
      ...cartographerPlugin,
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@shared": path.resolve(__dirname, "../shared"),
      },
    },
    root: path.resolve(__dirname, "client"),
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    server: {
      host: '0.0.0.0',
      port: 5000,
      allowedHosts: 'all'
    }
  };
});
