import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base: "./" makes the build path-independent, so it works at
// https://<user>.github.io/<repo>/, on any static host, or opened locally.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    // Offline mode: precache the app shell, bundle, and fonts so the reader
    // works with no connection (AI tutor features still need network).
    // Registration is injected at build time, so vite.single.config.js —
    // which omits this plugin — still produces a plain single HTML file.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // main.jsx registers via virtual:pwa-register
      manifest: false, // public/manifest.webmanifest is committed as-is
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2,webmanifest}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
