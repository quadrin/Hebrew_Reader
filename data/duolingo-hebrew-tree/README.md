# Duolingo Hebrew (from English) — scraped course data

Scraped 2026-08-15. Course version **1.4**, published 2025-07-08, CEFR early A2.
Course ID `DUOLINGO_HE_EN`, direction `he ← en`.

The bundle covers both shapes the course has had:

* the **Path** that is live today — 4 sections, 84 units, 534 nodes;
* the **legacy skill tree** it was built from — 40 rows, 87 skills, 4 checkpoints.

The two are the same content. Duolingo kept the old skill objects inside the course
payload after the 2022 redesign, so each Path unit still carries the ID of the skill
it came from.

## Files

| File | Rows | What it holds |
|---|---|---|
| `01_legacy_tree_skills.csv` | 87 | Tree topology: row, position in row, skill name, URL slug, lesson count, crown levels, bonus flag |
| `02_legacy_tree_checkpoints.csv` | 5 | The 4 checkpoint blocks, plus the 2 skills that sat past the last checkpoint |
| `03_path_units.csv` | 85 | Current units: section, CEFR band, teaching objective, node counts, guidebook URL |
| `04_path_levels.csv` | 534 | Every node: skill / practice / chest / unit_review, session count, crown level, skill ID |
| `05_key_phrases.csv` | 367 | Hebrew ↔ English phrases from all 84 unit guidebooks, each with a Duolingo audio URL |
| `06_lexicon_glossed.csv` | 915 | Word-level Hebrew → English glosses lifted from the tap-hints inside those phrases |
| `07_vocabulary_by_skill.csv` | 2,939 | The full lexeme list, each mapped to the skill that introduced it |
| `08_tips_and_notes.md` | 66 skills | The grammar notes Duolingo deleted from the app, including the alphabet and conjugation tables |
| `duolingo_hebrew_tree.json` | — | All of the above in one nested document |
| `duolingo_hebrew_tree_explorer.html` | — | Self-contained browser: tree diagram, unit cards, searchable tables, playable audio |

Row 85 of `03_path_units.csv` is the Daily Refresh node, not a real unit. Filter it out
if you want the 84 that count.

## Where it came from

| Source | Used for |
|---|---|
| `duolingodata.com/json/hefen84.7z` | Course payload v1.4 — tree, path, Tips & Notes |
| `duolingodata.com/json/hefen56.7z` | Older payload (56-unit path) + the 2,939-lexeme word list |
| `d1btvuu4dwu627.cloudfront.net/guidebook/…` | 84 live unit guidebooks — key phrases, glosses, audio |
| `duolingodata.com/dat/hefen84v2.html` | CEFR band per section |
| `ardslot.com/duolingocrowns.html` | Cross-check of the crowns-era figures |

`duolingodata.com` is a one-person archive maintained by "Mat!/Ozone". The dumps are
snapshots of one account's view of a course version, so progress fields
(`state`, `finishedSessions`, `strength`) describe that account, not the course. Ignore them.

## Known gaps

* **Translations are partial.** Only 393 of the 2,939 lexemes have an English gloss.
  Duolingo's `dictionary_page` and `dictionary/hints` endpoints both return 404 now, and
  duome.eu blocks non-browser clients, so word-level English exists only where a guidebook
  phrase happened to contain that surface form.
* **No sentence bank.** The course reports 8,305 sentences. They live behind the session
  API and are not in any public dump. The 367 guidebook phrases are what is reachable.
* **21 skills never had Tips & Notes** — the three bonus skills plus Food 2, Weather,
  Places, Objects, Feelings, Geometry, Religion, Arts, Science, Sports, Politics and others
  added late in the tree's life.
* **Audio URLs are live CDN links.** They work now; they are not archived here.

## Count checks

| Figure | This dataset | Published | Note |
|---|---|---|---|
| Path units | 84 (+1 Daily Refresh) | 84 | matches |
| Legacy skills | 87 (84 normal + 3 bonus) | 84 | the crowns table counts normal skills only |
| Tree rows | 40 | 39 max_tree_level | tracking field is 0-indexed |
| Lessons in path | 1,628 excluding chests | 1,622 | site counts slightly differently |
| Legacy lessons | 453 (446 excluding bonus) | 446 | matches once bonus skills are removed |
| Vocabulary | 2,939 | 2,874 `numberOfWords` / 2,833 crowns table | the dump's list is the larger one |

## Licence and use

This is scraped third-party course content. Duolingo owns it. Treat the bundle as a
research and archival artefact, not something to republish as your own course.
