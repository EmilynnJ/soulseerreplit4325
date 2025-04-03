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
      host: true,
      port: 5000,
      proxy: {
        '/api': {
          target: 'http://0.0.0.0:3000',
          changeOrigin: true,
          secure: false
        }
      },
      hmr: {
        host: true,
        clientPort: 443
      },
      allowedHosts: ['f75f3cba-f4b3-4139-8c08-8410f77c1d90-00-206nodnpubbk3.picard.replit.dev', 'all']
    }
  };
});