/* Does the course learn the learner?

   Four things have to hold, and none of them shows in a single lesson.

   An answer has to be blamed on the words it actually got wrong. A sentence
   wrong by one pronoun used to send every word in it to the bottom of the
   ladder, the five written perfectly with it — so the one word that slipped
   and the five that did not looked the same to the schedule.

   Help has to count. A word whose tap-hint was opened, or which needed a
   "Close!", was not known on its own, and a sentence got right around it is
   not evidence that it was; a word looked up in a book is a review failed in
   the wild.

   The profile has to say the right thing: the skill that lags against its own
   mark, not against the easiest exercise; the habit that dominates the
   mistakes, not the one that happened last; and none of it until there is
   enough to go on.

   And the session builder has to act on it, in practice and nowhere else —
   more of a weak skill, more sentences that exercise a habit, the word a
   learner mixes up offered beside the word it is mixed up with — while a
   lesson built with a record is exactly the lesson built without one.

   Run: npm run check:learner
*/

import fs from "node:fs";
import path from "node:path";

import {
  buildSession, buildPools, gradeWords, nearMiss, nearMissDetail, mistakeKinds, rivalsOf,
  exerciseSentence, tokenizeHe, bareHe, sessionLength,
} from "../src/duo/exercises.js";
import {
  freshProfile, noteExercise, diagnose, focusOf, nextEase, easeFactor, EASE, READY_AT, skillOf,
} from "../src/duo/learner.js";
import { loadDuo, resetDuo, getDuo, recordWord, noteLookup, noteLearner } from "../src/duo/state.js";
import { srsAnswer, srsLookup } from "../src/srs.js";

const OUT = path.resolve(import.meta.dirname, "..", "public", "duo");
const unitDoc = (n) => JSON.parse(fs.readFileSync(path.join(OUT, `unit-${String(n).padStart(3, "0")}.json`), "utf8"));
const lexicon = JSON.parse(fs.readFileSync(path.join(OUT, "lexicon.json"), "utf8"));

const problems = [];
let rules = 0;
const check = (what, ok) => { rules++; if (!ok) problems.push(what); };

const DAY = 86400000;
const NOW = 1_800_000_000_000;
const gradesOf = (list) => Object.fromEntries(list.map(({ w, grade }) => [w.he, grade]));

/* ------------------------------------------------------------------ */
/* Blame                                                               */
/* ------------------------------------------------------------------ */
const she = [{ he: "היא", en: "she" }, { he: "אוכלת", en: "eats" }, { he: "לחם", en: "bread" }];
const writeHe = { type: "bank", lang: "he", display: "היא אוכלת לחם", accepted: ["היא אוכלת לחם"], words: she };
const readHe = { type: "bank", lang: "en", prompt: "היא אוכלת לחם", display: "She eats bread", accepted: ["She eats bread"], words: she };

{
  const g = gradesOf(gradeWords(writeHe, { ok: false, response: "הוא אוכלת לחם" }));
  check("written in Hebrew, the pronoun that was wrong goes down", g["היא"] === "again");
  check("and the words written right are left where they were", g["אוכלת"] === null && g["לחם"] === null);

  const tiles = gradesOf(gradeWords(writeHe, { ok: false, response: ["הוא", "אוכלת", "לחם"] }));
  check("a word bank answer is read the same way as a typed one", tiles["היא"] === "again" && tiles["לחם"] === null);

  const e = gradesOf(gradeWords(readHe, { ok: false, response: "He eats bread" }));
  check("written in English, a gloss the course's English has and the answer lacks is blamed", e["היא"] === "again");
  check("and a gloss the answer carries is spared", e["אוכלת"] === null && e["לחם"] === null);

  /* a translation worded another way says nothing about the word either way */
  const big = [{ he: "גדול", en: "big" }, { he: "בית", en: "house" }];
  const house = { type: "bank", lang: "en", display: "The house is large", accepted: ["The house is large"], words: big };
  const worded = gradesOf(gradeWords(house, { ok: false, response: "The house is tiny" }));
  check("a gloss the reference words differently is neither blamed nor spared", worded["גדול"] === null);

  const lost = [{ he: "גדול", en: "big" }, { he: "מאוד", en: "very" }];
  const blind = { type: "bank", lang: "en", display: "It is really large", accepted: ["It is really large"], words: lost };
  const none = gradesOf(gradeWords(blind, { ok: false, response: "It is small" }));
  check("where nothing can be told, the old rule stands and every word goes down",
    none["גדול"] === "again" && none["מאוד"] === "again");

  const gave = gradesOf(gradeWords(writeHe, { ok: false, response: "", gaveUp: true }));
  check("I don't know sends every word down", Object.values(gave).every((x) => x === "again"));

  const pick = { type: "select", optionLang: "he", options: [{ he: "כלב" }, { he: "חתול" }, { he: "בית" }], answerIndex: 0, words: [{ he: "כלב", en: "dog" }] };
  check("a wrong pick is a wrong answer about its one word", gradesOf(gradeWords(pick, { ok: false, response: 1 }))["כלב"] === "again");

  const peeked = gradesOf(gradeWords(readHe, { ok: true, response: "She eats bread", peeked: new Set(["לחם"]) }));
  check("right, with a word's hint opened: that word is held, not promoted", peeked["לחם"] === "hard");
  check("and the rest of the sentence climbs", peeked["היא"] === "good" && peeked["אוכלת"] === "good");

  const nudged = gradesOf(gradeWords(writeHe, { ok: true, response: "היא אוכלת לחם", nudged: "היא" }));
  check("right after a Close! about a word: that word is held", nudged["היא"] === "hard" && nudged["לחם"] === "good");
}

/* ------------------------------------------------------------------ */
/* What kind of mistake                                                */
/* ------------------------------------------------------------------ */
{
  const near = (r) => nearMissDetail(writeHe, r);
  check("a pronoun near miss is filed as a pronoun, naming the word",
    near("הוא אוכלת לחם")?.kind === "pronoun" && near("הוא אוכלת לחם")?.want === "היא");
  check("an ending near miss is filed as an ending", near("היא אוכל לחם")?.kind === "ending");
  check("the right words in the wrong order are filed as order", near("לחם אוכלת היא")?.kind === "order");
  check("a word left out is filed as a gap", near("היא אוכלת")?.kind === "gaps");
  const boy = { type: "bank", lang: "he", display: "הילד אוכל", accepted: ["הילד אוכל"], words: [] };
  check("a lost front letter is filed as a prefix", nearMissDetail(boy, "ילד אוכל")?.kind === "prefix");
  /* the learner sees exactly what they saw before */
  check("the hints themselves are unchanged",
    nearMiss(writeHe, "הוא אוכלת לחם") === "Check the pronoun."
    && nearMiss(writeHe, "היא אוכל לחם") === "Right word, wrong ending."
    && nearMiss(boy, "ילד אוכל") === "Check the little letter on the front of a word."
    && nearMiss(writeHe, "היא אוכלת") === "Something is missing.");

  const two = mistakeKinds(writeHe, "הוא אוכל לחם");
  check(`a wrong answer names every kind it made (${two})`, two.includes("pronoun") && two.includes("ending") && two.length === 2);
  check("a sentence not understood is one mistake of vocabulary, not a list of grammar",
    JSON.stringify(mistakeKinds(writeHe, "אני שותה מים")) === JSON.stringify(["vocab"]));
  check("a word taken for another is vocabulary", JSON.stringify(mistakeKinds({ type: "select", words: [{}] }, 1)) === '["vocab"]');
  check("an English ending misread is filed as an ending",
    mistakeKinds(readHe, "She eat bread").includes("ending"));

  const pick = { type: "select", optionLang: "he", options: [{ he: "כלב" }, { he: "חתול" }], answerIndex: 0, words: [{ he: "כלב" }] };
  check("a wrong pick names the two words taken for each other", JSON.stringify(rivalsOf(pick, 1)) === JSON.stringify([["כלב", "חתול"]]));
  check("a right pick names none", rivalsOf(pick, 0).length === 0);
  const letters = { type: "select", optionLang: "he", options: [{ he: "א" }, { he: "ב" }], answerIndex: 0, words: [] };
  check("the letter drills are about something else", rivalsOf(letters, 1).length === 0 && skillOf(letters) === null);
  check("skills are read off the exercise",
    skillOf(writeHe) === "write" && skillOf(readHe) === "read" && skillOf({ type: "listen" }) === "listen"
    && skillOf({ type: "blank" }) === "cloze" && skillOf({ type: "match" }) === "words");
}

/* ------------------------------------------------------------------ */
/* The schedule                                                        */
/* ------------------------------------------------------------------ */
check("the starting ease is the old schedule, untouched", easeFactor(undefined) === 1 && easeFactor(EASE.base) === 1);
check("ease stays inside its bounds",
  nextEase(EASE.min, "again") === EASE.min && nextEase(EASE.max, "good") === EASE.max);

await loadDuo();
await resetDuo();
{
  const w = () => getDuo().words;
  recordWord("לחם", "bread", 3, "good");
  recordWord("לחם", "bread", 3, "good");
  check("good climbs", w()["לחם"].level === 2);
  const easeBefore = w()["לחם"].ease;
  recordWord("לחם", "bread", 3, "hard");
  check("hard holds the rung", w()["לחם"].level === 2);
  check("and makes the word a little harder", w()["לחם"].ease < easeBefore);
  recordWord("לחם", "bread", 3, "again");
  check("again goes to the bottom and counts a lapse", w()["לחם"].level === 0 && w()["לחם"].lapses === 1);
  recordWord("לחם", "bread", 3, true);
  check("true and false still mean good and again", w()["לחם"].level === 1);

  /* the same rung, reached by an easy word and a hard one */
  for (let i = 0; i < 3; i++) recordWord("מים", "water", 3, true);
  for (let i = 0; i < 3; i++) recordWord("ים", "sea", 3, false);
  for (let i = 0; i < 3; i++) recordWord("ים", "sea", 3, true);
  const easy = w()["מים"], hard = w()["ים"];
  check("a word that kept slipping comes back sooner than one that never did",
    easy.level === hard.level && hard.due - hard.at < (easy.due - easy.at) * 0.8);

  recordWord("עץ", "tree", 3, "hard", { looked: true });
  check("a hint opened on a word is counted against it", w()["עץ"].looks === 1);

  for (let i = 0; i < 3; i++) recordWord("ספר", "book", 3, true);
  await noteLookup((he) => he === "ספר");
  const looked = w()["ספר"];
  check("a course word looked up in a book comes due, a rung lower",
    looked.level === 2 && looked.due <= Date.now() && looked.looks === 1);
  await noteLookup((he) => he === "ספר");
  check("and tapping it again in the same sitting counts once", w()["ספר"].looks === 1);
  await noteLookup((he) => he === "אין-כזאת");
  check("a lookup never invents a word", !w()["אין-כזאת"]);

  noteLearner({ skill: "listen", first: true, ok: false, kinds: ["pronoun"] });
  check("a settled exercise reaches the profile", getDuo().learner.skills.listen?.n === 1 && getDuo().learner.kinds.pronoun?.n === 1);
}
await resetDuo();

/* the reader's own schedule, the same way */
{
  const fresh = { g: "house", star: true, box: 2, due: 0 };
  check("the reader's hard keeps the box", srsAnswer(fresh, "hard", NOW).box === 2);
  const missed = srsAnswer(fresh, false, NOW);
  check("the reader's again resets the box and lowers the ease", missed.box === 0 && missed.ease < EASE.base && missed.lapses === 1);
  const held = { ...fresh, due: NOW + 5 * DAY };
  const tapped = srsLookup(held, NOW);
  check("a starred word looked up while reading comes due, a box lower", tapped.due <= NOW && tapped.box === 1 && tapped.looks === 1);
  check("the same sitting counts once", srsLookup(tapped, NOW + 60000) === tapped);
  const plain = srsLookup({ g: "dog" }, NOW);
  check("an unstarred word is only counted, never scheduled", plain.looks === 1 && plain.due === undefined && !plain.star);
}

/* ------------------------------------------------------------------ */
/* The profile                                                         */
/* ------------------------------------------------------------------ */
{
  let p = freshProfile();
  for (let i = 0; i < 10; i++) p = noteExercise(p, { skill: "read", first: true, ok: true }, NOW);
  check(`nothing is said on ${10} answers`, !diagnose(p, {}, NOW).ready && READY_AT > 10);
  const early = focusOf(p, {}, NOW);
  check("and nothing is leant on", !Object.keys(early.skills).length && !Object.keys(early.kinds).length);

  p = freshProfile();
  for (let i = 0; i < 30; i++) p = noteExercise(p, { skill: "read", first: true, ok: i % 10 !== 0 }, NOW);
  for (let i = 0; i < 30; i++) p = noteExercise(p, { skill: "listen", first: true, ok: i % 20 < 11, aided: i % 3 === 0 }, NOW);
  /* a pick of one word from three is easy for everybody; this one is doing fine */
  for (let i = 0; i < 30; i++) p = noteExercise(p, { skill: "words", first: true, ok: i % 12 !== 0 }, NOW);
  const d = diagnose(p, {}, NOW);
  const skill = (id) => d.skills.find((s) => s.id === id);
  check("a lagging skill is called weak", skill("listen")?.weak);
  check("a skill at its mark is not, even beside an easier one scoring higher", !skill("read")?.weak && !skill("words")?.weak);
  check("the weakest skill comes first", d.skills[0].id === "listen");
  check(`the summary names it (${d.summary})`, /listening/.test(d.summary));
  const f = focusOf(p, {}, NOW);
  check("the weak skill weighs more in practice, the strong one less but not nothing",
    f.skills.listen > 1.5 && f.skills.read < 1 && f.skills.read > 0);

  const retries = noteExercise(freshProfile(), { skill: "read", first: false, ok: false }, NOW);
  check("a second go inside a lesson is not a first attempt", !retries.skills.read);

  let many = freshProfile();
  for (let i = 0; i < 500; i++) many = noteExercise(many, { skill: "read", first: true, ok: true }, NOW);
  check("a skill's count ages rather than growing for ever", many.skills.read.n <= 61);

  /* habits */
  let h = p;
  for (let i = 0; i < 6; i++) h = noteExercise(h, { skill: "write", first: true, ok: false, kinds: ["pronoun"] }, NOW);
  h = noteExercise(h, { skill: "write", first: true, ok: false, kinds: ["vocab"] }, NOW);
  h = noteExercise(h, { skill: "write", first: true, ok: false, kinds: ["gaps"] }, NOW);
  const hd = diagnose(h, {}, NOW);
  const pron = hd.kinds.find((k) => k.id === "pronoun");
  check("the habit that dominates the mistakes is called one", pron?.weak && pron.share > 0.6 && hd.kinds[0].id === "pronoun");
  check("a kind seen once is not", !hd.kinds.find((k) => k.id === "gaps")?.weak);
  check("the habit comes with its rule", !!pron?.tip);
  check("and practice leans towards it", focusOf(h, {}, NOW).kinds.pronoun > 0.5);
  check("a habit fades — three months on it is not called one",
    !diagnose(h, {}, NOW + 90 * DAY).kinds.find((k) => k.id === "pronoun")?.weak);

  const asked = noteExercise(freshProfile(), { skill: "write", first: true, ok: false, kinds: ["ending"], explained: true }, NOW);
  const silent = noteExercise(freshProfile(), { skill: "write", first: true, ok: false, kinds: ["ending"] }, NOW);
  check("a mistake that had to be explained weighs more", asked.kinds.ending.n > silent.kinds.ending.n && asked.explains?.n === 1);
  const takenBack = noteExercise(freshProfile(), { skill: "write", first: true, ok: true, explained: true }, NOW);
  check("an Explain that took the mark back is no mistake", !takenBack.explains && !Object.keys(takenBack.kinds).length);
  const caught = noteExercise(freshProfile(), { skill: "write", first: true, ok: true, nudged: ["pronoun"] }, NOW);
  check("a Close! counts, at half weight", caught.kinds.pronoun?.n === 0.5);

  /* words and pairs */
  const words = {
    "כלב": { en: "dog", level: 1, lapses: 3, looks: 1, ease: 1.9 },
    "חתול": { en: "cat", level: 2, lapses: 1 },
    "בית": { en: "house", level: 5, lapses: 4 },
    "שמש": { en: "sun", level: 1, looks: 2 },
  };
  const r = noteExercise(freshProfile(), { rivals: [["חתול", "כלב"]] }, NOW);
  const rd = diagnose(r, words, NOW);
  check("a word that keeps slipping is listed", rd.trouble[0]?.he === "כלב");
  check("so is one looked up again and again", rd.trouble.some((w) => w.he === "שמש"));
  check("a word missed once is not", !rd.trouble.some((w) => w.he === "חתול"));
  check("nor one missed often and held since", !rd.trouble.some((w) => w.he === "בית"));
  check("a pair taken for each other is listed with its English",
    rd.rivals[0] && [rd.rivals[0].ae, rd.rivals[0].be].sort().join() === "cat,dog");
  const rf = focusOf(r, words, NOW);
  check("and each is handed to practice as the other's wrong answer",
    rf.rivals["כלב"]?.includes("חתול") && rf.rivals["חתול"]?.includes("כלב"));
  check("a pair is the same pair whichever way round", Object.keys(noteExercise(r, { rivals: [["כלב", "חתול"]] }, NOW).rivals).length === 1);
}

/* ------------------------------------------------------------------ */
/* Practice that acts on it                                            */
/* ------------------------------------------------------------------ */
const HE_PRONOUNS = new Set("אני אתה את הוא היא אנחנו אתם אתן הם הן".split(" "));
const hasPronoun = (s) => tokenizeHe(s).map(bareHe).some((t) => HE_PRONOUNS.has(t));

function valid(ex) {
  if (ex.type === "select" || ex.type === "blank") return ex.answerIndex >= 0 && ex.answerIndex < ex.options.length;
  if ((ex.type === "bank" || ex.type === "listen") && Array.isArray(ex.tiles)) {
    const left = [...ex.tiles];
    return ex.answer.every((t) => { const i = left.indexOf(t); if (i < 0) return false; left.splice(i, 1); return true; });
  }
  return true;
}

const windowAt = (u) => { const docs = []; for (let n = Math.max(1, u - 6); n <= u; n++) docs.push(unitDoc(n)); return docs; };
const base = (u, docs, extra = {}) => ({
  unit: u, docs, lessonIndex: 0, known: new Set(docs.flatMap((d) => (d.words || []).map((w) => w.he))),
  reached: u - 1, lexicon, settings: { listening: true, speaking: true }, mistakes: [], dueWords: [], ...extra,
});

{
  const U = 40;
  const docs = windowAt(U);
  const pool = buildPools(docs, U);
  const [a, b] = pool.words.filter((w) => w.unit < U && !/\s/.test(w.he)).slice(0, 2);
  const strong = {
    ready: true, skills: { listen: 3, read: 0.7 }, kinds: { pronoun: 0.6 },
    words: [a.he], rivals: { [bareHe(a.he)]: [bareHe(b.he)], [bareHe(b.he)]: [bareHe(a.he)] },
  };

  const lesson = (focus) => JSON.stringify(buildSession({ ...base(U, docs), kind: "lesson", focus }));
  check("a lesson built with a record is exactly the lesson built without one", lesson(strong) === lesson(null));
  const test = (focus) => JSON.stringify(buildSession({ ...base(U, docs), kind: "test", focus }));
  check("so is a test", test(strong) === test(null));
  const quiet = { ready: false, skills: {}, kinds: {}, words: [], rivals: {} };
  const practice = (focus) => JSON.stringify(buildSession({ ...base(U, docs), kind: "practice", seed: 7, focus }));
  check("and an empty record changes nothing in practice either", practice(quiet) === practice(null));

  /* The habit is measured with nothing else changed: leaning on a skill
     changes which exercises a session holds, and different exercises draw on
     different sentences, so the two would muddy each other. */
  const habitOnly = { ...quiet, ready: true, kinds: { pronoun: 0.6 } };
  let listenOn = 0, listenOff = 0, pronOn = 0, pronOff = 0, sentOn = 0, sentOff = 0;
  let askedA = 0, withB = 0, invalid = 0, short = 0;
  const SEEDS = 40;
  const sentences = (items, tally) => {
    for (const ex of items) {
      const s = exerciseSentence(ex);
      if (s) { tally.n++; if (hasPronoun(s)) tally.p++; }
    }
  };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const on = buildSession({ ...base(U, docs), kind: "weak", seed, focus: strong });
    const off = buildSession({ ...base(U, docs), kind: "weak", seed, focus: quiet });
    if (on.length < sessionLength("weak")) short++;
    for (const ex of on) {
      if (!valid(ex)) invalid++;
      if (ex.type === "listen") listenOn++;
      if (ex.type === "select" && ex.words?.[0]?.he === a.he) {
        askedA++;
        const heOf = (o) => (ex.optionLang === "he" ? o.he : o.en);
        if (ex.options.some((o) => heOf(o) === b.he)) withB++;
      }
    }
    for (const ex of off) if (ex.type === "listen") listenOff++;
    const withHabit = { n: 0, p: 0 }, without = { n: 0, p: 0 };
    sentences(buildSession({ ...base(U, docs), kind: "weak", seed, focus: habitOnly }), withHabit);
    sentences(off, without);
    sentOn += withHabit.n; pronOn += withHabit.p;
    sentOff += without.n; pronOff += without.p;
  }
  console.log(`unit ${U}, ${SEEDS} weak-spot sessions: listening ${listenOff} → ${listenOn}, `
    + `sentences with a pronoun ${Math.round((100 * pronOff) / sentOff)}% → ${Math.round((100 * pronOn) / sentOn)}%, `
    + `"${a.en}" asked ${askedA} times with "${b.en}" beside it ${withB}`);
  check("a lagging skill gets more of the session", listenOn > listenOff * 1.5);
  check("a habit gets more sentences that exercise it", pronOn / sentOn > (pronOff / sentOff) + 0.05);
  check("a word that keeps slipping is asked about", askedA >= SEEDS / 4);
  check("and the word it was taken for is offered beside it", withB >= askedA * 0.9);
  check(`every weak-spot session fills (${short} short)`, short === 0);
  check(`every exercise in them can be answered (${invalid} not)`, invalid === 0);
}

/* across the whole path, so a unit with thin material does not crash it */
{
  let built = 0, bad = 0;
  const focus = { ready: true, skills: { write: 3, speak: 3, cloze: 2 }, kinds: { prefix: 0.5, ending: 0.4 }, words: [], rivals: {} };
  for (let u = 5; u <= 235; u += 10) {
    const items = buildSession({ ...base(u, windowAt(u)), kind: "weak", seed: u, focus });
    built++;
    if (!items.length || items.some((ex) => !valid(ex)) || new Set(items.map((x) => x.key)).size !== items.length) bad++;
  }
  check(`a weak-spot session builds cleanly all along the path (${bad} of ${built} not)`, bad === 0);
}

console.log(`checked ${rules} rules`);
if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log("no problems");
