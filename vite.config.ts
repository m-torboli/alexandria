/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react()],
  // Non nascondere gli errori di Rust nel terminale.
  clearScreen: false,
  server: {
    // Tauri si aspetta una porta fissa.
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    // App desktop: i file sono locali, non scaricati dalla rete. PDF.js e il
    // lettore sono comunque in pacchetti separati, caricati solo quando servono.
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
