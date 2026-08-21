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
  buildSession, checkAnswer, sessionLength, senses, sentenceKey, exerciseSentence,
  placementStep, PLACEMENT_LADDER, PLACEMENT_ASK, PLACEMENT_PASS, PLACEMENT_GAP,
} from "../src/duo/exercises.js";
import { EN_SYNONYMS } from "../src/duo/synonyms.js";

const OUT = path.resolve(import.meta.dirname, "..", "public", "duo");
const course = JSON.parse(fs.readFileSync(path.join(OUT, "course.json"), "utf8"));
const unitDoc = (n) => JSON.parse(fs.readFileSync(path.join(OUT, `unit-${String(n).padStart(3, "0")}.json`), "utf8"));

const problems = [];
const counts = {};
let sessions = 0, exercises = 0;

/* ------------------------------------------------------------------ */
/* What a lesson is made of                                            */
/* ------------------------------------------------------------------ */
/* Sentences are chosen for what they exercise rather than drawn at random, and
   that is invisible from any one lesson: a lesson built the old way looks
   exactly like a lesson built the new way until you count. So it is counted.

   Two properties are what the choosing buys. The fill-the-blank is the only
   exercise that tests one word and nothing else, so its gap belongs on a word
   the unit is teaching rather than on whichever word the shuffle reached. And
   a narrowed field repeats, so no sentence may be asked about three times in
   one session — twice is a second angle on the same line, a third time is the
   lesson running out of material. */
const lesson = { blanks: 0, onTarget: 0, drilled: 0, taught: 0, crowded: 0 };
const BLANK_ON_TARGET = 0.75;      /* of fill-the-blanks in a first lesson */
const DRILLED_TAUGHT = 0.75;       /* of the sentences a lesson asks about */

const heBare = (w) => w.replace(/[֑-ׇ]/g, "").replace(/[^֐-׿0-9]/g, "");
const heWords = (s) => String(s || "").split(/\s+/).map(heBare).filter(Boolean);
/* the one-letter prefixes the session builder also looks past */
const heStem = (w) => (w.length > 2 && "והבלכמש".includes(w[0]) ? w.slice(1) : w);

function inspectLesson(items, doc) {
  const taught = new Set(heWords((doc.words || []).map((w) => w.he).join(" ")));
  const has = (w) => taught.has(w) || taught.has(heStem(w));
  const asked = new Map();
  for (const ex of items) {
    if (ex.type === "blank") {
      lesson.blanks++;
      if (has(heBare(ex.display))) lesson.onTarget++;
    }
    const he = ex.type === "bank" ? (ex.lang === "he" ? ex.display : ex.prompt)
      : ex.type === "listen" ? ex.text
      : ex.type === "blank" ? ex.full
      : ex.type === "speak" ? ex.prompt
      : "";
    if (!he) continue;
    lesson.drilled++;
    if (heWords(he).some(has)) lesson.taught++;
    const key = heWords(he).join(" ");
    asked.set(key, (asked.get(key) || 0) + 1);
  }
  if ([...asked.values()].some((n) => n > 2)) lesson.crowded++;
}

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
    if (kind === "lesson") inspectLesson(items, docs[docs.length - 1]);
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

/* ------------------------------------------------------------------ */
/* Personalised practice                                               */
/* ------------------------------------------------------------------ */
/* The drill built from what is due, which the loop above never reaches because
   it has no due words to give it. A word that is due comes back inside a
   sentence, so the thing to check is that it really does: that the session
   fills, that the blanks land on the words that were due, and that answering
   one credits the word the practice was for — a blank on ולילד that files its
   answer under ולילד leaves ילד due for ever and the drill never empties. */
{
  let built = 0, cloze = 0, onDue = 0, credited = 0;
  for (const u of course.units.filter((c) => c.part <= 1 && c.unit % 7 === 0)) {
    const docs = [unitDoc(Math.max(1, u.unit - 1)), unitDoc(u.unit)];
    const doc = docs[docs.length - 1];
    /* the kind of thing the schedule hands over: words met, now come round */
    const due = (doc.words || []).slice(0, 8).map((w) => ({ he: w.he, en: w.en, level: 1, due: 0 }));
    if (due.length < 4) continue;
    const items = buildSession({
      unit: u.unit, docs, kind: "personalized", lessonIndex: 0,
      known: new Set(due.map((d) => d.he)), settings: { listening: true, speaking: true },
      mistakes: [], dueWords: due, images,
    });
    sessions++;
    built++;
    const want = sessionLength("personalized");
    if (items.length < want) problems.push(`unit ${u.unit} personalised: only ${items.length} of ${want} exercises`);
    const dueBare = new Set(due.map((d) => heBare(d.he)));
    for (const ex of items) {
      exercises++;
      counts[ex.type] = (counts[ex.type] || 0) + 1;
      const r = solve(ex);
      if (!r.ok) problems.push(`unit ${u.unit} personalised [${ex.type}] ${r.why}`);
      if (ex.type !== "blank") continue;
      cloze++;
      if (dueBare.has(heBare(ex.display))) onDue++;
      /* whatever it credits has to be a word the store can find again */
      if ((ex.words || []).some((w) => dueBare.has(heBare(w.he)))) credited++;
    }
  }
  console.log(`personalised: ${built} sessions, ${cloze} blanks, ${cloze ? ((onDue / cloze) * 100).toFixed(0) : 0}% on a due word`);
  if (!built) problems.push("no unit could build a personalised session");
  if (!cloze) problems.push("personalised practice never puts a due word in a sentence");
  if (cloze && onDue / cloze < 0.9) {
    problems.push(`only ${((onDue / cloze) * 100).toFixed(0)}% of personalised blanks land on a word that was due`);
  }
  if (cloze && credited / cloze < 0.9) {
    problems.push(`only ${((credited / cloze) * 100).toFixed(0)}% of personalised blanks credit the due word they were built for`);
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

/* ------------------------------------------------------------------ */
/* The placement ladder                                                */
/* ------------------------------------------------------------------ */
/* Run the whole test against a learner who knows everything up to a unit and
   nothing above it, which is the case the ladder has to get right before any
   argument about noise is worth having. */
function placeExactly(trueUnit, from = 0) {
  const rung = { at: from, reached: 0, hi: null, unit: PLACEMENT_LADDER[from] };
  let asked = 0;
  for (let i = 0; i < 40; i++) {
    const right = rung.unit <= trueUnit ? PLACEMENT_ASK : 0;
    asked += PLACEMENT_ASK;
    const step = placementStep(rung, right, PLACEMENT_ASK);
    rung.reached = step.reached;
    if (step.done) return { unit: rung.reached, asked };
    rung.at = step.at;
    rung.hi = step.hi;
    rung.unit = step.unit;
  }
  return { unit: rung.reached, asked, ranAway: true };
}

const top = PLACEMENT_LADDER[PLACEMENT_LADDER.length - 1];
const perfect = placeExactly(top);
if (perfect.unit !== top) problems.push(`a perfect placement stops at unit ${perfect.unit}, not ${top}`);

/* Failing the very first rung is the one case with nothing below to search. */
const none = placeExactly(0);
if (none.unit !== 0) problems.push(`failing the first rung places at unit ${none.unit}`);

/* The whole point of the search: land near the truth rather than at the last
   rung cleared, wherever the truth happens to sit — including in the middle of
   the widest gaps, which is where stopping dead cost the most. */
let worst = 0, worstAt = 0, longest = 0;
for (let t = 1; t <= top; t++) {
  const r = placeExactly(t);
  if (r.ranAway) { problems.push(`placement never settles for a learner at unit ${t}`); break; }
  if (r.unit > t) problems.push(`placement puts a learner at unit ${t} into unit ${r.unit}`);
  if (t - r.unit > worst) { worst = t - r.unit; worstAt = t; }
  longest = Math.max(longest, r.asked);
}
if (worst > PLACEMENT_GAP) {
  problems.push(`placement leaves a learner up to ${worst} units short (at unit ${worstAt}), wanted ${PLACEMENT_GAP}`);
}
if (longest > 45) problems.push(`the longest placement asks ${longest} questions`);

/* Run again by somebody already on the path, which starts the ladder near where
   they are rather than at the alphabet. Two things have to hold. Starting above
   their real level must not strand them there: the rung fails, and the search
   has to come back down. And it must never place somebody below where they
   genuinely are just because it started high. */
let recheckWorst = 0, recheckAt = 0, recheckLongest = 0;
for (let t = 1; t <= top; t++) {
  for (let from = 0; from < PLACEMENT_LADDER.length; from++) {
    const r = placeExactly(t, from);
    if (r.ranAway) { problems.push(`a level check never settles for unit ${t} started at rung ${from}`); break; }
    if (r.unit > t) problems.push(`a level check started at rung ${from} puts a learner at unit ${t} into unit ${r.unit}`);
    if (t - r.unit > recheckWorst) { recheckWorst = t - r.unit; recheckAt = t; }
    recheckLongest = Math.max(recheckLongest, r.asked);
  }
}
if (recheckWorst > PLACEMENT_GAP) {
  problems.push(`a level check leaves a learner up to ${recheckWorst} units short (at unit ${recheckAt}), wanted ${PLACEMENT_GAP}`);
}
if (recheckLongest > 60) problems.push(`the longest level check asks ${recheckLongest} questions`);

console.log(`placement: at worst ${worst} units short, at most ${longest} questions`);
console.log(`level check: at worst ${recheckWorst} units short, at most ${recheckLongest} questions, from any rung`);
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

/* ------------------------------------------------------------------ */
/* The sentence schedule                                               */
/* ------------------------------------------------------------------ */
/* What keeping a record per sentence is worth: it has to change what comes
   next. A sentence answered right five times running should give way to one
   that has not been, and a sentence that has come round again should hold its
   place. Nothing else asserts that the builder reads the schedule at all, and
   a record nothing reads is a record that can quietly stop being written.

   The two runs differ only in the schedule handed to them — same unit, same
   lesson, same seed — so any difference between them is the schedule and
   nothing else. */
{
  const docs = [unitDoc(19), unitDoc(20)];
  const args = {
    unit: 20, docs, kind: "lesson", lessonIndex: 1, known: new Set(),
    settings: { listening: true, speaking: true }, mistakes: [], dueWords: [], images,
  };
  const asked = (items) => new Set(items.map(exerciseSentence).filter(Boolean).map(sentenceKey));
  const plain = asked(buildSession(args));
  const shaped = (entry) => Object.fromEntries([...plain].map((k) => [k, entry]));
  const overlap = (levels) => [...asked(buildSession({ ...args, sentLevels: levels }))]
    .filter((k) => plain.has(k)).length;

  const cold = overlap(shaped({ level: 5, due: Date.now() + 30 * 86400000 }));
  const round = overlap(shaped({ level: 1, due: 0 }));
  if (!plain.size) problems.push("a lesson asked about no sentences at all");
  if (cold >= plain.size) problems.push("a lesson asks about sentences already answered right five times running");
  if (round <= cold) {
    problems.push(`the schedule points the wrong way: ${round} sentences kept when due, ${cold} when known cold`);
  }
}

/* the same seed twice has to give the same lesson, or resuming would reshuffle */
const a = buildSession({ unit: 20, docs: [unitDoc(18), unitDoc(19), unitDoc(20)], kind: "lesson", lessonIndex: 1, known: new Set(), settings: {} });
const b = buildSession({ unit: 20, docs: [unitDoc(18), unitDoc(19), unitDoc(20)], kind: "lesson", lessonIndex: 1, known: new Set(), settings: {} });
if (JSON.stringify(a) !== JSON.stringify(b)) problems.push("sessions are not deterministic for the same seed");

/* and the composition of the lessons those sessions came out as */
const onTarget = lesson.blanks ? lesson.onTarget / lesson.blanks : 1;
const drilledTaught = lesson.drilled ? lesson.taught / lesson.drilled : 1;
if (onTarget < BLANK_ON_TARGET) {
  problems.push(`only ${(onTarget * 100).toFixed(0)}% of fill-the-blanks land on a word the unit teaches, wanted ${BLANK_ON_TARGET * 100}%`);
}
if (drilledTaught < DRILLED_TAUGHT) {
  problems.push(`only ${(drilledTaught * 100).toFixed(0)}% of drilled sentences carry a word the unit teaches, wanted ${DRILLED_TAUGHT * 100}%`);
}
if (lesson.crowded) problems.push(`${lesson.crowded} lessons ask about one sentence three or more times`);

console.log(`checked ${sessions} sessions, ${exercises} exercises`);
console.log("by type:", Object.entries(counts).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(", "));
console.log(`lessons: ${(onTarget * 100).toFixed(0)}% of blanks on a taught word, ${(drilledTaught * 100).toFixed(0)}% of sentences carrying one`);
if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems.slice(0, 40)) console.log("  " + p);
  process.exit(1);
}
console.log("no problems");
