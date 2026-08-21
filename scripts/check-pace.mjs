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
  unitStrength, staleUnits, recentPace, reachedUnit, STALE_BELOW,
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
const words = (n, overdue) => Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [`w${i}`, { unit: n, level: 3, due: overdue ? NOW - DAY : NOW + 10 * DAY }])
);
const held = unitStrength(save(5, { 3: unit(0.95, 30) }, words(3, false)), 3, NOW);
const lapsed = unitStrength(save(5, { 3: unit(0.95, 30) }, words(3, true)), 3, NOW);
check(`words still fresh keep a unit up (${held?.toFixed(2)})`, held > STALE_BELOW);
check(`words all overdue pull it down (${lapsed?.toFixed(2)})`, lapsed < STALE_BELOW);
check("and the words outrank the calendar", held > lapsed);

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
/* Where they have reached                                             */
/* ------------------------------------------------------------------ */
/* the number that tells "taught but never answered about" from "never taught",
   and the index it is looked up against */
check("reaching nowhere is unit 0", reachedUnit(save(0), course.units) === 0);
check("reaching unit 30 says 30", reachedUnit(save(30), course.units) === 30);
const below = Object.values(lexicon).filter((u) => u <= 30).length;
check(`the index knows what unit 30 has been taught (${below} words)`, below > 800 && below < 2000);
check("every word in the index names a real unit",
  Object.values(lexicon).every((u) => Number.isInteger(u) && u >= 1 && u <= 84));
check("the index is keyed on bare Hebrew",
  Object.keys(lexicon).every((w) => /^[֐-׿0-9]+$/.test(w)));

console.log(`checked ${29} calibration rules over ${Object.keys(lexicon).length} indexed words`);
if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log("no problems");
