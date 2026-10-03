import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readdirSync, statSync } from "node:fs";

/* How many files a folder of public/ ships, so a runtime cache's cap can sit
   above the whole set. A cap below it is a cap that throws away something the
   learner downloaded for a plane and makes them fetch it again — and a number
   written by hand goes stale the next time the course grows. */
const shipped = (dir, re) => {
  try {
    return readdirSync(new URL(`./public/${dir}`, import.meta.url)).filter((f) => re.test(f)).length;
  } catch {
    return 0;
  }
};
const capFor = (dir, re, floor) => Math.max(floor, Math.ceil(shipped(dir, re) * 1.25));

/* What "Download for offline" in Settings will fetch, in bytes, so the button
   can say how big it is (src/offline.js). Measured here rather than written
   down, for the same reason as the caps above. */
const bytes = (dir, re) => {
  try {
    const base = new URL(`./public/${dir}/`, import.meta.url);
    return readdirSync(base)
      .filter((f) => re.test(f))
      .reduce((n, f) => n + statSync(new URL(f, base)).size, 0);
  } catch {
    return 0;
  }
};
const OFFLINE_SIZES = {
  core:
    bytes("duo", /^unit-\d+\.json$/) +
    bytes("duo/feed", /^\d+\.json$/) +
    bytes("duo/img", /\.webp$/) +
    bytes("shelf", /^\d+\.json$/),
  audio: bytes("duo/audio", /\.(mp3|m4a)$/),
};

// base: "./" makes the build path-independent, so it works at
// https://<user>.github.io/<repo>/, on any static host, or opened locally.
export default defineConfig({
  base: "./",
  define: { __OFFLINE_SIZES__: JSON.stringify(OFFLINE_SIZES) },
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
          // The app's own pictures (the hoopoe in the header). Only the
          // bundle's — a wider webp pattern would sweep up the course's
          // photographs, which are cached on use or by "Download for offline".
          "assets/*.webp",
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
          // The reading feed's index is 1 KB and says which bands exist; its
          // thirteen band files are 650 KB between them and are fetched when
          // somebody at that level actually asks to read.
          "duo/feed/index.json",
          // The word index and the recordings index are fetched on every
          // launch and the app quietly does without them when they fail —
          // which offline meant always: a placement taught nothing it had
          // tested, and recordings already kept on the phone went unplayed
          // because nothing said which line they were for. 700 KB of text
          // between them, much less over the wire.
          "duo/lexicon.json",
          "duo/audio.json",
          // The graded course beside the shelf: 330 KB of text, all of it,
          // for the same reason as the curriculum.
          "course/*.json",
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
            /* not CacheFirst, which the shelf's books get: a book is finished
               and a lesson is not, so a unit is served from the cache and
               replaced behind the reader if the course has since been fixed */
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "lavan-duo-units",
              /* one per unit and a few spare. Counted from the course rather
                 than set at a round number: a cap below the number of units
                 is a cap that throws away a unit the learner has opened and
                 makes them download it again. */
              expiration: { maxEntries: capFor("duo", /^unit-\d+\.json$/, 260) },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => /\/duo\/feed\/\d+\.json$/.test(url.pathname),
            /* Kept like a unit rather than like a book: the feed is rebuilt
               whenever the course's vocabulary index moves, and a band held
               for ever would go on offering paragraphs scored against a
               course that has since changed. */
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "lavan-duo-feed",
              expiration: { maxEntries: 20 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => /\/duo\/img\/[^/]+\.webp$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "lavan-duo-pictures",
              /* one per photograph the course ships, for the same reason */
              expiration: { maxEntries: capFor("duo/img", /\.webp$/, 1200) },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            /* Recordings, where npm run build:audio has made any. Not
               precached — they are a download the app should only make for
               someone who reaches the unit — but kept for good once fetched,
               which is the whole reason for shipping them rather than
               generating each line in the browser. */
            urlPattern: ({ url }) => /\/duo\/audio\/[^/]+\.(mp3|m4a)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "lavan-duo-audio",
              /* every recording, so "Download for offline" with audio can
                 keep the lot */
              expiration: { maxEntries: capFor("duo/audio", /\.(mp3|m4a)$/, 900) },
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
          {
            /* pdf.js comes from a CDN the first time a PDF is opened. The URL
               carries its version, so a copy is good for ever — and without
               one, a PDF cannot be imported on a plane. */
            urlPattern: ({ url }) =>
              url.origin === "https://cdnjs.cloudflare.com" && url.pathname.startsWith("/ajax/libs/pdf.js/"),
            handler: "CacheFirst",
            options: {
              cacheName: "lavan-pdfjs",
              expiration: { maxEntries: 4 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
