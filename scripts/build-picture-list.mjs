/* build-picture-list.mjs — the pictures the course still wants, as a list an
   image model can be handed.

   The pictures the scrape found are Wikipedia lead images: right for a thing,
   wrong for everything else, and in a dozen different photographic styles. A
   drawn illustration can show "cold", "sit" and "behind", and drawn to one
   brief the whole course looks like one course. So the plan is to draw all of
   them, and `data/pictures-wanted/` names, by hand, every word worth a picture
   and the scene for each: `style.json` is the brief every image is drawn to,
   and the numbered files are the words, grouped by where they came from.

   This joins that list to the course — the Hebrew, the unit the word is taught
   in, the key the picture index files it under, the file name to save it as —
   and writes the ones still wanting a picture to Markdown, in batches sized
   for a chat window. A word whose picture has been drawn and filed drops out,
   so the list shrinks as it is worked through and the file is worth
   regenerating after every batch.

   In:  data/pictures-wanted/*.json      (the brief, and the words)
        public/duo/unit-NNN.json         (the vocabulary, for Hebrew and unit)
        public/duo/images.json           (what has a picture already)
   Out: data/PICTURES-WANTED.md

   Run: node scripts/build-picture-list.mjs */

import fs from "node:fs";
import path from "node:path";

import { glossKey } from "../src/duo/images.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const DUO = path.join(ROOT, "public", "duo");
const WANTED = path.join(ROOT, "data", "pictures-wanted");
const OUT = path.join(ROOT, "data", "PICTURES-WANTED.md");
const BATCH = 25;

const { style } = JSON.parse(fs.readFileSync(path.join(WANTED, "style.json"), "utf8"));
const images = JSON.parse(fs.readFileSync(path.join(DUO, "images.json"), "utf8"));

/* every batch file, in name order, as one list */
/* A file marked `redraw` holds words whose picture came back wrong — the
   image model read the other meaning of the English gloss, and the app is now
   asking "which one of these is lie?" over a bed. Its prompts replace the
   ones that produced the wrong picture, and the word is wanted again however
   firmly the index says it is drawn. So a later file wins; everywhere else a
   key twice is a mistake, and still reported as one. */
const files = fs.readdirSync(WANTED).filter((f) => /^\d.*\.json$/.test(f)).sort();
const items = [];
for (const f of files) {
  const doc = JSON.parse(fs.readFileSync(path.join(WANTED, f), "utf8"));
  for (const [en, prompt] of doc.items || []) items.push({ en, prompt, from: f, redraw: !!doc.redraw });
}

/* The file name the picture is saved under. Every picture the scrape filed is
   already named this way, so a replacement overwrites its predecessor rather
   than leaving an orphan behind for check:duo to find. */
const fileFor = (key) => key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* Every way a course word can be reached from a gloss, which is the lookup
   pictureFor does: the whole gloss, and each sense inside it. Built over the
   course so a hand-written "hot" finds חַם, glossed "hot, warm (masculine
   singular)". First unit wins, since that is where the word is taught. */
const course = new Map();
const file = (key, word, unit) => {
  if (key && !course.has(key)) course.set(key, { he: word.he, en: word.en, unit });
};
for (let n = 1; n <= 240; n++) {
  const p = path.join(DUO, `unit-${String(n).padStart(3, "0")}.json`);
  if (!fs.existsSync(p)) continue;
  const doc = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const w of doc.words || []) {
    if (!w.he || !w.en) continue;
    file(glossKey(w.en), w, n);
    for (const sense of String(w.en).split(/[/,;]/)) file(glossKey(sense), w, n);
  }
}

const rows = [];
const problems = [];
const seen = new Map();
for (const it of items) {
  const key = glossKey(it.en);
  if (!key) { problems.push(`${it.from}: "${it.en}" tidies down to nothing`); continue; }
  const already = seen.get(key);
  if (already && !it.redraw) { problems.push(`${it.from}: "${it.en}" files under "${key}", already listed in ${already.from}`); continue; }
  if (already) rows.splice(rows.indexOf(already.row), 1);
  const hit = course.get(key);
  if (!hit) { problems.push(`${it.from}: "${it.en}" is not a gloss the course teaches`); continue; }
  const row = {
    ...it, key, he: hit.he, unit: hit.unit, file: fileFor(key),
    done: !!images[key]?.gen && !it.redraw,
    replaces: images[key] && !images[key].gen ? images[key].src : "",
  };
  seen.set(key, { from: it.from, row });
  rows.push(row);
}

if (problems.length) {
  console.error(`${problems.length} problems:\n  ${problems.slice(0, 30).join("\n  ")}`);
  process.exit(1);
}

rows.sort((a, b) => a.unit - b.unit || a.en.localeCompare(b.en));
const wanted = rows.filter((r) => !r.done);
const done = rows.length - wanted.length;
/* a picture still showing a scraped photograph, which the new one replaces */
const replacing = wanted.filter((r) => r.replaces).length;
const redrawing = wanted.filter((r) => r.redraw).length;

const md = [];
md.push("# Pictures wanted");
md.push("");
md.push(`${wanted.length} of ${rows.length} words still want a picture; ${done} are drawn and in the app. ${replacing} of the ones left already show a scraped photograph, which the new image replaces, and ${redrawing} are marked \u26a0 — drawn already, but the image came back showing the other meaning of the English word, so the prompt has been rewritten to rule that reading out.`);
md.push("");
md.push("Generated by `scripts/build-picture-list.mjs` from `data/pictures-wanted/`; edit those files, not this one, and run it again after every batch — words that have been drawn drop out.");
md.push("");
md.push("## How to use this");
md.push("");
md.push("1. Paste the **Style** paragraph and one **Batch** into ChatGPT (or any image model) and ask for one square image per line.");
md.push("2. Save each image under the **file** name given, as a 256×256 WebP, into `public/duo/img/`. Where the row is marked ↻ the file is already there and is overwritten, which is the point: the scraped photograph goes. A row marked ⚠ overwrites a drawing that came out wrong, and its prompt says what the picture must not be — keep that part.");
md.push("3. Add or replace the entry in `public/duo/images.json` under the **key** given:");
md.push("");
md.push("   ```json");
md.push('   "cold": { "f": "cold", "gen": true, "by": "OpenAI image generation", "lic": "Generated image", "src": "ChatGPT, from data/pictures-wanted" }');
md.push("   ```");
md.push("");
md.push("   `gen: true` is what makes the picture count: many of these keys are on the list of scraped pictures the course hides (`src/duo/vaguePictures.js`), and the flag says this one is drawn and is to be shown. `lic` and `src` must both be filled in, or `npm run check:duo` will complain.");
md.push("4. Run `node scripts/build-picture-list.mjs` to shrink this file, then `npm run check:duo`. The lesson builder and the word drill pick the new pictures up on their own.");
md.push("");
md.push("## Style");
md.push("");
md.push(style);
md.push("");
md.push("Where a prompt below asks for a numeral or for letters — the numbers, the alphabets, the vowel marks — that prompt overrides the blanket rule against text, and nothing else in the image carries any.");
md.push("");

for (let i = 0; i < wanted.length; i += BATCH) {
  const batch = wanted.slice(i, i + BATCH);
  md.push(`## Batch ${Math.floor(i / BATCH) + 1} — units ${batch[0].unit} to ${batch[batch.length - 1].unit}`);
  md.push("");
  md.push("| # | word | Hebrew | unit | key | file | prompt |");
  md.push("|---|---|---|---|---|---|---|");
  batch.forEach((r, j) => {
    md.push(`| ${i + j + 1}${r.redraw ? " ⚠" : r.replaces ? " ↻" : ""} | ${r.en} | ${r.he} | ${r.unit} | \`${r.key}\` | \`${r.file}.webp\` | ${r.prompt} |`);
  });
  md.push("");
  md.push("Prompts for this batch, one per line:");
  md.push("");
  batch.forEach((r, j) => md.push(`${i + j + 1}. ${r.file}: ${r.prompt}`));
  md.push("");
}

fs.writeFileSync(OUT, md.join("\n"));
console.log(`${rows.length} words listed across ${files.length} files: ${done} drawn, ${wanted.length} wanted (${replacing} replacing a photograph, ${redrawing} redrawing a wrong one)`);
console.log(`wrote ${Math.ceil(wanted.length / BATCH)} batches to ${path.relative(ROOT, OUT)}`);
