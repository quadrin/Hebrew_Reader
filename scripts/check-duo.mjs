/* A quick sanity pass over the generated course.

   The path is hundreds of lessons deep and no one is going to click all of it,
   so this builds a session for every card — a first lesson, a later lesson, a
   review — and checks the things that would be invisible until someone hit
   them: a unit that cannot fill a session, an exercise with no right answer, a
   multiple choice whose options do not contain the answer, a word bank that
   cannot be solved from its own tiles.

   It also checks the shape of the path itself: no card deeper than five
   lessons, and a split unit's two cards numbering their nodes and their
   lessons straight through, since both cards say they are the same unit and
   the node number is the only thing keeping their progress apart.

   Run: npm run check:duo
*/

import fs from "node:fs";
import path from "node:path";

import {
  buildSession, checkAnswer, sessionLength, senses,
  placementStep, PLACEMENT_LADDER, PLACEMENT_PASS,
} from "../src/duo/exercises.js";
import { EN_SYNONYMS } from "../src/duo/synonyms.js";

const OUT = path.resolve(import.meta.dirname, "..", "public", "duo");
const course = JSON.parse(fs.readFileSync(path.join(OUT, "course.json"), "utf8"));
const unitDoc = (n) => JSON.parse(fs.readFileSync(path.join(OUT, `unit-${String(n).padStart(3, "0")}.json`), "utf8"));

const problems = [];
const counts = {};
let sessions = 0, exercises = 0;

/* Answer an exercise the way a perfect player would, and check the marking
   agrees. If it does not, the exercise is unanswerable. */
function solve(ex) {
  switch (ex.type) {
    case "bank":
    case "listen": {
      /* every answer token must be present among the tiles */
      const tiles = [...ex.tiles];
      for (const w of ex.answer) {
        const i = tiles.indexOf(w);
        if (i < 0) return { ok: false, why: "answer token missing from the bank" };
        tiles.splice(i, 1);
      }
      if (!checkAnswer(ex, ex.answer).ok) return { ok: false, why: "correct tiles marked wrong" };
      /* the same exercise is answerable by typing, which is the default */
      if (!ex.accepted?.length) return { ok: false, why: "nothing to mark a typed answer against" };
      for (const a of ex.accepted) {
        if (!checkAnswer(ex, a).ok) return { ok: false, why: `accepted answer marked wrong: ${a}` };
      }
      if (checkAnswer(ex, "definitely not the answer").ok) return { ok: false, why: "any typed answer passes" };
      return { ok: true };
    }
    case "type":
      return checkAnswer(ex, ex.accepted[0]).ok ? { ok: true } : { ok: false, why: "reference answer marked wrong" };
    case "select":
    case "blank": {
      if (ex.answerIndex < 0 || ex.answerIndex >= ex.options.length) return { ok: false, why: "answer is not among the options" };
      /* a picture question with one blank option answers itself */
      if (ex.pictures && ex.options.some((o) => !o.img)) return { ok: false, why: "a picture question with an option that has no picture" };
      const answer = ex.options[ex.answerIndex];
      const others = ex.options.filter((_, i) => i !== ex.answerIndex);
      if (others.some((o) => o.he === answer.he)) return { ok: false, why: "a distractor repeats the answer" };
      /* a distractor that shares a sense with the answer makes two options
         right, which is worse than a hard question */
      if (ex.type === "select" && ex.optionLang && others.some((o) =>
        senses({ en: o.he }).some((x) => senses({ en: answer.he }).includes(x)))) {
        return { ok: false, why: "two options mean the same thing" };
      }
      return checkAnswer(ex, ex.answerIndex).ok ? { ok: true } : { ok: false, why: "correct option marked wrong" };
    }
    case "match": {
      const all = ex.pairs.flatMap((p) => senses({ en: p.en }));
      if (new Set(all).size !== all.length) return { ok: false, why: "two pairs share a sense" };
      if (new Set(ex.pairs.map((p) => p.en)).size !== ex.pairs.length) return { ok: false, why: "two pairs share an English side" };
      if (new Set(ex.pairs.map((p) => p.he)).size !== ex.pairs.length) return { ok: false, why: "two pairs share a Hebrew side" };
      return { ok: true };
    }
    case "speak":
    case "new":
      return { ok: true };
    default:
      return { ok: false, why: `unknown type ${ex.type}` };
  }
}

/* ------------------------------------------------------------------ */
/* The pictures                                                        */
/* ------------------------------------------------------------------ */
/* A picture that is in the index but not on disk is a broken image in a lesson,
   and a lesson is the worst place to find one. */
const imagesFile = path.join(OUT, "images.json");
const images = fs.existsSync(imagesFile) ? JSON.parse(fs.readFileSync(imagesFile, "utf8")) : {};
for (const [word, e] of Object.entries(images)) {
  if (!e.f || !fs.existsSync(path.join(OUT, "img", `${e.f}.webp`))) problems.push(`picture for "${word}" is missing from public/duo/img`);
  if (!e.lic) problems.push(`picture for "${word}" carries no licence`);
  if (!e.src) problems.push(`picture for "${word}" says nothing about where it came from`);
}
const orphans = fs.existsSync(path.join(OUT, "img"))
  ? fs.readdirSync(path.join(OUT, "img")).filter((f) => f.endsWith(".webp"))
    .filter((f) => !Object.values(images).some((e) => `${e.f}.webp` === f))
  : [];
if (orphans.length) problems.push(`${orphans.length} pictures on disk that no word claims: ${orphans.slice(0, 5).join(", ")}`);

/* ------------------------------------------------------------------ */
/* The shape of the path                                               */
/* ------------------------------------------------------------------ */
const LESSON_CAP = 5;
const byUnit = new Map();
for (const c of course.units) {
  if (!byUnit.has(c.unit)) byUnit.set(c.unit, []);
  byUnit.get(c.unit).push(c);
}
for (const [unit, cards] of byUnit) {
  const name = cards[0].skill;
  for (const c of cards) {
    const lessons = c.nodes.reduce((a, n) => a + (n.sessions || 1), 0);
    if (lessons > LESSON_CAP) problems.push(`unit ${unit} ${name} p${c.part}: ${lessons} lessons on one card`);
    if (!c.nodes.length) problems.push(`unit ${unit} ${name}: a card with no nodes`);
  }
  if (cards.length > 2) problems.push(`unit ${unit} ${name}: split into ${cards.length} cards, not two`);
  if (cards.length > 1 && cards.some((c, i) => c.part !== i + 1 || c.parts !== cards.length)) {
    problems.push(`unit ${unit} ${name}: parts are numbered ${cards.map((c) => `${c.part}/${c.parts}`).join(" ")}`);
  }
  /* both cards of a unit answer to the same unit number, so their nodes have
     to run straight through or their progress lands in the same key */
  const nodes = cards.flatMap((c) => c.nodes);
  const idx = nodes.map((n) => n.i);
  if (idx.some((n, i) => n !== i)) problems.push(`unit ${unit} ${name}: node numbers are ${idx.join(",")}`);
  const teaching = nodes.filter((n) => n.type === "skill").map((n) => n.lesson);
  if (teaching.some((n, i) => n !== i)) problems.push(`unit ${unit} ${name}: lesson numbers are ${teaching.join(",")}`);
  if (!teaching.length) problems.push(`unit ${unit} ${name}: nothing to teach`);
  const closing = nodes[nodes.length - 1];
  if (closing?.type !== "unit_review") problems.push(`unit ${unit} ${name}: ends on a ${closing?.type}, not a review`);
  /* a lesson introduces three words it has not introduced before */
  const doc = unitDoc(unit);
  /* a word whose "meaning" is a conjugation label — "F.S - Pres." — cannot be
     matched against Hebrew by anyone who does not already know the word */
  for (const w of doc.words) {
    if (/^[\s(]*\d?\.?[mf]\.?\s?[sp]\b[^a-z]*(pres|past|fut|imp)?\.?[^a-z]*$/i.test(w.en)) {
      problems.push(`unit ${unit} ${name}: "${w.he}" is glossed "${w.en}", a grammar label rather than a meaning`);
    }
  }
  if ((teaching.length - 1) * 3 >= doc.words.length) {
    problems.push(`unit ${unit} ${name}: ${teaching.length} lessons but only ${doc.words.length} words to teach`);
  }
}

/* one card is enough to test a unit's material; the other card of a split unit
   draws on the same sentences and words */
for (const u of course.units.filter((c) => c.part <= 1)) {
  const docs = [];
  for (let n = Math.max(1, u.unit - 3); n <= u.unit; n++) docs.push(unitDoc(n));

  for (const [kind, lessonIndex] of [["lesson", 0], ["lesson", 3], ["review", 0], ["practice", 1], ["legendary", 0], ["test", 0]]) {
    const items = buildSession({
      unit: u.unit, docs, kind, lessonIndex,
      known: new Set(), settings: { listening: true, speaking: true },
      mistakes: [], dueWords: [], images,
    });
    sessions++;
    const want = sessionLength(kind);
    if (items.length < want) problems.push(`unit ${u.unit} ${kind}: only ${items.length} of ${want} exercises`);
    const keys = new Set(items.map((x) => x.key));
    if (keys.size !== items.length) problems.push(`unit ${u.unit} ${kind}: duplicate exercise keys`);
    for (const ex of items) {
      exercises++;
      counts[ex.type] = (counts[ex.type] || 0) + 1;
      const r = solve(ex);
      if (!r.ok) problems.push(`unit ${u.unit} ${kind} [${ex.type}] ${r.why}: ${JSON.stringify(ex.display || ex.instruction)}`);
    }
  }
}

/* checkpoint tests draw on a sample spread across their whole block */
for (const cp of course.checkpoints || []) {
  const span = Math.max(1, cp.last - cp.first);
  const picks = [...new Set(Array.from({ length: 6 }, (_, i) => cp.first + Math.round((span * i) / 5)))];
  const docs = picks.map(unitDoc);
  const items = buildSession({ unit: cp.last, docs, kind: "checkpoint", known: new Set(), settings: {} });
  sessions++;
  if (items.length < sessionLength("checkpoint")) problems.push(`checkpoint ${cp.n}: only ${items.length} exercises`);
  const spread = new Set(items.flatMap((ex) => (ex.words || []).map((w) => w.he)));
  if (spread.size < 8) problems.push(`checkpoint ${cp.n}: only ${spread.size} distinct words across the test`);
  for (const ex of items) {
    exercises++;
    counts[ex.type] = (counts[ex.type] || 0) + 1;
    const r = solve(ex);
    if (!r.ok) problems.push(`checkpoint ${cp.n} [${ex.type}] ${r.why}`);
  }
  if (items.some((ex) => ex.type === "new")) problems.push(`checkpoint ${cp.n}: a test should not teach new words`);
}

/* the placement ladder: where does a given run of answers put someone */
function placeWith(scores) {
  const rung = { at: 0, reached: 0 };
  for (const right of scores) {
    const step = placementStep(rung, right, 3);
    rung.reached = step.reached;
    if (step.done) return { unit: rung.reached, asked: (scores.indexOf(right) + 1) * 3 };
    rung.at = step.at;
  }
  return { unit: rung.reached, asked: scores.length * 3 };
}
const perfect = placeWith(PLACEMENT_LADDER.map(() => 3));
const none = placeWith([0]);
const middling = placeWith([3, 3, 1]);
if (perfect.unit !== PLACEMENT_LADDER[PLACEMENT_LADDER.length - 1]) problems.push(`a perfect placement stops at unit ${perfect.unit}`);
if (perfect.asked > 30) problems.push(`a perfect placement asks ${perfect.asked} questions`);
if (none.unit !== 0) problems.push(`failing the first rung places at unit ${none.unit}`);
if (middling.unit !== PLACEMENT_LADDER[1]) problems.push(`failing the third rung places at unit ${middling.unit}, not ${PLACEMENT_LADDER[1]}`);
for (const unit of PLACEMENT_LADDER) {
  const docs = [unitDoc(Math.max(1, unit - 1)), unitDoc(unit)];
  const items = buildSession({ unit, docs, kind: "placement", known: new Set(), settings: { speaking: false } });
  sessions++;
  if (items.length !== 3) problems.push(`placement rung ${unit}: ${items.length} questions, wanted 3`);
  if (items.some((ex) => ex.type === "new")) problems.push(`placement rung ${unit} teaches a new word`);
  for (const ex of items) {
    exercises++;
    counts[ex.type] = (counts[ex.type] || 0) + 1;
    const r = solve(ex);
    if (!r.ok) problems.push(`placement rung ${unit} [${ex.type}] ${r.why}`);
  }
}

/* The synonym groups have to stay disjoint. A word in two of them chains them
   together — "hot" with "warm" and "hot" with "spicy" makes "spicy" an
   accepted answer for "warm" — and only the first group it appears in would
   have any effect anyway. */
const groupOf = new Map();
for (const group of EN_SYNONYMS) {
  for (const word of group) {
    if (groupOf.has(word)) problems.push(`"${word}" is in two synonym groups: ${groupOf.get(word)} and ${group[0]}`);
    groupOf.set(word, group[0]);
    if (!/^[a-z' -]+$/.test(word)) problems.push(`synonym "${word}" has something in it that marking strips out`);
  }
}

/* the same seed twice has to give the same lesson, or resuming would reshuffle */
const a = buildSession({ unit: 20, docs: [unitDoc(18), unitDoc(19), unitDoc(20)], kind: "lesson", lessonIndex: 1, known: new Set(), settings: {} });
const b = buildSession({ unit: 20, docs: [unitDoc(18), unitDoc(19), unitDoc(20)], kind: "lesson", lessonIndex: 1, known: new Set(), settings: {} });
if (JSON.stringify(a) !== JSON.stringify(b)) problems.push("sessions are not deterministic for the same seed");

console.log(`checked ${sessions} sessions, ${exercises} exercises`);
console.log("by type:", Object.entries(counts).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(", "));
if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems.slice(0, 40)) console.log("  " + p);
  process.exit(1);
}
console.log("no problems");
