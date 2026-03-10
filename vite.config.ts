import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  publicDir: 'public',
  server: {
    port: 5173,
    proxy: {
      '/api/rest': { target: 'http://localhost:3001', rewrite: (p) => p.replace(/^\/api\/rest/, '') },
      '/api/graphql': { target: 'http://localhost:3002', rewrite: (p) => p.replace(/^\/api\/graphql/, '') },
    },
    watch: {
      // Ignora la cartella benchmark dentro public — viene aggiornata
      // dal benchmark-server e non deve triggerare il reload di Vite
      ignored: ['**/public/benchmark/**'],
    },
  },
});
