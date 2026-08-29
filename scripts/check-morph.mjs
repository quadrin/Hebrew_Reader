/* Does the morphology read Hebrew the way a learner does?

   The course's word index is keyed by whichever spelling turned up first, and
   everything that asks "can they read this yet" reads that index. So the index
   is only as honest as the forms it is asked about: before this module, עיר
   was unit 1 and העיר was unit 102, and the whole upper course looked years
   further from real Hebrew than it is.

   The risk in fixing that is the opposite error — reading a whole word as an
   inflected one, so מים is credited to whoever knows ים. Both directions are
   measured here: analyses that have to be found, analyses that must not be,
   and a count of how much of the index moves, so a rule added in good faith
   that quietly re-dates half the vocabulary shows up as a number rather than
   as a course that stopped teaching.

   Run: npm run check:morph
*/

import fs from "node:fs";
import path from "node:path";

import { heForms, holds, lexUnit } from "../src/duo/morph.js";

const LEX = path.resolve(import.meta.dirname, "..", "public", "duo", "lexicon.json");
const lexicon = JSON.parse(fs.readFileSync(LEX, "utf8"));

const problems = [];
const check = (label, ok) => { if (!ok) problems.push(label); };

/* ------------------------------------------------------------------ */
/* What has to be found                                               */
/* ------------------------------------------------------------------ */
/* Each pair is a spelling the course meets in real text and the spelling the
   word list keeps it under. Missing one of these is the bug this module
   exists for: a word the learner knows, read as a word they have never seen. */
const FINDS = [
  ["העיר", "עיר"],           /* the article */
  ["הגדולה", "גדול"],        /* article and feminine ending at once */
  ["ולילד", "ילד"],          /* and + to */
  ["בעיר", "העיר"],          /* the article swallowed by the preposition */
  ["מהעיר", "עיר"],          /* and spelt out after מ */
  ["וכשבבית", "בית"],        /* every slot Hebrew allows, stacked */
  ["ובעירנו", "עיר"],        /* clitics in front, a possessive behind */
  ["מדינת", "מדינה"],        /* the construct */
  ["בירתה", "בירה"],         /* construct under a possessive */
  ["ילדיהם", "ילדים"],       /* a possessive on a plural base */
  ["מלכים", "מלך"],          /* the final letter put back */
  ["שולחנות", "שולחן"],      /* and again, under a plural */
  ["ספריו", "ספר"],
  ["כשקוראים", "קורא"],
  ["שאותו", "אותו"],
];
for (const [w, want] of FINDS) {
  check(`${w} should be readable as ${want} — got ${heForms(w).join(" ")}`, heForms(w).includes(want));
}

/* ------------------------------------------------------------------ */
/* What must not be found                                             */
/* ------------------------------------------------------------------ */
/* Whole words whose first letter only looks like a clitic, or whose ending
   only looks like an ending, where the leftover is itself an early word — so
   getting this wrong hands the learner credit for vocabulary they have not
   met, in the units where they have least to spare. */
const REFUSES = [
  ["מים", "ים"], ["מים", "מי"], ["לחם", "חם"], ["שבת", "בת"], ["כלב", "לב"],
  ["כסף", "סף"], ["מלך", "לך"], ["מלכים", "לך"], ["ומלא", "לא"], ["שלמים", "מים"],
  ["מלחמת", "לחם"], ["שמיים", "שם"], ["מקום", "קום"], ["בחור", "חור"],
  ["מעט", "עט"], ["הלך", "לך"], ["כדור", "דור"], ["שפה", "פה"],
];
for (const [w, no] of REFUSES) {
  check(`${w} must not be read as ${no}`, !heForms(w).includes(no));
}

/* The commonest words in the language are two letters long, and a floor meant
   to keep an analysis from bottoming out must never drop them on the way in. */
for (const w of ["את", "יש", "של", "לא", "זה", "הם", "כן", "עם", "על", "בן"]) {
  check(`${w} should still be a form of itself`, heForms(w).includes(w));
}
for (const [w, want] of [["וזה", "זה"], ["ולא", "לא"], ["הכל", "כל"], ["מעל", "על"], ["בכל", "כל"]]) {
  check(`${w} should be readable as ${want}`, heForms(w).includes(want));
}

/* `holds` is what the session builder actually calls, on a set rather than a
   word, and it is the one that has to agree with all of the above. */
check("holds finds a word through its clitics", holds(new Set(["עיר"]), "ובעירנו"));
check("holds does not invent one", !holds(new Set(["ים"]), "מים"));

/* ------------------------------------------------------------------ */
/* How much of the index moves                                        */
/* ------------------------------------------------------------------ */
/* Every entry that now dates earlier than its own spelling says, because some
   form of it was taught sooner. This is the repair, so it is expected to be
   large — but it is also exactly what an over-eager rule would inflate, so it
   is held between a floor and a ceiling rather than merely printed. */
let moved = 0, totalDrop = 0;
const biggest = [];
for (const [w, u] of Object.entries(lexicon)) {
  const at = lexUnit(lexicon, w);
  if (at == null || at >= u) continue;
  moved++;
  totalDrop += u - at;
  biggest.push([u - at, w, u, at]);
}
const entries = Object.keys(lexicon).length;
const share = moved / entries;
biggest.sort((a, b) => b[0] - a[0]);

console.log(`checked ${FINDS.length + REFUSES.length} analyses over ${entries} indexed words`);
console.log(`  ${moved} re-dated (${(share * 100).toFixed(0)}%), by ${(totalDrop / moved).toFixed(0)} units on average`);
console.log(`  furthest: ${biggest.slice(0, 5).map(([d, w, u, a]) => `${w} ${u}→${a}`).join(", ")}`);

check(`only ${(share * 100).toFixed(0)}% of the index re-dates — the morphology is not reaching`, share > 0.2);
check(`${(share * 100).toFixed(0)}% of the index re-dates — the morphology is reaching too far`, share < 0.6);

/* The point of the exercise, in one sentence of real Hebrew: the opening line
   of the Wikipedia article on Jerusalem, which the index used to call half
   unreadable at unit 84 and now clears at 40. */
const bare = (s) => s.replace(/[֑-ׇ]/g, "").replace(/[^֐-׿0-9]/g, "");
const JERUSALEM = "ירושלים היא עיר הבירה של מדינת ישראל והעיר הגדולה ביותר בישראל באוכלוסייה ובשטח";
const toks = JERUSALEM.split(/\s+/).map(bare).filter(Boolean);
const readAt = (unit) => toks.filter((t) => { const a = lexUnit(lexicon, t); return a != null && a <= unit; }).length / toks.length;
console.log(`  a real sentence of Hebrew Wikipedia: ${(readAt(40) * 100).toFixed(0)}% known at unit 40`);
check(`the Jerusalem sentence should be readable by unit 40, and is ${(readAt(40) * 100).toFixed(0)}%`, readAt(40) >= 0.95);

if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log("\nno problems");
