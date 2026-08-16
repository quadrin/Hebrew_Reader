/* A quick sanity pass over the generated course.

   The path is 528 nodes deep and no one is going to click all of it, so this
   builds a session for every unit — a first lesson, a later lesson, a review —
   and checks the things that would be invisible until someone hit them: a unit
   that cannot fill a session, an exercise with no right answer, a multiple
   choice whose options do not contain the answer, a word bank that cannot be
   solved from its own tiles.

   Run: npm run check:duo
*/

import fs from "node:fs";
import path from "node:path";

import {
  buildSession, checkAnswer, sessionLength, senses,
  placementStep, PLACEMENT_LADDER, PLACEMENT_PASS,
} from "../src/duo/exercises.js";

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

for (const u of course.units) {
  const docs = [];
  for (let n = Math.max(1, u.unit - 3); n <= u.unit; n++) docs.push(unitDoc(n));

  for (const [kind, lessonIndex] of [["lesson", 0], ["lesson", 3], ["review", 0], ["practice", 1], ["legendary", 0], ["test", 0]]) {
    const items = buildSession({
      unit: u.unit, docs, kind, lessonIndex,
      known: new Set(), settings: { listening: true, speaking: true },
      mistakes: [], dueWords: [],
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
