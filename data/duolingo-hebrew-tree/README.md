# Duolingo Hebrew (from English) — scraped course data

Scraped 2026-08-15 to 2026-08-16. Course version **1.4**, published 2025-07-08, CEFR early A2.
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
| `09_vocab_pdf_glosses.csv` | 3,542 | English + transliteration for Hebrew words, parsed from a community vocabulary PDF |
| `10_forum_sentences.csv` | 1,885 | Sentences recovered from archived Duolingo forum threads (includes retired ones) |
| `11_sentence_bank.csv` | **7,723** | **The course sentence bank — aligned Hebrew/English pairs from Duolingo's session API** |
| `duolingo_hebrew_tree.json` | — | All of the above in one nested document |
| `duolingo_hebrew_tree_explorer.html` | — | Self-contained browser: tree diagram, unit cards, searchable tables, playable audio |
| `harvest_sentences.py` | — | Script to pull the complete sentence bank from Duolingo with your own account token |

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
| `archive.org/details/duolingo-forum-archive` | 3.5 GB dump of the dead Duolingo forum — sentence discussions |
| `duolinguists.wordpress.com` vocab PDF | English glosses + transliteration by skill |

`duolingodata.com` is a one-person archive maintained by "Mat!/Ozone". The dumps are
snapshots of one account's view of a course version, so progress fields
(`state`, `finishedSessions`, `strength`) describe that account, not the course. Ignore them.

## The sentence bank

The course reports **8,305 sentences**. `11_sentence_bank.csv` has **7,723** of them —
93% — as aligned Hebrew/English pairs, each carrying Duolingo's own `solution_key`, which
is the sentence's identity in their system. All 7,723 keys are distinct.

They came from `POST /2017-06-30/sessions`, the endpoint the app itself uses to start a
lesson, called with the account owner's token from inside their browser. Two details made
it work:

* From a datacenter IP the endpoint returns **403 Access Denied** regardless of the token —
  that is a WAF block, not an auth failure. The same call from the account's own browser
  returns 200.
* `type: "LESSON"` fails with a **500** unless `levelSessionIndex` is present. Adding it
  raised the yield from 9 challenges per call to 17. `LEVEL_REVIEW` and `GLOBAL_PRACTICE`
  also work and were mixed in, since practice sessions sample the whole course.

Two sweeps, 2,548 requests at ~1.2s apart, 188 failed (7%). Duolingo samples challenges
randomly, so each pass over the same lesson returns different sentences; the sweeps ran
until new-sentence yield fell off:

| pass | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| sweep 1 (+new) | 1506 | 1397 | 1275 | 292 | 282 | 286 | — | — |
| sweep 2 (+new) | 1537 | 2130 | 1057 | 1006 | 716 | 583 | 233 | 221 |

Merged and deduplicated by `solution_key`, then by text pair: **7,723**.

`translate` challenges supply 4,758 of them, `listenTap` 2,539, `assist` 426. 6,731 rows
carry a unit number; the remaining 992 came from whole-course practice, which doesn't
report one.

### The forum archive (kept for what it adds)

Before the API route was found, the dead Duolingo forum was mined instead. Every sentence
once had an auto-created discussion thread, and [rebane2001's archive](https://archive.org/details/duolingo-forum-archive)
preserved 2.1M of them. Streaming that 3.5 GB dump twice yielded 1,885 Hebrew sentence
discussions (topic 932). A second pass with a different filter — any Hebrew-lettered title,
any topic — returned 5,769 threads, of which 4,394 are the **Yiddish** course (same
alphabet) and none were Hebrew threads the first pass had missed.

Each forum thread preserves only the side the learner was shown, so those rows are not
aligned pairs. They are kept because **161 Hebrew sentences and 235 English ones in them
never appeared in any API sweep** — retired sentences the live course no longer serves.
Combined distinct Hebrew sentences across both sources: **7,828**.

Routes checked and closed: the 44 guidebooks from the older 56-unit course version (361
phrases, all already present); `web.archive.org` (blocked from this environment);
`duome.eu` (403 to non-browser clients); the stories API (401); the alphabets and
dictionary endpoints (both redirect to the homepage).

## Known gaps

* **Translations are partial.** 46% of the 2,939 lexemes now carry an English gloss —
  393 from guidebook tap-hints, the rest matched against a community vocabulary PDF.
  Duolingo's own translation endpoints are dead and duome.eu blocks non-browser clients.
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
| Sentences | 7,723 aligned pairs | 8,305 | 93%, by distinct solution_key |

Forum mining stats: 2,102,922 threads streamed, 4,197 in the Hebrew course forum,
1,885 of those are auto-created sentence discussions, 0 read errors.

The Hebrew in `09_vocab_pdf_glosses.csv` comes out of the PDF in visual order and is
reversed back by grapheme cluster so niqud stays on the right letter. Two independent
checks that it worked: 1,175 of those forms also appear in Duolingo's own lexeme list,
and 988 appear in the forum sentences.

## Licence and use

This is scraped third-party course content. Duolingo owns it. Treat the bundle as a
research and archival artefact, not something to republish as your own course.
