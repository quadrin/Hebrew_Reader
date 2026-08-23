# Units 85–160 — written, not scraped

Duolingo's Hebrew tree ends at unit 84 and at early A2. That is a fine place to
stop being a beginner and a poor place to stop, because the shelf this app is
built around — Bialik, Brenner, Agnon, a century of public-domain prose — is
not readable from there. These 76 units carry the path the rest of the way, to
B1 and to a page of real Hebrew.

**Nothing here is Duolingo's.** The scraped bundle in `../duolingo-hebrew-tree/`
is theirs and is not ours to relicense; these files were written for this
repository and carry no scraped sentence, phrase, gloss or recording. They are
kept in `data/` rather than in `public/duo/` for the obvious reason: a
directory that gets rebuilt is no place to keep the only copy of something.

`npm run build:duo` copies each file into `public/duo/` unchanged and plans it
onto the path with the same `planCards` the scraped units use — same split
rule, same node shape, same session builder downstream. Nothing after the build
knows or cares which units these are.

## What is here

| Section | Units | CEFR | What it covers |
|---|---|---|---|
| 4 · Navigator | 85–112 | A2 | The rest of the binyanim in past and future, the weak roots, relative and purpose clauses, the passives, word patterns, and the vocabulary of a life — cooking, shopping, health, transport, housing, the digital world |
| 5 · Storyteller | 113–140 | B1 | Attached pronouns, conditionals, participles, verbal nouns, the biblical registers, formal Hebrew, slang, and the vocabulary of argument — law, business, media, history, academia, poetry |
| 6 · Reader | 141–160 | B1 | Loanwords, root families, complex syntax, literary devices, and units that read the writers themselves: Bialik, Brenner, Agnon, Amichai |

Sentences per unit run 30–60; every unit carries 4–5 key phrases, 15–35 glossed
words, a tap-hint for every Hebrew word its sentences use, and — except the
handful that are vocabulary only — grammar notes in markdown.

No unit has audio. The 338 recordings in the course all came from the scrape's
guidebooks, and there is no honest way to add more without recording them, so
`audio` is `""` throughout and the app falls back to speech synthesis, exactly
as it does for the 7,000-odd scraped sentences that have no recording either.

## The file format

One file per unit, `unit-NNN.json`, three-digit zero-padded, matching the
`unit` field inside. The shape is the same one `build-duo.mjs` writes for a
scraped unit, which is what lets the two be indistinguishable downstream:

```json
{
  "unit": 85,
  "section": 4,
  "cefr": "A2",
  "objective": "use past tense Pi'el verbs",
  "skill": "Past Pi'el",
  "heading": "Use past tense Pi'el verbs",
  "phrases": [
    { "he": "הוא דיבר איתי אתמול.", "en": "He spoke with me yesterday.", "audio": "",
      "tokens": [{ "w": "דיבר", "h": ["spoke", "talked"] }] }
  ],
  "sentences": [
    { "he": "הוא דיבר איתי.", "en": "He spoke with me.", "alt": ["He talked to me."], "t": "t" }
  ],
  "hints": { "דיבר": "spoke / talked" },
  "words": [
    { "he": "דיבר", "en": "spoke", "alt": ["talked"], "from": "lexicon", "tr": "diber" }
  ],
  "lexemes": ["דיבר", "דיברה", "דיברתי"],
  "tips": "## Pi'el Past Tense …"
}
```

| Field | Rule |
|---|---|
| `phrases` | 4–5. `audio` is `""`. `tokens` gloss the words worth tapping |
| `sentences` | 30–60. `t` is `"t"` to translate or `"l"` to listen, roughly 70/30 |
| `hints` | Every unique Hebrew word the sentences use, glossed. ` / ` separates senses |
| `words` | 15–35. `from` is `"lexicon"` for the unit's own vocabulary, `"skill"` for its other forms, `"phrase"` for a word a key phrase introduced |
| `lexemes` | Every new form the unit introduces, conjugations included |
| `tips` | Markdown, or `""` for a unit that only teaches words |

Two rules are not in the schema and matter more than the ones that are.
**Sentences use this unit's words and words already taught**, because a
sentence built from a word the path has not reached yet is a sentence the
learner cannot read. And `hints` has to be complete: a word missing from it is
a word that cannot be tapped, in a course whose whole premise is that anything
can be.

`npm run check:duo` is what enforces the rest. It builds a session for every
card in the course — 998 of them, 15,550 exercises — and fails on a unit that
cannot fill a lesson, an exercise with no right answer, a word bank missing one
of its own answer tokens, or a multiple choice whose options do not contain
what it is asking for. Run it after touching anything here.
