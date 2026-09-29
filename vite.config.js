import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" : l'app fonctionne quel que soit le nom du dépôt GitHub
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { chunkSizeWarningLimit: 1200 },
});
