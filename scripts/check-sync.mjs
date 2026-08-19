/* Does moving progress between devices lose any of it?

   The merge is the part worth testing: it decides what happens when two
   devices have both been played on, and a mistake there is invisible — it
   looks like the transfer worked, and a week of lessons is quietly gone. So
   this asserts the rules directly, and that merging is idempotent and
   order-independent, which is what makes it safe to pass the same code back
   and forth between two phones.

   Run: npm run check:sync
*/

import { mergeDuo, mergeReader, encodeProgress, decodeProgress, summarise } from "../src/sync.js";

const problems = [];
const check = (what, ok) => { if (!ok) problems.push(what); };

/* Compare contents, not key order: a merge is allowed to write the same facts
   in a different order depending on which side it was given first. */
const canon = (v) => {
  if (Array.isArray(v)) return [...v.map(canon)].sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  }
  return v;
};
const same = (what, a, b) =>
  check(`${what}:\n    ${JSON.stringify(canon(a)).slice(0, 300)}\n  ≠ ${JSON.stringify(canon(b)).slice(0, 300)}`,
    JSON.stringify(canon(a)) === JSON.stringify(canon(b)));

/* two devices, both played on */
const phone = {
  xp: 400, streak: 5, goal: 20, lastLesson: "2026-08-14",
  days: { "2026-08-13": 30, "2026-08-14": 40 },
  lessons: { "1:0": 7, "1:1": 3, "2:0": 2 },
  legendary: { "1:0": true },
  words: {
    "לחם": { en: "bread", unit: 1, seen: 6, ok: 5, level: 3, due: 500 },
    "מים": { en: "water", unit: 1, seen: 2, ok: 1, level: 1, due: 200 },
  },
  accepted: { "חלב או מים?": ["milk or water"] },
  mistakes: [{ key: "a", ex: {} }],
  stats: { lessons: 12, perfect: 3, correct: 200, answered: 240, ms: 900000, sessions: 14, tests: 1 },
  settings: { sound: true, wordBank: false },
};

const laptop = {
  xp: 250, streak: 2, goal: 30, lastLesson: "2026-08-16",
  days: { "2026-08-14": 20, "2026-08-16": 60 },
  lessons: { "1:0": 7, "1:1": 1, "3:0": 5 },
  legendary: { "2:0": true },
  words: {
    "לחם": { en: "bread", unit: 1, seen: 3, ok: 3, level: 5, due: 900 },
    "יין": { en: "wine", unit: 4, seen: 4, ok: 2, level: 2, due: 300 },
  },
  accepted: { "חלב או מים?": ["water or milk"], "אני אמא.": ["I am a mother"] },
  mistakes: [{ key: "b", ex: {} }],
  stats: { lessons: 9, perfect: 5, correct: 150, answered: 165, ms: 600000, sessions: 10, tests: 2 },
  settings: { sound: false, wordBank: true },
};

const m = mergeDuo(phone, laptop);

/* nothing either device did may be lost */
check("xp keeps the higher total", m.xp === 400);
check("streak keeps the longer run", m.streak === 5);
same("days take the better day", m.days, { "2026-08-13": 30, "2026-08-14": 40, "2026-08-16": 60 });
same("lessons take the further progress per node", m.lessons, { "1:0": 7, "1:1": 3, "2:0": 2, "3:0": 5 });
same("legendary levels are unioned", m.legendary, { "1:0": true, "2:0": true });
check("a word met on both keeps the stronger memory", m.words["לחם"].level === 5 && m.words["לחם"].seen === 6);
check("the earlier review date wins", m.words["לחם"].due === 500);
check("words only one device had survive", !!m.words["מים"] && !!m.words["יין"]);
check("accepted answers are unioned", m.accepted["חלב או מים?"].length === 2 && !!m.accepted["אני אמא."]);
check("both devices' mistakes are kept", m.mistakes.length === 2);
check("stats take the higher of each", m.stats.correct === 200 && m.stats.perfect === 5 && m.stats.tests === 2);
/* A gist written before the leagues, quests and shop were taken out still has
   their fields; a merge must not carry them forward. */
const legacy = {
  ...laptop,
  gems: 500, freezes: 1, freezeUsed: ["2026-08-12"], boost: 0,
  quests: { day: "2026-08-16", items: [] },
  league: { week: "2026-08-10", tier: 0, xp: 80, best: 80, top3: 0, bots: [] },
};
const ml = mergeDuo(phone, legacy);
check("a legacy save's leagues, quests and shop are dropped",
  ["gems", "freezes", "freezeUsed", "boost", "quests", "league"].every((k) => !(k in ml)));
same("dropping them costs none of the real progress", ml, mergeDuo(phone, laptop));
check("the day last played is the later one", m.lastLesson === "2026-08-16");
check("settings come from the device played most recently", m.settings.wordBank === true);
check("the goal comes from the device played most recently", m.goal === 30);

/* the properties that make it safe to re-send the same code */
same("merging is order-independent", mergeDuo(phone, laptop), mergeDuo(laptop, phone));
same("merging twice changes nothing", mergeDuo(m, laptop), m);
same("merging with nothing is a no-op", mergeDuo(phone, null), phone);

/* the reader's half */
const rA = { saved: { "בית": { g: "house", box: 2 } }, known: { "ספר": 1 }, ch: 3, courseProgress: { "1-1": { done: true, score: 8, of: 10 } }, prefs: { theme: "dark" } };
const rB = { saved: { "בית": { g: "house", box: 4 }, "כלב": { g: "dog", box: 1 } }, known: { "מים": 1 }, ch: 1, courseProgress: { "1-1": { done: true, score: 5, of: 10 }, "1-2": { done: true, score: 9, of: 10 } }, prefs: { fontScale: 1.12 } };
const r = mergeReader(rA, rB);
check("saved words are unioned", Object.keys(r.saved).length === 2);
check("a saved word keeps the further review box", r.saved["בית"].box === 4);
check("known words are unioned", Object.keys(r.known).length === 2);
check("the chapter reached is the later one", r.ch === 3);
check("a lesson keeps its better score", r.courseProgress["1-1"].score === 8);
check("lessons only one device had survive", !!r.courseProgress["1-2"]);
check("preferences from both are kept", r.prefs.theme === "dark" && r.prefs.fontScale === 1.12);

/* Starring is opt-in, so it has to survive the device that never did it —
   otherwise syncing a phone you only read on would empty the practice list
   you built on the laptop. A word nobody starred stays unstarred. */
const sA = { saved: { "בית": { g: "house", star: true, box: 2 }, "כלב": { g: "dog" } } };
const sB = { saved: { "בית": { g: "house", box: 1 }, "כלב": { g: "dog" } } };
check("a star survives a device that never had one", mergeReader(sA, sB).saved["בית"].star === true);
check("a star survives whichever way round the merge runs", mergeReader(sB, sA).saved["בית"].star === true);
check("a word nobody starred stays out of practice", !mergeReader(sA, sB).saved["כלב"].star);

/* the code itself */
const blob = { app: "lavan", format: 1, at: "2026-08-16T10:00:00.000Z", duo: phone, reader: rA };
const code = encodeProgress(blob);
same("a code round-trips", decodeProgress(code), blob);
check("the code is marked as ours", code.startsWith("LVN1"));
check("the code is url-safe", /^LVN1[A-Za-z0-9\-_]+$/.test(code));
check("the code is smaller than the json", code.length < JSON.stringify(blob).length);
let rejected = false;
try { decodeProgress("hello there"); } catch (e) { rejected = true; }
check("a code that isn't one is refused", rejected);

const s = summarise(blob);
check("the summary counts what a person would recognise", s.xp === 400 && s.nodes === 3 && s.words === 2 && s.saved === 1);

/* a big save still fits somewhere sensible */
const big = { ...phone, words: {} };
for (let i = 0; i < 2000; i++) big.words[`מילה${i}`] = { en: `word ${i}`, unit: 1, seen: 3, ok: 2, level: 2, due: 1000 };
const bigCode = encodeProgress({ app: "lavan", format: 1, at: blob.at, duo: big, reader: null });
console.log(`a 2,000-word save encodes to ${(bigCode.length / 1024).toFixed(1)} KB`);
check("a 2,000-word save stays under 64 KB", bigCode.length < 64 * 1024);

console.log(`checked ${20 + 7 + 3 + 5} merge and transfer rules`);
if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log("no problems");
