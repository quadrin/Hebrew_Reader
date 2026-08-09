import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes the build path-independent, so it works at
// https://<user>.github.io/<repo>/, on any static host, or opened locally.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
