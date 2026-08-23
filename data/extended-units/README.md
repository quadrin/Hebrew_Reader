# Units 85–240 — written, not scraped

Duolingo's Hebrew tree ends at unit 84 and at early A2. That is a fine place to
stop being a beginner and a poor place to stop, because the shelf this app is
built around — Bialik, Brenner, Agnon, a century of public-domain prose — is
not readable from there. These 156 units carry the path the rest of the way: to
a page of real Hebrew by unit 160, and past it to living in the language.

**Nothing here is Duolingo's.** The scraped bundle in `../duolingo-hebrew-tree/`
is theirs and is not ours to relicense; these files were written for this
repository and carry no scraped sentence, phrase, gloss or recording. They are
kept in `data/` rather than in `public/duo/` for the obvious reason: a
directory that gets rebuilt is no place to keep the only copy of something.

`npm run build:duo` copies each file into `public/duo/` unchanged and plans it
onto the path with the same `planCards` the scraped units use — same split
rule, same node shape, same session builder downstream. Nothing after the build
knows or cares which units these are.

`rows.json` says which units stand side by side. The legacy tree put one to
three related skills in a centred row, and that grouping is what makes the path
read as a tree instead of a column; the scraped cards inherit it from the tree
itself, and there is no tree behind these units, so it is written down here
instead — the past-tense binyanim abreast, the two passives abreast, the three
listening units abreast, the three that read Bialik, Brenner and Agnon abreast,
a section review standing alone. 73 rows over the 156 units: fifteen of one,
thirty-three of two, twenty-five of three.

The build checks it rather than trusting it. A row has to hold one to three
units and they have to be consecutive, because the layout pass walks the cards
in order and starts a new row when the number changes — so a group that skipped
a unit would quietly come out as two rows, and a group of four would quietly
lose its last card to the row below. A unit missing from the file stands on its
own, which is the right way to be wrong: it shows up on the path rather than
displacing something.

## What is here

| Section | Units | CEFR | What it covers |
|---|---|---|---|
| 4 · Navigator | 85–112 | A2 | The rest of the binyanim in past and future, the weak roots, relative and purpose clauses, the passives, word patterns, and the vocabulary of a life — cooking, shopping, health, transport, housing, the digital world |
| 5 · Storyteller | 113–140 | B1 | Attached pronouns, conditionals, participles, verbal nouns, the biblical registers, formal Hebrew, slang, and the vocabulary of argument — law, business, media, history, academia, poetry |
| 6 · Reader | 141–160 | B1 | Loanwords, root families, complex syntax, literary devices, and units that read the writers themselves: Bialik, Brenner, Agnon, Amichai |
| 7 · Local | 161–180 | B1 | The gap between reading a page and living here: the doctor, the bank, the lease, the shuk, the army, the news — then the idioms, the slang, the filler words and the directness that make a conversation sound like one |
| 8 · Citizen | 181–200 | B2 | Morphology, syntax and register as systems — the mishkalim, what the binyanim do to one root, denominal verbs, word order, discourse markers, and the formal, legal, academic and bureaucratic Hebrew a citizen has to read |
| 9 · Native Ear | 201–220 | B2 | Comprehension at speed and across registers: news, conversation and lecture by ear; Mishnaic through Keret by period; recipes, talkbacks, contracts, medicine inserts, comics, and four units of unassisted reading |
| 10 · Fluent | 221–240 | C1 | The ceiling — abstract vocabulary, philosophy, psychology, science, criticism and rhetoric; register switching; the mistakes that mark a learner; and essay, academic and literary prose read cold |

Sentences per unit run 30–60; every unit carries 4–5 key phrases, 15–35 glossed
words, a tap-hint for every Hebrew word its sentences use, and — except the
handful that are vocabulary only — grammar notes in markdown. 6,329 sentences
and 3,426 glossed words in all.

No unit here carries an `audio` URL. The 338 recordings in the course all came
from the scrape's guidebooks, so `audio` is `""` throughout and the line is
spoken instead — by `npm run build:audio`'s recording of it where that has been
run, and otherwise by the voice the app generates in the browser, exactly as
for the 7,000-odd scraped sentences that have no recording either. Leave the
field empty: it is for a recording somebody else made, and the build keeps its
own index rather than writing back into these files.

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
card in the course — 1,494 of them, 23,338 exercises — and fails on a unit that
cannot fill a lesson, an exercise with no right answer, a word bank missing one
of its own answer tokens, or a multiple choice whose options do not contain
what it is asking for. Run it after touching anything here.
