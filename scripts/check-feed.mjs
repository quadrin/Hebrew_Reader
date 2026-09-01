/* Does the feed still describe the course that is committed?

   The feed is harvested and scored once and then shipped, which means every
   number in it is a claim about a lexicon and a morphology that have since
   moved on. A word taught earlier, a stripping rule added, a unit re-ordered —
   any of them silently turns "readable from unit 96" into a sentence the
   learner cannot read, and nothing at runtime would notice.

   So this re-derives every shipped number from the committed lexicon, by the
   same rules the harvester scored with, and fails when they disagree. The fix
   is always the same and costs nothing but time: npm run build:feed, which
   reads its downloads back from .cache and re-scores them.

   Run: npm run check:feed
*/

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { weigh, freeWords, glossBudget, readable, MAX_TOKENS } from "./lib/feed.mjs";

const DUO = path.resolve(import.meta.dirname, "..", "public", "duo");
const FEED = path.join(DUO, "feed");
const lexicon = JSON.parse(fs.readFileSync(path.join(DUO, "lexicon.json"), "utf8"));

const problems = [];
const check = (label, ok) => { if (!ok) problems.push(label); };

if (!fs.existsSync(path.join(FEED, "index.json"))) {
  console.log("no feed built — run npm run build:feed");
  process.exit(1);
}
const index = JSON.parse(fs.readFileSync(path.join(FEED, "index.json"), "utf8"));

/* The licence is not decoration. Wikipedia text is CC BY-SA, which asks for
   attribution and a route back to the article, and the feed carries both or it
   should not be shipped. */
for (const field of ["source", "license", "attribution", "article", "band", "data"]) {
  check(`the feed index has no ${field}`, index[field] != null);
}
check("the feed does not name its licence as CC BY-SA", /CC BY-SA/.test(index.license || ""));
check("the feed's article link does not point at a wiki", /^https:\/\/\S+\/wiki\/$/.test(index.article || ""));

const files = fs.readdirSync(FEED).filter((f) => f !== "index.json").sort();
check("the feed index lists bands that are not there",
  Object.keys(index.bands || {}).length === files.length);

/* The stamp is how a phone learns that the bands it kept are the old ones. An
   index shipped with a stamp of bands other than the ones beside it tells it
   the opposite, and quietly, so it is checked here rather than found by a
   reader handed a page that is already finished. */
const stamp = crypto.createHash("sha1");
for (const f of files) stamp.update(fs.readFileSync(path.join(FEED, f)));
const said = stamp.digest("hex").slice(0, 12);
check(`the feed index is stamped ${index.data} and its bands hash to ${said}`, index.data === said);

let items = 0, lines = 0, words = 0, glossed = 0, misdated = 0;
const seen = new Set();
const byBand = [];

for (const file of files) {
  const band = JSON.parse(fs.readFileSync(path.join(FEED, file), "utf8"));
  check(`${file}: no range`, Number.isInteger(band.from) && Number.isInteger(band.to));
  check(`${file}: the index counts ${index.bands[band.from]} items and the file holds ${band.items?.length}`,
    index.bands[band.from] === band.items?.length);
  byBand.push([band.from, band.items.length]);

  for (const it of band.items) {
    items++;
    words += it.n;
    if (it.gloss.length) glossed++;

    check(`${file}: an item has no text`, typeof it.he === "string" && it.he.length > 0);
    check(`${file}: "${it.he.slice(0, 30)}…" names no article`, !!it.src);
    check(`${file}: "${it.he.slice(0, 30)}…" is dated ${it.at}, outside ${band.from}-${band.to}`,
      it.at >= band.from && it.at <= band.to);
    check(`${file}: "${it.he.slice(0, 30)}…" appears twice in the feed`, !seen.has(it.he));
    seen.add(it.he);

    /* What the cleaner is for: a line still carrying a Latin or Arabic run, or
       half a parenthesis, is a line the reader stumbles over for no reason. */
    check(`${file}: "${it.he.slice(0, 40)}…" still has foreign script or an open bracket`, readable(it.he));
    check(`${file}: "${it.he.slice(0, 30)}…" runs to ${it.n} words over ${it.lines} lines`,
      it.n <= MAX_TOKENS * it.lines);

    /* the page is a page: two sentences or more, each carrying its own score,
       and the whole of it is what the lines say it is */
    check(`${file}: "${it.src}" is one sentence, not a page`, it.lines >= 2);
    check(`${file}: "${it.src}" says ${it.lines} lines and carries ${it.text?.length}`,
      Array.isArray(it.text) && it.text.length === it.lines);
    check(`${file}: "${it.src}" starts at line ${it.from}`, Number.isInteger(it.from) && it.from >= 0);
    check(`${file}: "${it.src}" is not its own lines joined up`,
      (it.text || []).map((l) => l.he).join(" ") === it.he);

    /* and the claim itself, line by line and then whole */
    const free = freeWords(it.src, lexicon);
    for (const line of it.text || []) {
      const lw = weigh(line.he, free, lexicon);
      check(`${file}: "${line.he.slice(0, 26)}…" is shipped at unit ${line.at} and now scores ${lw.at}`, lw.at === line.at);
      check(`${file}: "${line.he.slice(0, 26)}…" now needs ${lw.gloss.length} glossed, not ${line.gloss.length}`,
        lw.gloss.length === line.gloss.length && lw.gloss.every((g) => line.gloss.includes(g)));
      lines++;
    }

    const w = weigh(it.he, free, lexicon);
    if (w.at !== it.at) misdated++;
    check(`${file}: "${it.src}" is shipped as unit ${it.at}, and now scores ${w.at}`, w.at === it.at);
    check(`${file}: "${it.src}" is shipped with ${it.n} words and now counts ${w.n}`, w.n === it.n);
    check(`${file}: "${it.src}" now needs ${w.gloss.length} words glossed, not ${it.gloss.length}`,
      w.gloss.length === it.gloss.length && w.gloss.every((g) => it.gloss.includes(g)));
    check(`${file}: "${it.src}" leaves ${it.gloss.length} words to gloss over ${it.n}`,
      it.gloss.length <= glossBudget(it.n));
  }
}

console.log(`checked ${items} article pages, ${lines} lines, ${words} words, over ${files.length} bands`);
console.log(`  ${byBand.map(([f, n]) => `${f}:${n}`).join("  ")}`);
console.log(`  ${items - glossed} need no gloss at all, ${glossed} carry one to three words`);
if (misdated) console.log(`  ${misdated} items no longer date where they were shipped`);

check("the feed is too thin to read from", items >= 200);
check("no page runs to more than one sentence", items === 0 || lines > items);

if (problems.length) {
  const shown = problems.slice(0, 25);
  console.log(`\n${problems.length} problems:`);
  for (const p of shown) console.log("  " + p);
  if (problems.length > shown.length) console.log(`  … and ${problems.length - shown.length} more`);
  console.log("\n  npm run build:feed re-scores what it already downloaded.");
  process.exit(1);
}
console.log("\nno problems");
