# לָבָן · Lavan — a tap-to-learn Hebrew reader

A web app for learning Hebrew by reading. It ships with **Lavan**, an original
beginner-level graded story with full nikkud, and lets you load **your own
Hebrew books** (PDF, text file, or pasted text). Tap any word to see its
meaning and save it; review saved words as flashcards; check comprehension
with quizzes.

Everything runs in the browser — there is no server and nothing to sign up for.

## What it does

- **Built-in graded story** — 4 chapters, full nikkud (toggleable), every word
  glossed by hand, embedded English per sentence, and a comprehension quiz per
  chapter. Works completely offline from the AI tutor.
- **Your own books** — import a Hebrew PDF (text-layer PDFs; the RTL reading
  order is reconstructed), a `.txt` file, or pasted text. Books are stored in
  your browser and remembered across visits.
- **Tap-to-learn** — tap a word for its gloss; it's highlighted gold and saved
  to **My Words** for flashcard review. Listen to any word or sentence with the
  built-in speech synthesis.
- **AI tutor (optional)** — with your own Anthropic API key, the app can
  define *any* word you tap in *any* book, translate sentences, give deep-dive
  explanations with examples, and write a fresh comprehension quiz for any
  page. Configure it from the gear icon in the app.

## Put it online (GitHub Pages)

The repo includes a workflow that builds and publishes the app automatically.
One-time setup:

1. On GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Open the **Actions** tab, select **Deploy to GitHub Pages**, and click
   **Run workflow** (it also runs automatically on every push to `main`).

Your reader will be live at:

```
https://<your-username>.github.io/Hebrew_Reader/
```

The build is path-independent (`base: "./"`), so it also works on Netlify,
Vercel, Cloudflare Pages, or any static host — just serve the `dist/` folder.

## Run it locally

```bash
npm install
npm run dev        # development server
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

### Single-file version

```bash
npm run build:single
```

produces `dist-single/index.html` — the entire app (fonts included) in one
HTML file you can double-click, email to yourself, or drop onto any host.

## The AI tutor key

AI features call the Anthropic API **directly from your browser** with a key
you paste into the app's settings (gear icon):

- Create a key at [console.anthropic.com](https://console.anthropic.com/settings/keys).
- The key is stored only in your browser's localStorage and is sent only to
  `api.anthropic.com`. It is never embedded in the site or shared.
- Word lookups and translations cost a fraction of a cent each. You can choose
  the model in settings (Sonnet 4.6 is the default; Haiku 4.5 is cheaper and
  faster; Opus 5 is the most capable).

Without a key, reading, the built-in story, word saving, flashcards, and
speech all still work — only the AI lookups/translations/quizzes are off.

## Project layout

```
index.html                 app shell
src/App.jsx                UI — reader, library, quizzes, flashcards, settings
src/story.js               the built-in "Lavan" story + hand-written glossary
src/ai.js                  Claude API calls (gloss, deep dive, translate, quiz)
src/pdf.js                 PDF import (pdf.js, lazy-loaded; RTL reconstruction)
src/text.js                Hebrew text helpers (nikkud, sentence split, speech)
src/storage.js             localStorage adapter
src/fonts.css              self-hosted webfonts (generated)
scripts/fetch-fonts.mjs    regenerates the font files from Google Fonts
.github/workflows/deploy.yml   GitHub Pages deployment
```

Fonts: [Frank Ruhl Libre](https://fonts.google.com/specimen/Frank+Ruhl+Libre)
and [Rubik](https://fonts.google.com/specimen/Rubik), both under the SIL Open
Font License, self-hosted so the app has no runtime font CDN dependency.
