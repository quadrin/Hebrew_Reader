import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds the whole app (fonts included) into one self-contained HTML file
// you can double-click, email, or drop onto any static host.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist-single",
    assetsInlineLimit: 100000000,
  },
});
