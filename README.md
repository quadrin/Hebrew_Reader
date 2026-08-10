# לָבָן · Lavan — a tap-to-learn Hebrew reader

A web app for learning Hebrew by reading. It ships with **Lavan**, an original
beginner-level graded story with full nikkud, and lets you load **your own
Hebrew books** (PDF, EPUB, text file, or pasted text). Tap any word to see its
meaning and save it; review saved words with spaced repetition; drill real
sentences with cloze practice; check comprehension with quizzes.

Everything runs in the browser — there is no server and nothing to sign up for.

## What it does

- **Built-in graded story** — 4 chapters, full nikkud (toggleable), every word
  glossed by hand, embedded English per sentence, and a comprehension quiz per
  chapter. Works completely offline from the AI tutor.
- **Your own books** — import a Hebrew PDF (text-layer PDFs; the RTL reading
  order is reconstructed), an `.epub`, a `.txt` file, or pasted text. Books are
  stored in your browser and remembered across visits, with a **common words**
  list per book so you can learn the highest-value vocabulary first.
- **Tap-to-learn** — tap a word and its English **appears right above it in
  the text** (Wiktionary's free API does the quick lookup — no key needed;
  the AI tutor fills in when the dictionary misses). The word turns gold and
  lands in **My Words**. Tap it again for the full panel: dictionary detail,
  AI deep dive, save/known toggles, and a re-lookup button. **Press and hold**
  a gold word to un-save it right in the text. Opening a sentence's
  translation shows the full **interlinear view** — a gloss above every word —
  and the **star** at the end of any line saves the whole sentence to a
  favorites list.
- **Known words & comprehension meter** — mark words as known from the word
  panel (words also graduate automatically when they master the top SRS box).
  Each book page then shows *"you know N% of this page"*, the common-words
  list tracks how much of the book you've mastered, and drills stop blanking
  words you already know.
- **Spaced repetition** — saved words are scheduled with a Leitner system
  (1 → 3 → 7 → 14 → 30 days). The Words tab shows what's due; flashcards and
  cloze answers both feed the schedule. Export your words as an **Anki deck**
  any time, or download a full **backup** (books, words, progress) and restore
  it on another device.
- **Cloze practice** — fill-in-the-blank drills built from real sentences:
  random sentences from the book you're reading plus sentences you saved words
  from, with distractors drawn from the same book. Both cloze and flashcards
  have a **typing mode** (toggle in the header): produce the Hebrew yourself,
  graded forgivingly — nikkud and final-letter forms don't count against you.
- **Read aloud** — listen to a whole chapter or page with the built-in speech
  synthesis; the current sentence is highlighted as it plays. Any single word
  or sentence has its own listen button too.
- **Reading comfort** — paper, sepia, and dark themes plus four text sizes,
  remembered across visits. Installable as an app (PWA): after the first
  visit, reading works offline.
- **AI tutor (optional)** — with your own API key from **Anthropic (Claude)**,
  **OpenAI (ChatGPT)**, or **Google (Gemini)**, the app can define *any* word
  you tap in *any* book, translate sentences, explain the **grammar** of any
  sentence point by point, **add nikkud** to unvocalized books page by page,
  give deep-dive explanations with examples, and write a fresh comprehension
  quiz for any page. Configure it from the gear icon in the app.

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

AI features call your chosen provider's API **directly from your browser**
with a key you paste into the app's settings (gear icon). Any one of these
works:

| Provider | Get a key at | Models offered |
| --- | --- | --- |
| Claude (Anthropic) | [console.anthropic.com](https://console.anthropic.com/settings/keys) | Sonnet 4.6 (default), Opus 5, Haiku 4.5 |
| ChatGPT (OpenAI) | [platform.openai.com](https://platform.openai.com/api-keys) | GPT-5.1 (default), GPT-5.6 Luna, GPT-5 mini, GPT-4.1 |
| Gemini (Google) | [aistudio.google.com](https://aistudio.google.com/apikey) | 2.5 Flash (default), 3 Pro preview, 2.5 Flash-Lite |

- The key is stored only in your browser's localStorage and is sent only to
  the provider you chose. It is never embedded in the site or shared.
- Keys are kept per provider, so you can save one of each and switch freely —
  the app verifies a key with a tiny test request before saving it.
- Word lookups and translations cost a fraction of a cent each.

Without a key: reading, the built-in story, word saving, **dictionary lookups
(via Wiktionary)**, spaced-repetition review, cloze practice, read-aloud,
themes, and backups all still work — only the context-aware AI definitions,
translations, grammar breakdowns, nikkud, and page quizzes are off.

## Project layout

```
index.html                 app shell
src/App.jsx                UI — reader, library, review, cloze, settings
src/story.js               the built-in "Lavan" story + hand-written glossary
src/ai.js                  AI tutor calls — Anthropic / OpenAI / Gemini (gloss, deep dive, translate, grammar, nikkud, quiz)
src/srs.js                 Leitner spaced-repetition scheduling
src/cloze.js               fill-in-the-blank exercise builder
src/dict.js                free Wiktionary dictionary lookups (keyless)
src/pdf.js                 PDF import (pdf.js, lazy-loaded; RTL reconstruction)
src/epub.js                EPUB import (fflate)
src/text.js                Hebrew text helpers (nikkud, sentence split, speech)
src/storage.js             localStorage adapter
src/fonts.css              self-hosted webfonts (generated)
scripts/fetch-fonts.mjs    regenerates the font files from Google Fonts
.github/workflows/deploy.yml   GitHub Pages deployment
```

Fonts: [Frank Ruhl Libre](https://fonts.google.com/specimen/Frank+Ruhl+Libre)
and [Rubik](https://fonts.google.com/specimen/Rubik), both under the SIL Open
Font License, self-hosted so the app has no runtime font CDN dependency.
