/* Is the course keeping up with the person taking it?

   Three things have to hold, and none of them is visible from any one session.

   A unit has to decay. Cleared in March is not known in August, and the path
   itself cannot say so — the crown stays gold for ever, which is exactly how
   somebody comes back after a season to a tree claiming they know everything.

   A unit cleared by a test has to read as thinner evidence than one worked
   through, and it has to decay from the day the test was taken rather than
   sitting at full strength because nothing was ever recorded against it.

   And the offers have to point the right way: struggling before forgotten,
   forgotten before going faster. Getting that order wrong is worse than making
   no offer at all — sending somebody at 60% forward, or somebody with three
   dead units behind them further ahead, is how a learner ends up lost two
   sections later with no idea which part gave way.

   Run: npm run check:pace
*/

import fs from "node:fs";
import path from "node:path";
import {
  unitStrength, staleUnits, recentPace, reachedUnit, wordsByUnit, STALE_BELOW,
  recordWord, touchWords, getDuo, resetDuo,
} from "../src/duo/state.js";

const OUT = path.resolve(import.meta.dirname, "..", "public", "duo");
const course = JSON.parse(fs.readFileSync(path.join(OUT, "course.json"), "utf8"));
const lexicon = JSON.parse(fs.readFileSync(path.join(OUT, "lexicon.json"), "utf8"));

const problems = [];
const check = (what, ok) => { if (!ok) problems.push(what); };

const DAY = 86400000;
const NOW = 1_700_000_000_000;

/* a save with the first `through` units finished */
function save(through, units = {}, words = {}) {
  const lessons = {};
  for (const u of course.units) {
    if (u.unit > through) continue;
    for (const n of u.nodes) lessons[`${u.unit}:${n.i}`] = n.sessions || 1;
  }
  return { lessons, legendary: {}, units, words, sents: {} };
}
const unit = (acc, ageDays, via = "lessons", first = 60) =>
  ({ first, ok: Math.round(acc * first), ms: 60000, sessions: 5, at: NOW - ageDays * DAY, via });

/* ------------------------------------------------------------------ */
/* Forgetting                                                          */
/* ------------------------------------------------------------------ */
const fresh = unitStrength(save(5, { 3: unit(0.95, 0) }), 3, NOW);
const month = unitStrength(save(5, { 3: unit(0.95, 30) }), 3, NOW);
const season = unitStrength(save(5, { 3: unit(0.95, 120) }), 3, NOW);

check("a unit never touched has no strength at all", unitStrength(save(5), 3, NOW) === null);
check(`a unit just finished well reads strong (${fresh?.toFixed(2)})`, fresh > 0.9);
check(`a month later it has faded (${month?.toFixed(2)})`, month < fresh * 0.75);
check(`a season later it has faded further (${season?.toFixed(2)})`, season < month);
check("but not to nothing — you do not forget a language to zero", season > 0.2);
check("a unit scraped through never reads as well held",
  unitStrength(save(5, { 3: unit(0.6, 0) }), 3, NOW) < STALE_BELOW + 0.1);

/* measured forgetting beats the clock wherever there is anything to measure:
   the same unit, same date, differing only in whether its words are overdue */
/* `n` words of unit `u`, last answered `ago` days back on an interval of
   `every` days — which is what the schedule actually stores. */
const words = (u, count, ago, every) => Object.fromEntries(
  Array.from({ length: count }, (_, i) => [`w${u}_${i}`, {
    unit: u, en: "x", level: 3, at: NOW - ago * DAY, due: NOW - ago * DAY + every * DAY,
  }])
);
const held = unitStrength(save(5, { 3: unit(0.95, 30) }, words(3, 10, 1, 21)), 3, NOW);
const lapsed = unitStrength(save(5, { 3: unit(0.95, 30) }, words(3, 10, 40, 21)), 3, NOW);
check(`words still fresh keep a unit up (${held?.toFixed(2)})`, held > STALE_BELOW);
check(`words all overdue pull it down (${lapsed?.toFixed(2)})`, lapsed < STALE_BELOW);
check("and the words outrank the calendar", held > lapsed);

/* ------------------------------------------------------------------ */
/* A unit kept alive by the units after it                             */
/* ------------------------------------------------------------------ */
/* The thing the calendar on its own gets wrong. Hebrew's commonest words are
   taught in the first few units and then never stop appearing: ה, של and אוכל
   are in unit 40's sentences as much as they were in unit 3's. A learner
   grinding unit 40 is exercising unit 3 every day, and a model that dates unit 3
   from the last lesson launched inside it calls that unit forgotten while it is
   in constant use.

   So the words decide, and the words are dated by when they were last answered
   rather than by which lesson happened to be on screen. */
{
  /* unit 3 not opened in half a year, but its vocabulary answered yesterday */
  const inUse = save(40, { 3: unit(0.95, 180) }, words(3, 12, 1, 21));
  /* the same unit, same date, vocabulary nobody has touched since */
  const abandoned = save(40, { 3: unit(0.95, 180) }, words(3, 12, 200, 21));

  const a = unitStrength(inUse, 3, NOW), b = unitStrength(abandoned, 3, NOW);
  check(`a unit whose words are still in use does not decay (${a?.toFixed(2)})`, a > 0.85);
  check(`the same unit with nobody using its words does (${b?.toFixed(2)})`, b < STALE_BELOW);
  check("and it is never offered back while it is being used",
    !staleUnits(inUse, course.units, NOW).some((x) => x.unit === 3));
  check("while the abandoned one is", staleUnits(abandoned, course.units, NOW).some((x) => x.unit === 3));

  /* the reuse signal has to be weighed by how much of the unit is in use, which
     is what keeps one lucky word from speaking for the other twenty-nine */
  check("reuse is counted per word, not as a single flag",
    wordsByUnit(inUse, NOW)[3].held > 11 && wordsByUnit(abandoned, NOW)[3].held < 1);

  /* half the vocabulary kept up should land between the two, not at either end */
  const half = save(40, { 3: unit(0.95, 180) },
    { ...words(3, 6, 1, 21), ...words(30, 0, 0, 1), ...Object.fromEntries(
      Object.entries(words(3, 6, 200, 21)).map(([k, v]) => [k + "b", v])) });
  const mid = unitStrength(half, 3, NOW);
  check(`half of it still in use reads as half held (${mid?.toFixed(2)})`, mid > b && mid < a);

  /* thin evidence must not swing the answer on one word */
  const oneWord = unitStrength(save(40, { 3: unit(0.95, 180) }, words(3, 1, 1, 21)), 3, NOW);
  check(`one word answered yesterday does not revive a dead unit (${oneWord?.toFixed(2)})`,
    oneWord < STALE_BELOW);
}

/* ------------------------------------------------------------------ */
/* Testing out                                                         */
/* ------------------------------------------------------------------ */
const tested = unitStrength(save(5, { 3: unit(1, 0, "test", 20) }), 3, NOW);
check(`twenty questions is thinner evidence than five lessons (${tested?.toFixed(2)})`,
  tested < fresh && tested > STALE_BELOW);
check("and it decays from the day it was taken",
  unitStrength(save(5, { 3: unit(1, 120, "test", 20) }), 3, NOW) < STALE_BELOW);

/* ------------------------------------------------------------------ */
/* What has gone quiet                                                 */
/* ------------------------------------------------------------------ */
const mixed = save(9, {
  2: unit(0.95, 200),      /* long gone */
  3: unit(0.9, 60),        /* fading */
  8: unit(0.95, 0),        /* fine */
  9: unit(0.93, 1),        /* fine */
});
const stale = staleUnits(mixed, course.units, NOW);
check("what has gone quiet is found", stale.length >= 2);
check("weakest first", stale.every((x, i) => !i || x.strength >= stale[i - 1].strength));
check("the oldest is the first offer back", stale[0]?.unit === 2);
check("a unit finished yesterday is not called forgotten", !stale.some((x) => x.unit === 8 || x.unit === 9));
check("a unit never finished is never called forgotten",
  !staleUnits(save(3, { 40: unit(0.2, 300) }), course.units, NOW).some((x) => x.unit === 40));

/* ------------------------------------------------------------------ */
/* Pace                                                                */
/* ------------------------------------------------------------------ */
check("pace says nothing until there is something to say", recentPace(save(0), course.units, NOW) === null);
check("three questions is not a reading",
  recentPace(save(3, { 1: unit(1, 0, "lessons", 3), 2: unit(1, 0, "lessons", 3), 3: unit(1, 0, "lessons", 3) }), course.units, NOW) === null);

const flying = recentPace(save(6, { 4: unit(0.97, 0), 5: unit(0.96, 0), 6: unit(0.98, 0) }), course.units, NOW);
const sinking = recentPace(save(6, { 4: unit(0.62, 0), 5: unit(0.6, 0), 6: unit(0.64, 0) }), course.units, NOW);
check(`someone flying reads as flying (${flying?.accuracy.toFixed(2)})`, flying.accuracy >= 0.92);
check(`someone sinking reads as sinking (${sinking?.accuracy.toFixed(2)})`, sinking.accuracy <= 0.68);
check("pace reads the units just finished, not the whole history",
  recentPace(save(6, { 1: unit(0.3, 0), 2: unit(0.3, 0), 4: unit(0.97, 0), 5: unit(0.96, 0), 6: unit(0.98, 0) }),
    course.units, NOW).accuracy >= 0.92);

/* ------------------------------------------------------------------ */
/* Exposure is not recall                                              */
/* ------------------------------------------------------------------ */
/* Reading past a word in a sentence you got right is worth something, and it is
   not worth what answering a question about that word is worth. If the two were
   the same, the ladder would climb on its own every time a common word appeared
   and would stop meaning anything by unit 10. */
{
  await resetDuo();
  recordWord("לחם", "bread", 3, true);
  recordWord("לחם", "bread", 3, true);
  const before = { ...getDuo().words["לחם"] };

  touchWords(["לחם"]);
  const after = getDuo().words["לחם"];
  check("exposure does not move the level", after.level === before.level);
  check("exposure does not count as another answer", after.seen === before.seen);
  check("exposure moves the clock", after.at > 0 && after.at >= before.at);

  /* it can rescue a word that has gone overdue, but only part of the way */
  await resetDuo();
  recordWord("מים", "water", 3, true);
  const fresh = getDuo().words["מים"];
  const span = fresh.due - fresh.at;
  /* pretend a long time has passed and it fell due */
  getDuo().words["מים"] = { ...fresh, at: fresh.at - 10 * DAY, due: fresh.due - 10 * DAY };
  touchWords(["מים"]);
  const saved = getDuo().words["מים"];
  check("exposure pulls an overdue word back inside its window", saved.due > Date.now());
  check("but no further than halfway through the interval it had earned",
    saved.due - Date.now() <= span / 2 + 1000);

  /* and it never invents a word the learner has not met */
  touchWords(["שלוםשלום"]);
  check("exposure never creates a word", !getDuo().words["שלוםשלום"]);
  await resetDuo();
}

/* ------------------------------------------------------------------ */
/* Where they have reached                                             */
/* ------------------------------------------------------------------ */
/* the number that tells "taught but never answered about" from "never taught",
   and the index it is looked up against */
check("reaching nowhere is unit 0", reachedUnit(save(0), course.units) === 0);
check("reaching unit 30 says 30", reachedUnit(save(30), course.units) === 30);
const below = Object.values(lexicon).filter((u) => u <= 30).length;
check(`the index knows what unit 30 has been taught (${below} words)`, below > 800 && below < 2000);
/* The ceiling is the course's own last unit rather than a number written
   here: the path has grown twice since this check was written, and a literal
   would have to be remembered each time. */
const lastUnit = Math.max(...course.units.map((u) => u.unit));
check(`every word in the index names a real unit (1-${lastUnit})`,
  Object.values(lexicon).every((u) => Number.isInteger(u) && u >= 1 && u <= lastUnit));
check("the index is keyed on bare Hebrew",
  Object.keys(lexicon).every((w) => /^[֐-׿0-9]+$/.test(w)));

console.log(`checked ${41} calibration rules over ${Object.keys(lexicon).length} indexed words`);
if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log("no problems");
