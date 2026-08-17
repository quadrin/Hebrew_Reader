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
    accepted: {},               /* sentence -> answers a grader has allowed */
    mistakes: [],               /* exercises got wrong, for the mistakes drill */
    stats: { lessons: 0, perfect: 0, correct: 0, answered: 0, ms: 0, sessions: 0 },
    settings: {
      sound: true, animations: true, listening: true, speaking: true,
      wordBank: false,          /* answers are typed unless this is on */
      aiGrading: true,          /* let a model rule on answers the list rejects */
      aiNotes: true,            /* and say what went wrong when one is */
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
    const prev = s.words[he] || { en, unit, seen: 0, ok: 0, level: 0, due: 0 };
    const level = ok ? Math.min(WORD_INTERVALS.length - 1, prev.level + 1) : 0;
    const w = {
      ...prev,
      en: prev.en || en,
      unit: prev.unit || unit,
      seen: prev.seen + 1,
      ok: prev.ok + (ok ? 1 : 0),
      level,
      due: Date.now() + WORD_INTERVALS[level] * 3600000,
    };
    return { ...s, words: { ...s.words, [he]: w } };
  });
}

export const dueWords = (s = state, now = Date.now()) =>
  Object.entries(s.words).filter(([, w]) => (w.due || 0) <= now).map(([he, w]) => ({ he, ...w }));

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
export function finishSession({ unit, node, xp, correct, answered, ms, perfect, kind, advance }) {
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
    for (const u of unitDefs) {
      u.nodes.forEach((node) => { lessons[nodeKey(u.unit, node.i)] = node.sessions || 1; });
    }
    return { ...s, lessons, stats: { ...s.stats, tests: (s.stats.tests || 0) + 1 } };
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
