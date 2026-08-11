# לָבָן · Lavan — a tap-to-learn Hebrew reader

A web app for learning Hebrew by reading. It ships with **Lavan**, an original
beginner-level graded story with full nikkud, opens a **library of free
public-domain Hebrew books** from three online sources, and lets you load
**your own Hebrew books** (PDF, EPUB, text file, or pasted text). Tap any word
to see its meaning and save it; review saved words with spaced repetition;
drill real sentences with cloze practice; check comprehension with quizzes.

Everything runs in the browser — there is no server and nothing to sign up for.

## What it does

- **Built-in graded story** — 4 chapters, full nikkud (toggleable), every word
  glossed by hand, embedded English per sentence, and a comprehension quiz per
  chapter. Works completely offline from the AI tutor.
- **A graded course** — sixty units running from your first words to literary
  prose. There's no textbook involved: the units come out of the corpus itself.
  Unit N teaches the next band of the frequency ranking (so you always learn the
  word that unlocks the most text) and is paired with a real passage chosen to
  be almost readable with what you've been taught. Readings grow with you — a
  sentence at 84% familiarity in unit 1, a 200-word literary passage by unit 60,
  2,775 words in all. A unit's vocabulary joins the same spaced-repetition store
  as tapped words, and its reading opens in the reader like any other book.
- **A grammar reference** — Wikibooks' Hebrew course (CC BY-SA): alphabet pages,
  binyanim and conjugation tables, to keep beside a book.
- **A graded shelf, offline** — the app ships with 75 short public-domain
  works from Project Ben-Yehuda, sorted into five reading levels coloured green
  (easiest) to red. Grading is measured against the corpus itself: each book is
  scored by how much of it is written in the 2,000 commonest Hebrew words, so
  you can pick something at **71% familiar** rather than guessing from a title.
  Each entry shows the title in English, the author's name in English (from
  Wikidata) with a one-line description, a romanization of the Hebrew title
  where it's vocalized enough to sound out, and a one-line summary of what the
  book is actually about. No key, no network — the shelf browses offline and a
  book stays cached once opened.
- **Free public-domain library** — *Library → Browse free Hebrew books* opens
  three more online sources and downloads any of them straight into your
  library:
  **Sefaria** (a curated shelf of vocalized classical texts, no sign-up),
  **Hebrew Wikisource** (search the whole public-domain corpus, no sign-up),
  and **Project Ben-Yehuda** (~65,000 works of modern Hebrew literature by
  4,400 writers, using a free key you can get in a minute). Downloaded books
  record where they came from and under what licence, and behave exactly like
  imported ones — tap-to-learn, nikkud, quizzes and cloze all work.
- **Your own books** — import a Hebrew PDF (text-layer PDFs; the RTL reading
  order is reconstructed), an `.epub`, a `.txt` file, or pasted text. Books are
  stored in your browser and remembered across visits, with a **common words**
  list per book so you can learn the highest-value vocabulary first.
- **Tap-to-learn** — tap a word and its English **appears right above it in
  the text** (Wiktionary's free API does the quick lookup — no key needed;
  the AI tutor fills in when the dictionary misses). The word turns gold and
  lands in **My Words** — filed under its **dictionary form**: tap במשקפת
  and you learn משקפת, tap a conjugated verb and you learn its infinitive,
  and a word inside a fixed expression (מגדל תצפית, בית ספר) saves the whole
  phrase — tapping either member shows the phrase meaning. Every surface
  form you met stays highlighted and listed under the entry. Tap a gold word
  again for the full panel: dictionary detail, AI deep dive, save/known
  toggles, and a re-lookup button. **Press and hold** a gold word to un-save
  it right in the text. Opening a sentence's
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
- **Simple Hebrew mode** — reading above your level? One tap rewrites the
  page into short, fully vocalized, everyday modern Hebrew (nothing skipped,
  nothing added), cached per page and toggleable like the nikkud view. Read
  the simple version first, then flip to the original — every feature (tap
  glosses, translations, read-aloud, quizzes, cloze) works on both.
- **AI tutor (optional)** — with your own API key from **Anthropic (Claude)**,
  **OpenAI (ChatGPT)**, or **Google (Gemini)**, the app can define *any* word
  you tap in *any* book, translate sentences, explain the **grammar** of any
  sentence point by point, **add nikkud** to unvocalized books page by page,
  rewrite pages in **simple Hebrew**, give deep-dive explanations with
  examples, and write a fresh comprehension quiz for any page. Configure it
  from the gear icon in the app.

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

### Regenerating the offline shelf

`public/shelf/` is generated and committed, so an ordinary build and deploy
need nothing extra. To refresh it against a newer dump:

```bash
git clone --depth 1 https://github.com/projectbenyehuda/public_domain_dump
npm run build:shelf -- --dump ./public_domain_dump
```

The dump is ~3 GB, which is why it isn't a build dependency — the script reads
it, ranks the corpus vocabulary, scores every candidate work for readability,
picks a balanced shelf (capped at three works per author) and writes ~1.5 MB of
JSON. `--count` and `--per-author` tune the selection. Every work in that dump
is public domain; its licence asks that reuse credit "Project Ben-Yehuda
volunteers", which the shelf shows on each book.

**English titles and summaries.** Nothing in the dump carries an English title
or a description, and there's no offline way to derive one — so with an API key
the script asks for both, once per work. Either provider works; it uses
whichever key it finds:

```bash
OPENAI_API_KEY=sk-...      npm run build:shelf -- --dump ./public_domain_dump
ANTHROPIC_API_KEY=sk-ant-... npm run build:shelf -- --dump ./public_domain_dump
```

Get a key from [platform.openai.com](https://platform.openai.com/api-keys) or
[console.anthropic.com](https://console.anthropic.com/settings/keys). Set both
and it prefers Anthropic; `--provider openai|anthropic` overrides, and
`--model` and `--concurrency` tune the run.

The answers are cached in `scripts/shelf-english.json` and committed, so this
costs roughly a dollar or two **once** rather than on every rebuild — later
builds reuse the cache and skip the calls entirely, key or no key. Without a
key the shelf still builds; entries fall back to showing the book's opening
lines in Hebrew.

### Regenerating the course

`public/course/` is generated and committed, from the same dump as the shelf:

```bash
OPENAI_API_KEY=sk-... npm run build:course -- --dump ./public_domain_dump
```

The script ranks the corpus vocabulary, cuts the corpus into candidate spans at
four lengths, then for each unit picks the span best covered by everything
taught so far. Reading length grows with the band — Hebrew inflects heavily, so
coverage by surface form climbs slowly, and a beginner needs a sentence rather
than a paragraph. `--concurrency` and `--model` tune the glossing run, whose
answers cache in `scripts/course-glosses.json`. Without a key the course still
builds; the words ship bare and the reader's tap-to-translate fills them in.

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

Without a key: reading, the built-in story, **the Sefaria and Wikisource
libraries**, word saving, **dictionary lookups (via Wiktionary)**,
spaced-repetition review, cloze practice, read-aloud, themes, and backups all
still work — only the context-aware AI definitions, translations, grammar
breakdowns, nikkud, and page quizzes are off.

## The Ben-Yehuda key (free, separate from the AI key)

[Project Ben-Yehuda](https://benyehuda.org/) — the Hebrew equivalent of
Project Gutenberg — serves its catalogue through an API that asks every app
for its own key. Keys are free, self-service, and issued instantly by email
at [benyehuda.org/api_keys/new](https://benyehuda.org/api_keys/new). Paste it
into *Library → Browse free Hebrew books → Ben-Yehuda*; like the AI keys, it
is stored only in your browser and sent only to Ben-Yehuda. Their guidance is
to stay under 50 requests a minute, which ordinary reading never approaches.

Sefaria and Hebrew Wikisource need no key. All three send open CORS headers,
so the app talks to them directly from the browser and stays a static site
with no server of its own.

## Project layout

```
index.html                 app shell
src/App.jsx                UI — reader, library, review, cloze, settings
src/Browse.jsx             browse & download from the free public-domain libraries
src/Course.jsx             the graded course — units, vocabulary, readings
src/library.js             shelf + course + Sefaria / Wikisource / Ben-Yehuda / Wikibooks
public/shelf/              the graded offline shelf (generated, committed)
public/course/             the graded course (generated, committed)
scripts/build-shelf.mjs    regenerates the shelf from the Ben-Yehuda dump
scripts/build-course.mjs   regenerates the course from the Ben-Yehuda dump
scripts/lib/ask.mjs        shared Claude/OpenAI helper for the build scripts
src/story.js               the built-in "Lavan" story + hand-written glossary
src/ai.js                  AI tutor calls — Anthropic / OpenAI / Gemini (gloss, deep dive, translate, grammar, nikkud, quiz)
src/srs.js                 Leitner spaced-repetition scheduling
src/cloze.js               fill-in-the-blank exercise builder
src/dict.js                free Wiktionary dictionary lookups (keyless)
src/pdf.js                 PDF import (pdf.js, lazy-loaded; RTL reconstruction)
src/epub.js                EPUB import (fflate)
src/text.js                Hebrew text helpers (nikkud, sentence split, speech)
src/storage.js             IndexedDB store (localStorage fallback + migration)
src/fonts.css              self-hosted webfonts (generated)
scripts/fetch-fonts.mjs    regenerates the font files from Google Fonts
.github/workflows/deploy.yml   GitHub Pages deployment
```

Fonts: [Frank Ruhl Libre](https://fonts.google.com/specimen/Frank+Ruhl+Libre)
and [Rubik](https://fonts.google.com/specimen/Rubik), both under the SIL Open
Font License, self-hosted so the app has no runtime font CDN dependency.
