import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { VitePWA } from "vite-plugin-pwa";

// Builds the whole app (fonts included) into one self-contained HTML file
// you can double-click, email, or drop onto any static host.
// The disabled PWA plugin still provides virtual:pwa-register as a no-op,
// so main.jsx compiles without a service worker here.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile(), VitePWA({ disable: true })],
  build: {
    outDir: "dist-single",
    assetsInlineLimit: 100000000,
  },
});
