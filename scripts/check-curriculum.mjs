/* Is the taught course still teachable?

   The syllabus is hand-authored, which is what makes it good and what makes it
   easy to break quietly. A pack can point at a lesson that has been renamed. A
   word can be taught twice under two spellings, so the drill that asks what it
   means has two right answers and marks one of them wrong. A lesson can list a
   drill it has no data for and come out with nothing to practise. None of that
   throws — it just produces a lesson that is worse than it looks.

   So this checks the things the build script has no reason to notice.

   Run: npm run check:curriculum
*/

import { WEAK_ROOTS, BINYANIM } from "./curriculum/verbs.mjs";
import L1 from "./curriculum/lessons-1.mjs";
import L2 from "./curriculum/lessons-2.mjs";
import L3 from "./curriculum/lessons-3.mjs";
import L4 from "./curriculum/lessons-4.mjs";
import L5 from "./curriculum/lessons-5.mjs";
import L6 from "./curriculum/lessons-6.mjs";
import { PACKS_1 } from "./curriculum/vocab-1.mjs";
import { PACKS_2 } from "./curriculum/vocab-2.mjs";
import { PACKS_3 } from "./curriculum/vocab-3.mjs";
import { PACKS_4 } from "./curriculum/vocab-4.mjs";

const LEVELS = [L1, L2, L3, L4, L5, L6];
const PACKS = [...PACKS_1, ...PACKS_2, ...PACKS_3, ...PACKS_4];

const problems = [];
const fail = (what) => problems.push(what);

const bare = (s) => String(s).replace(/[֑-ׇ]/g, "").trim();
const HEBREW = /[֐-׿]/;

/* ------------------------------------------------------------------ */
/* the shape of a lesson                                               */
/* ------------------------------------------------------------------ */

const ids = new Map();
for (const lv of LEVELS) {
  if (!lv.name || !lv.nameHe || !lv.blurb) fail(`level ${lv.level} is missing a name or a blurb`);
  for (const l of lv.lessons) {
    if (ids.has(l.id)) fail(`two lessons share the id ${l.id} — progress is stored against it`);
    ids.set(l.id, lv.level);
    if (!l.title || !l.titleHe || !l.goal) fail(`${l.id} is missing a title or a goal`);
    if (!HEBREW.test(l.titleHe || "")) fail(`${l.id}: titleHe is not in Hebrew`);
    if (!(l.sections || []).length) fail(`${l.id} teaches nothing before it tests`);
  }
}
for (const p of PACKS) {
  if (ids.has(p.id)) fail(`pack ${p.id} collides with a lesson id`);
  ids.set(p.id, p.level);
  const lv = LEVELS.find((l) => l.level === p.level);
  if (!lv) fail(`pack ${p.id} wants level ${p.level}, which does not exist`);
  else if (!lv.lessons.some((l) => l.id === p.after)) {
    fail(`pack ${p.id} follows ${p.after}, which is not a lesson in level ${p.level}`);
  }
  if (!p.note) fail(`pack ${p.id} drops a word list with nothing said about it`);
  /* Below six words the odd-one-out drill silently produces nothing. */
  if (p.words.length < 6) fail(`pack ${p.id} has only ${p.words.length} words`);
}

/* ------------------------------------------------------------------ */
/* the words                                                           */
/* ------------------------------------------------------------------ */

const every = [
  ...LEVELS.flatMap((lv) => lv.lessons.flatMap((l) => (l.vocab || []).map((w) => ({ ...w, at: l.id })))),
  ...PACKS.flatMap((p) => p.words.map((w) => ({ ...w, at: p.id }))),
];

const seenHe = new Map();
const repeats = [];
const again = new Map();   /* how many of a lesson's words it is meeting for the second time */
for (const w of every) {
  if (!w.he || !w.en) { fail(`${w.at}: a vocabulary entry is missing its Hebrew or its English`); continue; }
  if (!HEBREW.test(w.he)) fail(`${w.at}: “${w.he}” has no Hebrew in it`);
  if (!w.translit) fail(`${w.at}: “${w.he}” has no transliteration, so it can't be sounded out`);
  /* Compared with the points on. Hebrew is full of pairs that share a skeleton
     and nothing else — רַע bad and רֵעַ a fellow, מֶלַח salt and מַלָּח a
     sailor — and calling those the same word would be wrong. */
  const key = w.he.trim();
  if (seenHe.has(key)) {
    repeats.push([w.he, seenHe.get(key), w.at]);
    again.set(w.at, (again.get(w.at) || 0) + 1);
  } else seenHe.set(key, w.at);
}

/* A word taught twice across the course is fine and often deliberate — a
   themed pack gathers up words the grammar lessons introduced one at a time.
   The build script drops any distractor that matches the answer's spelling,
   so the repeat cannot turn into a question with two right answers.

   Inside one lesson it is not fine: the same word twice in one word list is a
   list that was pasted, and the match drill will pair it against itself. */
for (const l of [...LEVELS.flatMap((lv) => lv.lessons), ...PACKS.map((p) => ({ id: p.id, vocab: p.words }))]) {
  const seen = new Map();
  const byEn = new Map();
  for (const w of l.vocab || []) {
    const k = w.he.trim();
    if (seen.has(k)) fail(`${l.id}: “${w.he}” is in the same word list twice`);
    else seen.set(k, w.en);
    /* two spellings, one gloss: the drill asks how you say it and marks one
       of the two right answers wrong */
    if (byEn.has(w.en)) fail(`${l.id}: “${w.en}” is the gloss for both ${byEn.get(w.en)} and ${w.he}`);
    else byEn.set(w.en, w.he);
  }
}

/* A pack mostly made of words already taught is not a pack, it is revision
   wearing a theme. Half is the line, and it is deliberately generous: the
   family pack is a third old words because the alphabet lessons needed אַבָּא
   and אָח to have something readable to sound out, and gathering those into
   the set they belong to is the pack doing its job. Past half there is nothing
   left in it to learn. */
for (const p of PACKS) {
  const old = again.get(p.id) || 0;
  if (old * 2 > p.words.length) {
    fail(`pack ${p.id} repeats ${old} of its ${p.words.length} words from earlier lessons`);
  }
}

/* ------------------------------------------------------------------ */
/* the drills                                                          */
/* ------------------------------------------------------------------ */

/* A drill name the build script knows how to expand from data. Anything else
   falls through to the table drills, which is deliberate — but only works if
   the lesson actually has a table with more than two rows in it. */
const DATA_DRILLS = new Set([
  "letters", "confuse", "finals", "vowels", "dagesh", "vocab", "listen",
  "read", "type", "gender", "build", "binyan-id", "odd", "cloze", "weak",
]);

for (const lv of LEVELS) {
  for (const l of lv.lessons) {
    const sections = l.sections || [];
    const has = (t) => sections.some((s) => s.type === t);
    for (const d of l.drills || []) {
      if (d.startsWith("conjugate:")) {
        const [, id, tense] = d.split(":");
        const b = BINYANIM.find((x) => x.id === id);
        if (!b) fail(`${l.id}: conjugates ${id}, which is not a binyan`);
        else if (!b[tense]) fail(`${l.id}: conjugates ${id} in the ${tense}, which is not in the table`);
        continue;
      }
      if (d === "weak") {
        const named = sections.filter((s) => s.type === "weak").map((s) => s.id);
        if (!named.length) fail(`${l.id}: drills weak roots without showing any`);
        for (const id of named) {
          if (!WEAK_ROOTS.some((r) => r.id === id)) fail(`${l.id}: shows the weak family ${id}, which has no data`);
        }
        continue;
      }
      if (d === "cloze" && !has("examples")) fail(`${l.id}: asks for a cloze with no example sentences to cut a word out of`);
      if (d === "build" && !has("examples")) fail(`${l.id}: asks for sentence building with no example sentences`);
      if ((d === "letters" || d === "vowels" || d === "confuse") && !has(d)) fail(`${l.id}: drills ${d} with no ${d} section`);
      if ((d === "vocab" || d === "listen" || d === "read" || d === "type") && !(l.vocab || []).length) {
        fail(`${l.id}: drills ${d} with no vocabulary`);
      }
      if (DATA_DRILLS.has(d)) continue;
      /* the fall-through case: it becomes table questions, or nothing at all */
      const quizzable = sections.filter((s) => s.type === "table" && s.head?.length >= 2 && (s.rows || []).length >= 3);
      if (!quizzable.length) fail(`${l.id}: the drill “${d}” falls through to the tables, and there is no table to quiz`);
    }
    /* A sentence-building or cloze drill needs sentences long enough to cut. */
    const items = sections.filter((s) => s.type === "examples").flatMap((s) => s.items);
    for (const e of items) {
      if (!e.he || !e.en) fail(`${l.id}: an example is missing a side`);
      else if (!HEBREW.test(e.he)) fail(`${l.id}: the example “${e.he}” has no Hebrew in it`);
    }
    for (const s of sections) {
      if (s.type !== "table") continue;
      if (!s.head?.length) fail(`${l.id}: a table has no head`);
      for (const r of s.rows || []) {
        if (r.length !== s.head.length) fail(`${l.id}: a row of “${s.caption || "a table"}” has ${r.length} cells for ${s.head.length} columns`);
      }
    }
  }
}

/* ------------------------------------------------------------------ */

const lessons = LEVELS.reduce((n, lv) => n + lv.lessons.length, 0) + PACKS.length;
if (problems.length) {
  console.log(`${problems.length} problem${problems.length === 1 ? "" : "s"} in the syllabus:\n`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`syllabus is sound: ${lessons} lessons, ${every.length} words, ${seenHe.size} of them distinct`);
if (repeats.length) console.log(`  ${repeats.length} are taught a second time in a later lesson, which is allowed for`);
