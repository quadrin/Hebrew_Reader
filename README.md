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
- **A taught course** — six levels and 69 lessons, from *this is an alef* to
  reading Brenner. It follows the shape every ulpan uses, because a course has
  to: the alphabet and the vowel marks first, then nouns and gender, then
  adjective agreement, the present tense, possession, the past, the construct
  chain, the seven binyanim, and finally the older forms — vav-consecutive,
  attached object pronouns, the directional ־ָה — that the public-domain
  library is actually written in. Grammar lessons alternate with **23 themed
  vocabulary packs** of 20–34 words apiece — the house, the body, the market,
  the calendar, a day in verbs, the rabbinic register — for **869 words** in
  all, spliced in after the grammar each set needs. Each lesson teaches, then
  tests: **1,437 exercises** across seven kinds — multiple choice, listening
  (spoken aloud), sounding out, matching, odd-one-out, fill-the-gap in a real
  sentence, sentence building, and typing Hebrew unprompted. Every letter,
  example, conjugation and vocabulary word is tappable to hear it. Progress is
  per lesson, with a score you can beat by practising again.
- **Graded readings from the corpus** — at the end of each level, real
  public-domain passages picked by how much of each is built from words that
  level has covered, so the first thing you read is 84% familiar. Vocabulary
  from a lesson joins the same spaced-repetition store as tapped words, and any
  reading opens in the reader like an ordinary book.
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
- **Free public-domain library** — the *Browse* tab opens three more online
  sources and downloads any of them straight into your library:
  **Sefaria** (a curated shelf of vocalized classical texts, no sign-up),
  **Hebrew Wikisource** (the whole public-domain corpus, no sign-up), and
  **Project Ben-Yehuda** (~65,000 works of modern Hebrew literature by 4,400
  writers, using a free key you can get in a minute). Both of the big two are
  browsable, not just searchable: Wikisource opens on nine shelves with English
  names — folk tales, children's stories, poetry by poet — that drill down into
  its category tree, each work showing an estimated reading time; Ben-Yehuda
  opens on a directory of 504 writers and 25,624 works, named in English,
  filterable, and sorted by genre, which ships with the app and needs no key to
  browse. Downloaded books record where they came from and under what licence,
  and behave exactly like imported ones — tap-to-learn, nikkud, quizzes and
  cloze all work.
- **Titles in English** — every list of Hebrew titles, in the course and both
  live libraries, carries an English line under the Hebrew, so you can tell what
  a book is before opening it. Author names come from Wikidata and cost nothing;
  titles are translated with your AI key, one batched request per list, kept
  afterwards so the same shelf is never paid for twice. Switch it off in
  Settings.
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

### Regenerating the curriculum

`public/curriculum/` is generated and committed:

```bash
npm run build:curriculum
```

No key, no dump, no network — the only input is the hand-authored syllabus in
`scripts/curriculum/`, so the output is reproducible and the diff is readable.

The split matters. `scripts/curriculum/lessons-1.mjs` … `lessons-6.mjs` hold the
teaching: what each lesson explains, in what order, with which words. The build
script turns that into practice — every table becomes questions with the other
rows as distractors, every vocabulary list becomes recognition, production,
listening and typing drills, every verb table becomes a conjugation quiz. That
keeps the authoring small enough to check by hand while the exercise count stays
high: 941 vocabulary entries across 69 lessons expand to 1,437 exercises.

`vocab-1.mjs` … `vocab-3.mjs` hold the themed packs — concrete nouns, verbs and
abstractions, and the connective tissue. Each declares which lesson it follows,
and the build script splices it in there, so a word set arrives once the grammar
to use it exists. A pack's exercise count scales with its size, and the drills
that can't be passed by elimination — typing and sentence building — are held
back from the cap rather than trimmed by it.

Two data files are the exception and are written out by hand rather than
generated: `alphabet.mjs` (letters, finals, vowels, the dagesh) and `verbs.mjs`
(one fully-conjugated model verb per binyan). A general morphology engine would
be the tempting way to do the verbs and the wrong one — Hebrew's stem changes
depend on which consonants a root has, so an engine that looks right on כתב
quietly produces nonsense on a guttural or weak root. The model verbs are all
strong roots, so the patterns actually hold.

### Regenerating the graded readings

`public/course/` holds the frequency-graded corpus readings that each curriculum
level ends with. It is generated from the same dump as the shelf:

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

### English names and titles for the course

The course lists its readings by Hebrew title and author, which is no help to
the person the course is for. This fills both in:

```bash
npm run build:course:english
```

Author names come from `public/browse/authors.json` and need no key — that
alone names 55 of the 60. Titles need a provider key; with one, they are baked
in for every visitor:

```bash
OPENAI_API_KEY=sk-... npm run build:course:english
```

Without it the app translates titles in the browser instead, using the reader's
own AI key (Settings → *Titles in English*). Answers are batched one request per
list and kept in IndexedDB, so a shelf is never paid for twice. Re-running is
idempotent and only fills in what's missing.

### Regenerating the Ben-Yehuda writer directory

`public/browse/` is generated and committed, again from the same dump:

```bash
npm run build:authors -- --dump ./public_domain_dump
```

Ben-Yehuda's API can hand over any work by id but has no endpoint that lists
what it holds, and its search filters are undocumented — so the tab used to be a
search box you could only use if you already knew the answer. The dump's
catalogue supplies the missing index: this writes `authors.json` (504 writers
with 3+ works, named in English from Wikidata) plus one file per writer listing
every work and its id. Metadata only — around 2 MB of titles, no text — so
browsing costs no requests and no key; only the work you choose is fetched from
Ben-Yehuda. `--min-works` and `--max-works` tune the cut.

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
| ChatGPT (OpenAI) | [platform.openai.com](https://platform.openai.com/api-keys) | GPT-5.6 Luna (default), GPT-5.1, GPT-5 mini, GPT-4.1 |
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
into *Browse → Ben-Yehuda*; like the AI keys, it
is stored only in your browser and sent only to Ben-Yehuda. Their guidance is
to stay under 50 requests a minute, which ordinary reading never approaches.

The writer directory in that tab ships with the app, so you can browse all 504
writers and 25,624 works without a key — the key is only asked for when you
open one.

Sefaria and Hebrew Wikisource need no key. All three send open CORS headers,
so the app talks to them directly from the browser and stays a static site
with no server of its own.

## Project layout

```
index.html                 app shell
src/App.jsx                UI — reader, library, review, cloze, settings
src/Browse.jsx             browse & download from the free public-domain libraries
src/Course.jsx             the curriculum — levels, lessons, graded readings
src/Lesson.jsx             the lesson player and its six kinds of exercise
src/library.js             shelf + course + Sefaria / Wikisource / Ben-Yehuda / Wikibooks
public/shelf/              the graded offline shelf (generated, committed)
public/curriculum/         the taught course (generated, committed)
public/course/             frequency-graded readings (generated, committed)
public/browse/             the Ben-Yehuda writer directory (generated, committed)
scripts/build-shelf.mjs    regenerates the shelf from the Ben-Yehuda dump
scripts/build-course.mjs   regenerates the graded readings from the dump
scripts/build-curriculum.mjs  expands the syllabus into lessons and exercises
scripts/curriculum/        the syllabus — six levels, hand-authored
scripts/build-authors.mjs  regenerates the writer directory from the same dump
scripts/build-course-english.mjs  English names and titles for the course
src/titles.js              English for Hebrew titles — batched, cached, optional
scripts/lib/ask.mjs        shared Claude/OpenAI helper for the build scripts
scripts/lib/wikidata.mjs   English author names, shared by the build scripts
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
