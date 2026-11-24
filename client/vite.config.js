import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const PROXY_TARGET = "http://localhost:3001";

// Chemin de base du build (URL publique). Par défaut à la racine ("/"),
// configurable en variable d'environnement pour un déploiement dans un
// sous-répertoire (ex. VITE_BASE_PATH=/albert-dashboard/ derrière Apache).
// Vite normalise automatiquement le "/" final manquant.
const BASE = process.env.VITE_BASE_PATH || "/";

// Les appels /api/* sont relégués au proxy Express (seul détenteur de la clé).
export default defineConfig({
  base: BASE,
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
