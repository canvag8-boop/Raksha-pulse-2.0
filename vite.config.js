import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleWearableRequest } from './server/wearableBackend.js';

function wearableApiPlugin() {
  return {
    name: 'wearable-api-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          const handled = handleWearableRequest(req, res);
          if (handled) return;
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          const handled = handleWearableRequest(req, res);
          if (handled) return;
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    wearableApiPlugin(),
  ],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
  }
});
