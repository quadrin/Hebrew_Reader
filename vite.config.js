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
        // The shelf's own texts are deliberately not precached — that would
        // push a megabyte of books at every first visit. Only its index ships
        // up front, so the shelf can be browsed offline; a book is cached once
        // it has actually been opened. The Ben-Yehuda writer directory follows
        // the same rule: its index precaches, its 500 per-writer files don't.
        globPatterns: [
          "**/*.{js,css,html,svg,png,woff2,webmanifest}",
          "shelf/index.json",
          "browse/authors.json",
          // The curriculum is the taught path and has to work on a plane: it is
          // 195 KB of text with no images, so all 47 files precache.
          "curriculum/*.json",
          // The Duolingo path's index precaches — 60 KB, and without it the
          // Path tab has nothing to draw. Its 84 unit files are cached as they
          // are opened, the way the shelf's books are.
          "duo/course.json",
          // Which words have a picture is 30 KB and decides what a lesson looks
          // like, so it precaches; the pictures themselves are ~300 files and
          // are cached as the words that use them come up.
          "duo/images.json",
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/shelf\/\d+\.json$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "lavan-shelf-books",
              expiration: { maxEntries: 100 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => /\/duo\/unit-\d+\.json$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "lavan-duo-units",
              expiration: { maxEntries: 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => /\/duo\/img\/[^/]+\.webp$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "lavan-duo-pictures",
              expiration: { maxEntries: 400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => /\/browse\/author-\d+\.json$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "lavan-browse-authors",
              expiration: { maxEntries: 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
