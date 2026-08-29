/* Where each Hebrew word first appears in the course.

   The path is walkable, but it is also skippable: a placement test or a
   checkpoint test can open forty units without the learner ever answering a
   question inside them. Everything downstream then reads an empty word map and
   concludes they know nothing — so a lesson at unit 45 front-loads "New word"
   cards for vocabulary they have known for years, and the sentence weighing
   counts their whole vocabulary as unmet and marks perfectly readable lines as
   too hard.

   Seeding the word map instead would work, and would be wrong: it would invent
   two thousand review dates nobody earned and flood the practice queue with
   them. What is actually needed is smaller — the unit each word belongs to, so
   "have they been taught this?" can be answered from where they have reached
   rather than from what they have answered.

   Built from the generated unit files rather than the scraped bundle, so it is
   always consistent with the course as committed.

   Run: npm run build:lexicon
*/

import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "..", "public", "duo");
const bare = (s) => String(s || "").replace(/[֑-ׇ]/g, "").replace(/[^֐-׿0-9]/g, "");

const files = fs.readdirSync(OUT).filter((f) => /^unit-\d+\.json$/.test(f)).sort();
const first = new Map();
let sources = 0;

for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
  /* earliest wins, and the files are read in order, so the first write stands.

     A phrase is indexed as its words and not as itself. `bare` throws away
     everything that is not a Hebrew letter, spaces included, so "טו בשבט" used
     to arrive as one entry spelled טובשבט — a word nobody has ever written,
     which no real text can ever match, and which the reading drill then
     offered as a plausible wrong answer. Four hundred and fifty of those were
     in the index. Split first and both halves are findable. */
  const add = (phrase) => {
    for (const part of String(phrase || "").split(/[\s־]+/)) {
      const b = bare(part);
      if (b.length > 1 && !first.has(b)) first.set(b, d.unit);
    }
  };
  for (const w of d.words || []) { add(w.he); sources++; }
  for (const k of Object.keys(d.hints || {})) { add(k); sources++; }
  for (const l of d.lexemes || []) { add(typeof l === "string" ? l : l.he); sources++; }
}

const out = {};
for (const [w, u] of [...first].sort((a, b) => (a[1] - b[1]) || (a[0] < b[0] ? -1 : 1))) out[w] = u;
const json = JSON.stringify(out);
fs.writeFileSync(path.join(OUT, "lexicon.json"), json);

const byUnit = {};
for (const u of Object.values(out)) byUnit[u] = (byUnit[u] || 0) + 1;
const units = Object.keys(byUnit).length;
console.log(`lexicon: ${first.size} words from ${sources} mentions across ${units} units, ${(json.length / 1024).toFixed(1)} KB`);
console.log(`  cumulative by unit 10/25/50/84: ${[10, 25, 50, 84].map((n) =>
  Object.values(out).filter((u) => u <= n).length).join(" / ")}`);
