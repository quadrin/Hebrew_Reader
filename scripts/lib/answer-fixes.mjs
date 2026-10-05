/* The answer fixes in data/answer-fixes.json, applied to the unit files.

   Learners report answers they think were marked wrong unfairly (see
   docs/answer-reports.md). A report that holds up becomes an entry here: more
   English accepted for a sentence, more Hebrew accepted, or the course's own
   English corrected. Like the gloss corrections in senses.mjs, they are kept
   apart from the scrape and the extended units and put back on every build,
   last, so no pass can undo one.

   One pass over every unit file in `dir`. Returns what changed, as
   "unit: Hebrew — what" lines, and rewrites only the files that did. */

import fs from "node:fs";
import path from "node:path";

const TABLE = path.resolve(import.meta.dirname, "..", "..", "data", "answer-fixes.json");

/* vowel points off and spacing evened, which is how the table is written */
const plain = (s) => String(s || "").replace(/[֑-ׇ]/g, "").replace(/\s+/g, " ").trim();
const key = (s) => plain(s).toLowerCase();

export function readAnswerFixes(file = TABLE) {
  const { fixes } = JSON.parse(fs.readFileSync(file, "utf8"));
  return fixes.map((f) => ({ ...f, he: plain(f.he) }));
}

/* Each list keeps its order and gains only what it does not already hold,
   compared without case, vowel points or extra spaces. */
const addTo = (list, more, also = []) => {
  const seen = new Set([...list, ...also].map(key));
  const added = [];
  for (const m of more || []) {
    const t = String(m || "").replace(/\s+/g, " ").trim();
    if (t && !seen.has(key(t))) { seen.add(key(t)); list.push(t); added.push(t); }
  }
  return added;
};

export function fixUnit(doc, table) {
  const changed = [];
  for (const s of [...(doc.phrases || []), ...(doc.sentences || [])]) {
    const h = plain(s.he);
    for (const f of table) {
      if (f.he !== h || (f.units && !f.units.includes(doc.unit))) continue;
      if (f.en && f.en !== s.en) {
        changed.push(`${doc.unit}: ${h} — English "${s.en}" → "${f.en}"`);
        s.alt = (s.alt || []).filter((a) => key(a) !== key(f.en));
        s.en = f.en;
      }
      if (f.acceptEn?.length) {
        s.alt = s.alt || [];
        const added = addTo(s.alt, f.acceptEn, [s.en]);
        if (added.length) changed.push(`${doc.unit}: ${h} — accepts ${added.map((a) => `"${a}"`).join(", ")}`);
      }
      if (f.acceptHe?.length) {
        s.heAlt = s.heAlt || [];
        const added = addTo(s.heAlt, f.acceptHe.map(plain), [h]);
        if (added.length) changed.push(`${doc.unit}: ${h} — accepts ${added.join(", ")}`);
        if (!s.heAlt.length) delete s.heAlt;
      }
    }
  }
  return changed;
}

export function applyAnswerFixes(dir, table = readAnswerFixes()) {
  const changed = [];
  for (const f of fs.readdirSync(dir).filter((x) => /^unit-\d+\.json$/.test(x)).sort()) {
    const file = path.join(dir, f);
    const before = fs.readFileSync(file, "utf8");
    const doc = JSON.parse(before);
    changed.push(...fixUnit(doc, table));
    const after = JSON.stringify(doc);
    if (after !== before) fs.writeFileSync(file, after);
  }
  return changed;
}

/* Every fix should land somewhere. One that matches no sentence is a typo in
   the table, or a sentence the course has since dropped. */
export function unmatchedFixes(dir, table = readAnswerFixes()) {
  const found = new Set();
  for (const f of fs.readdirSync(dir).filter((x) => /^unit-\d+\.json$/.test(x))) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const s of [...(doc.phrases || []), ...(doc.sentences || [])]) {
      const h = plain(s.he);
      table.forEach((fix, i) => { if (fix.he === h && (!fix.units || fix.units.includes(doc.unit))) found.add(i); });
    }
  }
  return table.filter((_, i) => !found.has(i));
}
