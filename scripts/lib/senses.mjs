/* The corrections in data/word-senses.json, applied to the unit files.

   A course word's picture is found by its English gloss and nothing else, so a
   gloss in the wrong sense brings the wrong sense's picture with it — זכות
   ("a right") shown an arrow pointing right, חג (a festival) shown a beach —
   and a gloss that is simply wrong teaches the wrong meaning in the text too.
   The glosses come out of the scrape and the extended units, and a rebuild
   writes them afresh, so the corrections are kept apart from both and put
   back on every time: last, after every other pass has had its say.

   One pass over every unit file in `dir`. Returns what changed, as
   "unit: Hebrew old → new" lines, and rewrites only the files that did. */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const TABLE = path.resolve(import.meta.dirname, "..", "..", "data", "word-senses.json");

/* vowel points and cantillation off, which is how the table is written */
const plain = (s) => String(s || "").replace(/[֑-ׇ]/g, "");

export function readSenses(file = TABLE) {
  const { words } = JSON.parse(fs.readFileSync(file, "utf8"));
  return words.map((e) => ({ ...e, he: e.he.map(plain), alt: e.alt || [] }));
}

const entryFor = (table, he, unit) => {
  const h = plain(he);
  return table.find((e) => e.he.includes(h) && (!e.units || e.units.includes(unit)));
};

/* One unit's words. Anything the word was also glossed as stays
   an accepted alternative, unless it was the gloss being corrected — that one
   was the mistake. */
export function correctUnit(doc, table) {
  const changed = [];
  for (const w of doc.words || []) {
    const e = entryFor(table, w.he, doc.unit);
    if (!e || w.en === e.en) continue;
    const was = w.en;
    const seen = new Set([e.en.toLowerCase(), was.toLowerCase()]);
    const alt = [];
    for (const a of [...e.alt, ...(w.alt || [])]) {
      const k = a.toLowerCase();
      if (!seen.has(k)) { seen.add(k); alt.push(a); }
    }
    w.en = e.en;
    w.alt = alt;
    changed.push(`${doc.unit}: ${w.he} "${was}" → "${e.en}"`);
  }
  /* The tap-hints are left alone. A hint belongs to a form in a sentence, and
     the same form can mean something else there: לקח in a story is "took",
     not "moral" — and a hint lists every sense anyway, so it never pointed a
     picture at the wrong one. */
  return changed;
}

export function applySenses(dir, table = readSenses()) {
  const changed = [];
  for (const f of fs.readdirSync(dir).filter((x) => /^unit-\d+\.json$/.test(x)).sort()) {
    const file = path.join(dir, f);
    const before = fs.readFileSync(file, "utf8");
    const doc = JSON.parse(before);
    changed.push(...correctUnit(doc, table));
    const after = JSON.stringify(doc);
    if (after !== before) fs.writeFileSync(file, after);
  }
  return changed;
}

/* The course index carries a hash of every unit file, and the app throws away
   the unit files a phone is holding when it changes — the same stamp build-duo
   writes, so a correction applied without a rebuild still reaches a phone that
   has been through the unit. */
export function restamp(dir) {
  const stamp = crypto.createHash("sha1");
  for (const f of fs.readdirSync(dir).filter((x) => /^unit-\d+\.json$/.test(x)).sort()) {
    stamp.update(fs.readFileSync(path.join(dir, f)));
  }
  const file = path.join(dir, "course.json");
  const course = JSON.parse(fs.readFileSync(file, "utf8"));
  const data = stamp.digest("hex").slice(0, 12);
  if (course.data === data) return false;
  course.data = data;
  fs.writeFileSync(file, JSON.stringify(course));
  return true;
}
