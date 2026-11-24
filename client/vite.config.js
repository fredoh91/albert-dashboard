import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const PROXY_TARGET = "http://localhost:3001";

// Les appels /api/* sont relégués au proxy Express (seul détenteur de la clé).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      "/api": {
        target: PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
});
