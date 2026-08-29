/* Are the unit-closing passages readable by the unit that closes with them?

   A passage's whole claim is that you can read it with what you have been
   taught — that is the difference between a text and a wall. So this measures
   it rather than trusting it: every word of every passage is looked for in the
   cumulative vocabulary of its own unit and the ones before it, and a passage
   that drops below the threshold fails the build.

   What counts as taught, for a unit and everything under it:
     - the words the unit introduces (`words` in its data file), and
     - every word in the sentences the unit drills, since those sentences are
       what its lessons are built from and the learner meets them there.

   Hebrew writes several prepositions, the article and the conjunction as
   prefixes and its possessives as suffixes, so a token is also covered when
   what it is standing in for is taught: בבית by בית, ולילד by ילד, בירתה by
   בירה. The forms come from the same module the app weighs sentences with, so
   this measures the passages by the rule the learner is actually held to. A
   name the
   passage declares is exempt — nobody is taught דני — but it has to be
   declared, so a passage cannot quietly smuggle in vocabulary as a name.

   Run: npm run check:passages
*/

import fs from "node:fs";
import path from "node:path";

import { PASSAGES, PASSAGE_UNITS } from "../src/duo/passages.js";
import { heForms } from "../src/duo/morph.js";

const DUO = "public/duo";
const THRESHOLD = 0.95;

const strip = (w) => w.replace(/[֑-ׇ]/g, "").replace(/[.,!?;:"'׳״()–—“”]/g, "").trim();
const words = (s) => String(s).split(/\s+/).map(strip).filter(Boolean);

function taughtBy(unit) {
  const set = new Set();
  for (let u = 1; u <= unit; u++) {
    const f = path.join(DUO, `unit-${String(u).padStart(3, "0")}.json`);
    if (!fs.existsSync(f)) continue;
    const d = JSON.parse(fs.readFileSync(f, "utf8"));
    for (const w of d.words || []) for (const t of words(w.he)) set.add(t);
    for (const s of d.sentences || []) for (const t of words(s.he)) set.add(t);
    for (const p of d.phrases || []) for (const t of words(p.he)) set.add(t);
  }
  return set;
}

/* covered outright, or covered by any form it could be standing in for —
   including a name, since לדני is as exempt as דני */
function covered(token, taught, names) {
  for (const f of heForms(token)) if (taught.has(f) || names.has(f)) return true;
  return false;
}

const problems = [];
let passages = 0, lines = 0, questions = 0;
const report = [];

for (const unit of PASSAGE_UNITS) {
  const p = PASSAGES[unit];
  if (!p) { problems.push(`unit ${unit} is listed but has no passage`); continue; }
  passages++;
  const taught = taughtBy(unit);
  const names = new Set((p.names || []).flatMap(words));

  let known = 0, total = 0;
  const unknown = [];
  for (const line of p.lines) {
    lines++;
    for (const t of words(line.he)) {
      if (names.has(t)) continue;          /* declared names are exempt */
      total++;
      if (covered(t, taught, names)) known++;
      else unknown.push(t);
    }
    if (!line.en) problems.push(`unit ${unit}: a line has no English`);
  }

  const pct = total ? known / total : 1;
  report.push(`  unit ${String(unit).padStart(2)}  ${String(p.lines.length).padStart(2)} lines  ${(pct * 100).toFixed(1)}% known` +
    (unknown.length ? `  · outside: ${[...new Set(unknown)].join(" ")}` : ""));
  if (pct < THRESHOLD) {
    problems.push(`unit ${unit}: only ${(pct * 100).toFixed(1)}% of the passage is taught by unit ${unit} ` +
      `(need ${THRESHOLD * 100}%) — outside: ${[...new Set(unknown)].join(" ")}`);
  }

  /* the questions have to be answerable from the passage, which at minimum
     means the evidence they cite is actually a line of it */
  const heLines = p.lines.map((l) => strip(l.he));
  for (const q of p.questions || []) {
    questions++;
    if (!q.q) problems.push(`unit ${unit}: a question has no text`);
    if (!Array.isArray(q.opts) || q.opts.length < 3) problems.push(`unit ${unit}: "${q.q}" needs at least three options`);
    if (typeof q.correct !== "number" || !q.opts?.[q.correct]) problems.push(`unit ${unit}: "${q.q}" has no right answer`);
    if (new Set(q.opts || []).size !== (q.opts || []).length) problems.push(`unit ${unit}: "${q.q}" repeats an option`);
    if (q.ev && !heLines.some((l) => l.includes(strip(q.ev)))) {
      problems.push(`unit ${unit}: "${q.q}" cites evidence that is not in the passage: ${q.ev}`);
    }
  }
  if ((p.questions || []).length < 2) problems.push(`unit ${unit}: a passage needs at least two questions`);
  if (!p.titleEn) problems.push(`unit ${unit}: no English title`);
}

console.log(`checked ${passages} passages, ${lines} lines, ${questions} questions`);
console.log(report.join("\n"));

if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log("\nno problems");
