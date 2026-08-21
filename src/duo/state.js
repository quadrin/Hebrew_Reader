/* The player's side of the course: everything Duolingo would keep on a server
   and this keeps on the device — crowns, XP, the streak, which words you have
   met and how well you know them.

   There is no league, no shop and no daily quest here. Those are Duolingo's
   retention machinery rather than its teaching, and the league in particular
   could only ever have been a lie: no server, no other players, so it was
   twenty-nine simulated strangers whose XP was a random number. What is left
   is what actually tracks learning.

   One store, one saved blob, subscribed to with useSyncExternalStore. Every
   mutation goes through `update`, which is what makes the daily rollover
   reliable: it runs on read, so a player who comes back after a fortnight gets
   their streak broken before the first screen paints. */

import { useSyncExternalStore } from "react";
import { storage } from "../storage.js";

const KEY = "lavan-duo-v1";
export const GOALS = [
  { xp: 10, name: "Casual" },
  { xp: 20, name: "Regular" },
  { xp: 30, name: "Serious" },
  { xp: 50, name: "Intense" },
];

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dayBefore = (key, n = 1) => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d - n);
  return dayKey(dt);
};

/* ------------------------------------------------------------------ */
/* Shape                                                               */
/* ------------------------------------------------------------------ */
export const nodeKey = (unit, node) => `${unit}:${node}`;
/* A unit with more to teach than one card holds is two cards, p1 and p2, and
   both of them say they are unit 25. What keeps their progress apart is the
   node's own number, which runs on across the split — p2's first node is not
   node 0 — so a key is always made from that rather than from where the node
   sits in the card it is drawn on. */
export const nodeAt = (unitDef, i) => unitDef.nodes[i]?.i ?? i;
/* what to call a card when a unit number is no longer unique */
export const cardId = (u) => (u?.part ? `${u.unit}p${u.part}` : String(u?.unit));
export const isLastCard = (u) => !u?.part || u.part === u.parts;

function fresh() {
  return {
    v: 1,
    xp: 0,
    streak: 0,
    lastLesson: "",             /* last day a lesson was finished */
    goal: 20,
    days: {},                   /* day -> XP earned */
    lessons: {},                /* "unit:node" -> lessons finished */
    legendary: {},              /* "unit:node" -> true */
    words: {},                  /* hebrew -> {en, unit, seen, ok, due, level} */
    sents: {},                  /* normalised sentence -> {level, seen, ok, due} */
    units: {},                  /* unit -> {first, ok, ms, sessions, at, via} */
    accepted: {},               /* sentence -> answers a grader has allowed */
    mistakes: [],               /* exercises got wrong, for the mistakes drill */
    stats: { lessons: 0, perfect: 0, correct: 0, answered: 0, ms: 0, sessions: 0 },
    settings: {
      sound: true, animations: true, listening: true, speaking: true,
      wordBank: false,          /* answers are typed unless this is on */
      aiGrading: true,          /* let a model rule on answers the list rejects */
      aiNotes: true,            /* and teach the answer when one is */
      passages: true,           /* offer a unit its closing text to read */
      roots: true,              /* and the root-family drill in Practice */
    },
  };
}

/* Rollover, applied on every load and every midnight crossing: one lesson a
   day keeps the streak, and a day missed ends it. */
function roll(s, now = Date.now()) {
  const today = dayKey(new Date(now));
  if (!s.lastLesson || s.lastLesson === today) return s;
  if (s.lastLesson === dayBefore(today)) return s;
  return s.streak > 0 ? { ...s, streak: 0 } : s;
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */
let state = fresh();
let loaded = false;
const listeners = new Set();
let saveTimer = null;

function emit() {
  for (const l of listeners) l();
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    storage.set(KEY, JSON.stringify(state)).catch(() => {});
  }, 400);
}

export function update(fn) {
  const next = fn(state);
  if (!next || next === state) return state;
  state = next;
  emit();
  persist();
  return state;
}

/* A save written before the leagues, quests and shop came out still carries
   their fields. Dropping them on the way in keeps them from being written back
   out for ever, and from being merged around between devices. */
const RETIRED = ["gems", "freezes", "freezeUsed", "boost", "quests", "league"];

function adopt(saved) {
  const next = { ...fresh(), ...saved, settings: { ...fresh().settings, ...(saved.settings || {}) } };
  for (const k of RETIRED) delete next[k];
  return next;
}

export async function loadDuo() {
  if (loaded) return state;
  loaded = true;
  try {
    const raw = await storage.get(KEY);
    if (raw?.value) state = adopt(JSON.parse(raw.value));
  } catch (e) { /* a corrupt blob should not cost the whole course */ }
  state = roll(state);
  emit();
  return state;
}

/* Re-read the saved blob and tell every screen. Used after a sync pulls
   somebody else's progress in: the store is the only copy the UI reads, so
   without this a device would show yesterday's crowns until it was reloaded. */
export async function reloadDuo() {
  try {
    const raw = await storage.get(KEY);
    if (raw?.value) {
      state = roll(adopt(JSON.parse(raw.value)));
      emit();
    }
  } catch (e) { /* keep what is in memory */ }
  return state;
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => state;

export function useDuo() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export const getDuo = () => state;

/* A tick so open screens notice midnight. */
export function startClock() {
  const id = setInterval(() => update((s) => {
    const next = roll(s);
    return next === s ? s : next;
  }), 30000);
  return () => clearInterval(id);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */
export const settings = () => state.settings;

export function setSetting(key, value) {
  update((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));
}

export function setGoal(xp) {
  update((s) => ({ ...s, goal: xp }));
}

export function awardXp(xp) {
  if (xp <= 0) return;
  update((s) => {
    const today = dayKey();
    return {
      ...s,
      xp: s.xp + xp,
      days: { ...s.days, [today]: (s.days[today] || 0) + xp },
    };
  });
}

/* Word knowledge, doubling as the spaced-repetition schedule the practice
   sessions read from. */
const WORD_INTERVALS = [0, 4, 24, 3 * 24, 7 * 24, 21 * 24];   /* hours */

export function recordWord(he, en, unit, ok) {
  if (!he) return;
  update((s) => {
    const now = Date.now();
    const prev = s.words[he] || { en, unit, seen: 0, ok: 0, level: 0, due: 0 };
    const level = ok ? Math.min(WORD_INTERVALS.length - 1, prev.level + 1) : 0;
    const w = {
      ...prev,
      en: prev.en || en,
      unit: prev.unit || unit,
      seen: prev.seen + 1,
      ok: prev.ok + (ok ? 1 : 0),
      level,
      /* when it was last answered about, as well as when it is next wanted.
         Two dates rather than one, because "how long since anybody exercised
         this" is a different question from "is it overdue", and the unit a word
         belongs to is judged on the first. */
      at: now,
      due: now + WORD_INTERVALS[level] * 3600000,
    };
    return { ...s, words: { ...s.words, [he]: w } };
  });
}

/* Words that went past in a sentence answered correctly, without being the
   thing the question was about.

   This is the difference between a unit being finished and a unit being dead.
   ה, של, אוכל and the rest of unit 3 turn up in unit 40's sentences constantly,
   and every time one of those sentences is answered right, unit 3 was used.
   None of that was recorded: a bank exercise only ever credited the words the
   glossary happened to carry a hint for, which across the sentence bank is 77%
   of them, and credited nothing at all to the earlier units the sentence was
   built out of.

   Exposure, not recall. The level does not move, because nothing asked you to
   produce the word and getting credit for reading past it would inflate the
   ladder until it meant nothing. What moves is the clock: a word seen in
   passing is pulled back to at most halfway through the interval it had already
   earned, so exposure can keep a word from lapsing but can never carry it
   further than a real review would have. */
export function touchWords(keys) {
  if (!keys?.length) return;
  update((s) => {
    const now = Date.now();
    let words = null;
    for (const k of keys) {
      const w = s.words[k];
      if (!w) continue;
      const span = WORD_INTERVALS[Math.min(w.level || 0, WORD_INTERVALS.length - 1)] * 3600000;
      const floor = now + span / 2;
      const due = Math.max(w.due || 0, floor);
      if (due === w.due && (w.at || 0) === now) continue;
      words = words || { ...s.words };
      words[k] = { ...w, at: now, due };
    }
    return words ? { ...s, words } : s;
  });
}

export const dueWords = (s = state, now = Date.now()) =>
  Object.entries(s.words).filter(([, w]) => (w.due || 0) <= now).map(([he, w]) => ({ he, ...w }));

/* The same record kept a sentence at a time.

   A word you know is not a sentence you can read, and the course has 7,615 of
   them. Without a record per sentence every line comes round at the same rate
   whether you have never met it or have had it right five times running — the
   lesson builder was choosing between them with nothing to go on, and the
   mistakes list, sixty deep and cleared as it is worked through, forgets a
   sentence the moment it is put right.

   So a sentence climbs a level for every time it is answered right and falls
   to the bottom when it is not, which is Clozemaster's mastery ladder and
   Leitner's before that. It is read back by `buildSession`, which weighs a
   sentence that has come due above one that has not, rather than by a screen
   of its own: the schedule is worth having because it decides what you are
   asked next, not because it is another number to look at. */
const SENT_INTERVALS = [0, 8, 24, 4 * 24, 10 * 24, 30 * 24];   /* hours */
export const SENT_LEVELS = SENT_INTERVALS.length - 1;

/* `key` is the sentence normalised — the caller does that, so this module
   stays free of the course's text handling. */
export function recordSentence(key, ok) {
  if (!key) return;
  update((s) => {
    const prev = (s.sents || {})[key] || { level: 0, seen: 0, ok: 0, due: 0 };
    const level = ok ? Math.min(SENT_LEVELS, prev.level + 1) : 0;
    return {
      ...s,
      sents: {
        ...s.sents,
        [key]: {
          level,
          seen: prev.seen + 1,
          ok: prev.ok + (ok ? 1 : 0),
          due: Date.now() + SENT_INTERVALS[level] * 3600000,
        },
      },
    };
  });
}

/* ------------------------------------------------------------------ */
/* How a unit went, and how long ago                                   */
/* ------------------------------------------------------------------ */
/* The path is a high-water mark: `lessons` counts up, `legendary` never comes
   off, and testing out fills in everything below. That is the right way to
   record where someone has been and the wrong way to say what they know, for
   two reasons the app had no way to see.

   The first is that finishing a unit says nothing about how it went. Every
   session handed `correct` and `answered` to `finishSession`, which added them
   to one lifetime total and threw the rest away — so a learner scraping through
   at 60% and one who has not been wrong in a fortnight were the same event, and
   nothing could offer either of them anything different.

   The second is forgetting. Unit 12 cleared in March is not unit 12 known in
   August, and nothing here decayed: the crown stayed gold, the path stayed
   walked, and the only way back to it was to scroll down and guess. People
   forget selectively — a unit, a handful of words, the one tense they never
   really had — so what is needed is per unit and not a single global number.

   `first` and `ok` count first attempts only. A question got right on the
   second go inside the same session is a question got wrong; counting the
   retry would make every session look like the accuracy the requeue was
   designed to produce. */
const UNIT_WINDOW = 80;        /* answers kept per unit before the count ages */

/* Half a unit's strength is gone after this long without touching it. Three
   weeks is the far end of the word ladder above, which is the point at which
   the app already stops claiming to know whether you remember something. */
const UNIT_HALF_LIFE_DAYS = 21;
/* What is left when a unit has lapsed entirely. You do not forget a language
   to zero, and a floor keeps a unit from being offered back for ever. */
const UNIT_FLOOR = 0.35;
/* How many recorded words it takes before the word evidence is trusted on its
   own rather than blended with the calendar. */
const EVIDENCE_FULL = 6;

/* How well a unit is held, 0 to 1, or null where it has never been touched.

   Measured where there is anything to measure — the words the unit taught and
   how many of them are past their review date is real forgetting rather than a
   model of it. A unit cleared by a test leaves no words behind to measure, so
   that case falls back to the clock, and is capped: twenty questions is thinner
   evidence than five lessons and should not read as mastery. */
export function unitStrength(s, unit, now = Date.now(), tally = null) {
  const u = (s.units || {})[unit];
  if (!u) return null;
  const acc = u.first ? u.ok / u.first : 0.7;
  const base = u.via === "lessons" ? acc : Math.min(acc, 0.75);
  const t = (tally || wordsByUnit(s, now))[unit];

  /* What the words say. A unit is held to the degree its own vocabulary is
     still inside the review windows it has earned, and each word carries partial
     credit for where it sits in its window rather than a yes or a no: freshly
     answered is 1, the moment it falls due is 0. Higher levels ride near 1 for
     longer, which is the whole point of the ladder. */
  const measured = t && t.met ? t.held / t.met : 0;

  /* What the clock says, for whatever the words cannot answer, dated from the
     last lesson this unit itself saw.

     The reuse signal deliberately does not go here. Somebody grinding unit 40 is
     exercising unit 3 every day, and that has to count — but it counts through
     the words above, where it is weighed by how much of the unit is being used.
     Letting it move the clock instead meant one word out of thirty answered
     yesterday declared the whole unit alive, which is the opposite mistake to
     the one this is fixing. */
  const days = Math.max(0, now - (u.at || 0)) / 86400000;
  const clocked = Math.pow(0.5, days / UNIT_HALF_LIFE_DAYS);

  /* Blended by how much there is to measure, rather than switched between at a
     threshold. A unit with two recorded words is mostly guesswork and a unit
     with twenty is not, and a cliff between them meant one more word answered
     could swing a unit from healthy to forgotten. */
  const evidence = Math.min(1, (t?.met || 0) / EVIDENCE_FULL);
  const recall = evidence * measured + (1 - evidence) * clocked;
  return base * (UNIT_FLOOR + (1 - UNIT_FLOOR) * recall);
}

/* Words this unit taught: how many there are, and how much retention they carry
   between them. One pass over the word map,
   because the alternative is one pass per unit, and the path draws dozens of
   discs while the practice hub asks about every unit in the course. */
export function wordsByUnit(s, now = Date.now()) {
  const by = {};
  for (const w of Object.values(s.words || {})) {
    if (w.unit == null) continue;
    const t = by[w.unit] || (by[w.unit] = { met: 0, held: 0 });
    t.met++;
    /* How far through its interval the word is. A save written before words
       carried a date has no interval to measure against — and must not be
       measured against one anyway, since `at` missing reads as 1970 and would
       score every word it ever learnt at nothing — so it falls back to the
       question the schedule was already answering. */
    const span = (w.due || 0) - (w.at || 0);
    t.held += w.at && span > 0
      ? Math.max(0, Math.min(1, ((w.due || 0) - now) / span))
      : ((w.due || 0) > now ? 1 : 0);
  }
  return by;
}

/* Units behind the learner that have gone quiet, weakest first. `units` is the
   course's card list, so only units actually finished are offered back — there
   is no sense in calling a unit forgotten that was never learnt. */
export const STALE_BELOW = 0.55;

export function staleUnits(s, courseUnits, now = Date.now(), limit = 5) {
  const out = [];
  const seen = new Set();
  const tally = wordsByUnit(s, now);
  for (const u of courseUnits) {
    if (seen.has(u.unit) || !unitComplete(s, u)) continue;
    seen.add(u.unit);
    const strength = unitStrength(s, u.unit, now, tally);
    if (strength != null && strength < STALE_BELOW) {
      out.push({ unit: u.unit, strength, skill: u.skill, at: (s.units || {})[u.unit]?.at || 0 });
    }
  }
  return out.sort((a, b) => a.strength - b.strength).slice(0, limit);
}

/* How the last few units have gone, which is what decides whether the course is
   moving too slowly for this learner or too fast. Only units with enough
   answers behind them count — three questions is not a reading. */
export function recentPace(s, courseUnits, now = Date.now(), back = 3) {
  const done = [];
  const seen = new Set();
  for (const u of courseUnits) {
    if (seen.has(u.unit)) continue;
    seen.add(u.unit);
    if (unitComplete(s, u)) done.push(u.unit);
  }
  const recent = done.slice(-back).map((n) => (s.units || {})[n]).filter((x) => x && x.first >= 10);
  if (!recent.length) return null;
  const first = recent.reduce((a, x) => a + x.first, 0);
  const ok = recent.reduce((a, x) => a + x.ok, 0);
  return { units: recent.length, first, accuracy: ok / first };
}

/* The furthest unit finished, for telling "taught but not yet answered about"
   from "never taught" — a learner who tested out of forty units has been taught
   their words whether or not the word map has heard of them. */
export function reachedUnit(s, courseUnits) {
  let reached = 0;
  for (const u of courseUnits) if (unitComplete(s, u) && u.unit > reached) reached = u.unit;
  return reached;
}

/* What the practice hub counts: sentences met, sentences come round again, and
   sentences at the top of the ladder. */
export function sentTotals(s = state, now = Date.now()) {
  let met = 0, due = 0, mastered = 0;
  for (const x of Object.values(s.sents || {})) {
    met++;
    if ((x.due || 0) <= now) due++;
    if ((x.level || 0) >= SENT_LEVELS) mastered++;
  }
  return { met, due, mastered };
}

/* An answer a grader allowed. Kept against the sentence so the same wording is
   accepted instantly — and for free — every time after the first. */
export function rememberAccepted(sentence, answer) {
  if (!sentence || !answer) return;
  update((s) => {
    const have = s.accepted[sentence] || [];
    if (have.some((a) => a.toLowerCase() === answer.toLowerCase())) return s;
    return { ...s, accepted: { ...s.accepted, [sentence]: [...have, answer].slice(-8) } };
  });
}

export const acceptedFor = (s, sentence) => s.accepted?.[sentence] || [];

export function addMistake(item) {
  update((s) => {
    const mistakes = [item, ...s.mistakes.filter((m) => m.key !== item.key)].slice(0, 60);
    return { ...s, mistakes };
  });
}

export function clearMistakes(keys) {
  update((s) => ({ ...s, mistakes: s.mistakes.filter((m) => !keys.includes(m.key)) }));
}

/* Finishing a session: the crown, the streak, the day's XP, all in one write so
   nothing half-lands. */
export function finishSession({ unit, node, xp, correct, answered, first = 0, firstOk = 0, ms, perfect, kind, advance }) {
  update((s) => {
    const today = dayKey();
    const key = nodeKey(unit, node);
    let next = {
      ...s,
      xp: s.xp + xp,
      days: { ...s.days, [today]: (s.days[today] || 0) + xp },
      stats: {
        ...s.stats,
        lessons: s.stats.lessons + (kind === "lesson" ? 1 : 0),
        perfect: s.stats.perfect + (perfect ? 1 : 0),
        correct: s.stats.correct + correct,
        answered: s.stats.answered + answered,
        ms: s.stats.ms + ms,
        sessions: s.stats.sessions + 1,
      },
    };

    /* `advance` is what moves the path along: a lesson, a review or a chest
       fills one more of the node's sessions, while practice from the hub earns
       XP and nothing else. */
    if (advance && unit != null && node != null) {
      next.lessons = { ...s.lessons, [key]: (s.lessons[key] || 0) + 1 };
    }

    /* How this unit is going, kept apart from the lifetime totals above so it
       can be read back — a lesson is the only place the app ever learns that
       the course is too easy or too hard for the person taking it. Practice
       from the hub counts too: it is still evidence about the unit. */
    if (unit != null && first > 0 && kind !== "placement") {
      const prev = (s.units || {})[unit] || { first: 0, ok: 0, ms: 0, sessions: 0, at: 0 };
      const aged = prev.first >= UNIT_WINDOW;
      const was = aged ? { first: Math.round(prev.first / 2), ok: Math.round(prev.ok / 2) } : prev;
      const via = kind === "test" || kind === "checkpoint" ? "test" : "lessons";
      next.units = {
        ...s.units,
        [unit]: {
          first: was.first + first,
          ok: was.ok + firstOk,
          ms: prev.ms + (ms || 0),
          sessions: prev.sessions + 1,
          at: Date.now(),
          via: prev.via === "lessons" ? "lessons" : via,
        },
      };
    }

    /* streak: one lesson a day keeps it */
    if (next.lastLesson !== today) {
      next.streak = next.lastLesson === dayBefore(today) ? next.streak + 1 : 1;
      next.lastLesson = today;
    }

    return next;
  });
}

/* Testing out. Duolingo's key icon: pass one test and the skill opens without
   the lessons, which is the only way a returning learner can start where they
   actually are rather than at the alphabet. Every node in the units passed is
   marked finished — chests included, so nothing is left dangling behind you. */
export function testOut(unitDefs) {
  update((s) => {
    const lessons = { ...s.lessons };
    const units = { ...s.units };
    const now = Date.now();
    for (const u of unitDefs) {
      u.nodes.forEach((node) => { lessons[nodeKey(u.unit, node.i)] = node.sessions || 1; });
      /* A unit opened by a test is opened on evidence, and the evidence has a
         date on it. Without one it would read as a unit finished just now and
         perfectly held for ever — which is how someone comes back after three
         months to a path that still says they know everything. Only units with
         nothing recorded are stamped: a unit actually worked through keeps the
         accuracy it earned. */
      if (!units[u.unit]) units[u.unit] = { first: 0, ok: 0, ms: 0, sessions: 0, at: now, via: "test" };
    }
    return { ...s, lessons, units, stats: { ...s.stats, tests: (s.stats.tests || 0) + 1 } };
  });
}

export function markLegendary(unit, node) {
  update((s) => ({ ...s, legendary: { ...s.legendary, [nodeKey(unit, node)]: true } }));
}

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */
export const lessonsDone = (s, unit, node) => s.lessons[nodeKey(unit, node)] || 0;

export function nodeStatus(s, unitDef, nodeIndex) {
  const node = unitDef.nodes[nodeIndex];
  const key = nodeAt(unitDef, nodeIndex);
  const total = node.sessions || 1;
  const done = lessonsDone(s, unitDef.unit, key);
  const complete = done >= total;
  return {
    done, total, complete,
    legendary: !!s.legendary[nodeKey(unitDef.unit, key)],
    fraction: Math.min(1, done / total),
  };
}

export const unitComplete = (s, unitDef) =>
  unitDef.nodes.every((_, i) => nodeStatus(s, unitDef, i).complete);

/* The one node the path should be pointing at: the first unfinished node of
   the first unfinished unit. */
/* Where you are on the path: the first thing left to do after the furthest
   thing finished — not simply the first thing unfinished.

   The two are the same on a path walked straight through, and they part
   company as soon as it isn't. Testing out of a unit leaves the units behind
   it finished; so does the course being rebuilt under someone mid-way through
   it, which is what happened when units were split in two. Standing in the
   oldest hole left behind says you are in Rookie while half of Explorer is
   gold, and sends you back to a unit you finished weeks ago. What is behind
   the marker stays open, so a hole is still there to be filled in. */
export function currentPosition(s, units) {
  const path = [];
  for (const u of units) for (let i = 0; i < u.nodes.length; i++) path.push({ u, i });
  if (!path.length) return { unit: 1, node: 0, card: "1" };

  let furthest = -1;
  path.forEach((step, k) => { if (nodeStatus(s, step.u, step.i).complete) furthest = k; });

  const at = path[furthest + 1]                                   /* the next thing along */
    || path.find((step) => !nodeStatus(s, step.u, step.i).complete)  /* or a hole behind */
    || path[path.length - 1];                                     /* or the end of it */
  return { unit: at.u.unit, node: nodeAt(at.u, at.i), card: cardId(at.u) };
}

export function totals(s, units) {
  let crowns = 0, nodes = 0, unitsDone = 0;
  for (const u of units) {
    let all = true;
    for (let i = 0; i < u.nodes.length; i++) {
      const st = nodeStatus(s, u, i);
      if (st.complete) { crowns += u.nodes[i].type === "skill" ? 1 : 0; nodes++; }
      else all = false;
    }
    if (all) unitsDone++;
  }
  return { crowns, nodes, unitsDone, words: Object.keys(s.words).length };
}

/* ------------------------------------------------------------------ */
/* Achievements                                                        */
/* ------------------------------------------------------------------ */
const TIERS = (levels, value) => {
  let tier = 0;
  for (let i = 0; i < levels.length; i++) if (value >= levels[i]) tier = i + 1;
  const next = levels[Math.min(tier, levels.length - 1)];
  return { tier, next, value, max: levels.length, done: tier >= levels.length };
};

export function achievements(s, units) {
  const t = totals(s, units);
  const acc = s.stats.answered ? s.stats.correct / s.stats.answered : 0;
  return [
    { id: "wildfire", name: "Wildfire", blurb: "Reach a streak", icon: "flame", ...TIERS([3, 7, 14, 30, 50, 100, 365], s.streak) },
    { id: "sage", name: "Sage", blurb: "Earn XP", icon: "sparkles", ...TIERS([100, 500, 1000, 2500, 5000, 10000, 20000], s.xp) },
    { id: "scholar", name: "Scholar", blurb: "Learn new words", icon: "book", ...TIERS([10, 25, 50, 100, 200, 400, 800], t.words) },
    { id: "regal", name: "Regal", blurb: "Earn crowns", icon: "crown", ...TIERS([5, 15, 30, 60, 100, 200, 350], t.crowns) },
    { id: "champion", name: "Champion", blurb: "Finish units", icon: "trophy", ...TIERS([1, 3, 6, 12, 25, 50, 110], t.unitsDone) },
    { id: "sharpshooter", name: "Sharpshooter", blurb: "Perfect lessons", icon: "target", ...TIERS([1, 5, 10, 20, 40, 80, 150], s.stats.perfect) },
    { id: "strategist", name: "Strategist", blurb: "Answer correctly", icon: "brain", ...TIERS([50, 200, 500, 1000, 2500, 5000, 10000], s.stats.correct) },
    { id: "marksman", name: "Marksman", blurb: "Lifetime accuracy", icon: "crosshair", ...TIERS([0.5, 0.6, 0.7, 0.8, 0.9, 0.95], acc) },
  ];
}

/* Wipe — offered in settings, and the only way back to a clean tree. */
export async function resetDuo() {
  state = fresh();
  emit();
  try { await storage.set(KEY, JSON.stringify(state)); } catch (e) {}
}
