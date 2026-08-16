/* The player's side of the course: everything Duolingo would keep on a server
   and this keeps on the device — crowns, gems, XP, the streak, the league you
   are in this week, which words you have met and how well you know them.

   One store, one saved blob, subscribed to with useSyncExternalStore. Every
   mutation goes through `update`, which is what makes the daily and weekly
   rollovers reliable: they run on read, so a player who comes back after a
   fortnight gets their streak broken and a fresh league before the first
   screen paints. */

import { useSyncExternalStore } from "react";
import { storage } from "../storage.js";
import { mulberry32 } from "./rand.js";

const KEY = "lavan-duo-v1";
export const FREEZE_COST = 200;
export const XP_BOOST_COST = 100;
export const GOALS = [
  { xp: 10, name: "Casual" },
  { xp: 20, name: "Regular" },
  { xp: 30, name: "Serious" },
  { xp: 50, name: "Intense" },
];

export const LEAGUES = [
  { name: "Bronze", color: "#CD7F32" },
  { name: "Silver", color: "#9FB0C0" },
  { name: "Gold", color: "#F0B400" },
  { name: "Sapphire", color: "#1CB0F6" },
  { name: "Ruby", color: "#E5426B" },
  { name: "Emerald", color: "#43C000" },
  { name: "Amethyst", color: "#A560E8" },
  { name: "Pearl", color: "#C7CBD1" },
  { name: "Obsidian", color: "#4B4B4B" },
  { name: "Diamond", color: "#7FD8F5" },
];

const BOT_NAMES = [
  "Noa", "Eitan", "Maya", "Yonatan", "Tamar", "Ari", "Shira", "Lior", "Dana", "Omer",
  "Hila", "Gil", "Yael", "Ronen", "Adi", "Barak", "Efrat", "Nadav", "Talia", "Uri",
  "Rivka", "Shai", "Zohar", "Amit", "Keren", "Doron", "Michal", "Erez", "Sivan",
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

export function weekKey(d = new Date()) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (t.getDay() + 6) % 7;                 /* Monday = 0 */
  t.setDate(t.getDate() - day);
  return dayKey(t);
}

/* ------------------------------------------------------------------ */
/* Quests                                                              */
/* ------------------------------------------------------------------ */
const QUEST_POOL = [
  { id: "xp", label: (g) => `Earn ${g} XP`, goals: [20, 30, 40], reward: 20 },
  { id: "lessons", label: (g) => `Complete ${g} lesson${g > 1 ? "s" : ""}`, goals: [2, 3, 4], reward: 15 },
  { id: "perfect", label: (g) => `Get ${g} perfect lesson${g > 1 ? "s" : ""}`, goals: [1, 2], reward: 25 },
  { id: "combo", label: (g) => `Get ${g} in a row correct`, goals: [8, 12, 15], reward: 20 },
  { id: "listen", label: (g) => `Score ${g} in listening exercises`, goals: [6, 10], reward: 20 },
  { id: "minutes", label: (g) => `Spend ${g} minutes learning`, goals: [5, 10, 15], reward: 20 },
  { id: "words", label: (g) => `Learn ${g} new words`, goals: [5, 8], reward: 20 },
];

/* Deterministic per day, so the three quests do not reshuffle on reload. */
function questsFor(day) {
  const seed = [...day].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = mulberry32(seed);
  const pool = [...QUEST_POOL];
  const out = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const q = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const goal = q.goals[Math.floor(rnd() * q.goals.length)];
    out.push({ id: q.id, goal, n: 0, reward: q.reward, label: q.label(goal), claimed: false });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* League                                                              */
/* ------------------------------------------------------------------ */
function makeBots(week, tier) {
  const seed = [...(week + tier)].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 11);
  const rnd = mulberry32(seed);
  const names = [...BOT_NAMES].sort(() => rnd() - 0.5).slice(0, 29);
  /* Higher leagues are harder: the pace scales with the tier. */
  const pace = 25 + tier * 18;
  return names.map((name, i) => ({
    name,
    /* each bot earns at its own rate, in XP per day */
    rate: Math.round(pace * (0.25 + rnd() * 1.9)),
    xp: 0,
    seed: Math.floor(rnd() * 1e9),
  }));
}

function advanceBots(league, now) {
  const started = new Date(league.week + "T00:00:00").getTime();
  const days = Math.min(7, Math.max(0, (now - started) / 86400000));
  return {
    ...league,
    bots: league.bots.map((b) => {
      const rnd = mulberry32(b.seed + Math.floor(days * 4));
      /* a plausible curve rather than a straight line: most of a bot's XP
         lands in a couple of sittings */
      const jitter = 0.6 + rnd() * 0.9;
      return { ...b, xp: Math.round(b.rate * days * jitter) };
    }),
  };
}

export function leagueStandings(state) {
  const you = { name: "You", xp: state.league.xp, you: true };
  return [...state.league.bots.map((b) => ({ name: b.name, xp: b.xp })), you]
    .sort((a, b) => b.xp - a.xp || (a.you ? 1 : -1));
}

/* ------------------------------------------------------------------ */
/* Shape                                                               */
/* ------------------------------------------------------------------ */
export const nodeKey = (unit, node) => `${unit}:${node}`;

function fresh() {
  const day = dayKey();
  const week = weekKey();
  return {
    v: 1,
    xp: 0,
    gems: 500,
    streak: 0,
    lastLesson: "",             /* last day a lesson was finished */
    freezes: 0,
    freezeUsed: [],             /* days a freeze covered */
    goal: 20,
    days: {},                   /* day -> XP earned */
    lessons: {},                /* "unit:node" -> lessons finished */
    legendary: {},              /* "unit:node" -> true */
    words: {},                  /* hebrew -> {en, unit, seen, ok, due, level} */
    accepted: {},               /* sentence -> answers a grader has allowed */
    mistakes: [],               /* exercises got wrong, for the mistakes drill */
    quests: { day, items: questsFor(day) },
    league: { week, tier: 0, xp: 0, best: 0, top3: 0, bots: makeBots(week, 0) },
    boost: 0,                   /* XP boost expiry */
    stats: { lessons: 0, perfect: 0, correct: 0, answered: 0, ms: 0, sessions: 0 },
    settings: {
      sound: true, animations: true, listening: true, speaking: true,
      wordBank: false,          /* answers are typed unless this is on */
      aiGrading: true,          /* let a model rule on answers the list rejects */
      aiNotes: true,            /* and say what went wrong when one is */
    },
  };
}

/* Rollovers, applied on every load and every midnight crossing. */
function roll(s, now = Date.now()) {
  const today = dayKey(new Date(now));
  let next = s;

  /* the streak: unbroken if you practised yesterday, or a freeze covered it */
  if (next.lastLesson && next.lastLesson !== today) {
    let gap = 0;
    let cursor = dayBefore(today);
    const used = [...next.freezeUsed];
    let freezes = next.freezes;
    let broken = false;
    while (cursor !== next.lastLesson && gap < 400) {
      if (used.includes(cursor)) { cursor = dayBefore(cursor); gap++; continue; }
      if (freezes > 0) { freezes--; used.push(cursor); cursor = dayBefore(cursor); gap++; continue; }
      broken = true;
      break;
    }
    if (broken && next.streak > 0) next = { ...next, streak: 0, freezes, freezeUsed: used };
    else if (freezes !== next.freezes) next = { ...next, freezes, freezeUsed: used };
  }

  /* quests reset at midnight */
  if (next.quests.day !== today) next = { ...next, quests: { day: today, items: questsFor(today) } };

  /* leagues run Monday to Monday; finish the old one before opening the new */
  const week = weekKey(new Date(now));
  if (next.league.week !== week) {
    const standings = leagueStandings(next);
    const place = standings.findIndex((r) => r.you) + 1;
    let tier = next.league.tier;
    if (place <= 7) tier = Math.min(LEAGUES.length - 1, tier + 1);
    else if (place >= 26) tier = Math.max(0, tier - 1);
    next = {
      ...next,
      league: {
        week, tier, xp: 0,
        best: Math.max(next.league.best || 0, next.league.xp),
        top3: (next.league.top3 || 0) + (place <= 3 ? 1 : 0),
        bots: makeBots(week, tier),
      },
    };
  }
  next = { ...next, league: advanceBots(next.league, now) };

  /* an expired boost is just noise in the header */
  if (next.boost && now > next.boost) next = { ...next, boost: 0 };

  return next;
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

export async function loadDuo() {
  if (loaded) return state;
  loaded = true;
  try {
    const raw = await storage.get(KEY);
    if (raw?.value) {
      const saved = JSON.parse(raw.value);
      state = { ...fresh(), ...saved, settings: { ...fresh().settings, ...(saved.settings || {}) } };
    }
  } catch (e) { /* a corrupt blob should not cost the whole course */ }
  state = roll(state);
  emit();
  return state;
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => state;

export function useDuo() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export const getDuo = () => state;

/* A tick so open screens notice midnight, and the league moving. */
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

function bumpQuest(s, id, n = 1, mode = "add") {
  const items = s.quests.items.map((q) =>
    q.id === id ? { ...q, n: mode === "max" ? Math.max(q.n, n) : Math.min(q.goal, q.n + n) } : q
  );
  return { ...s, quests: { ...s.quests, items } };
}

export function questProgress(id, n = 1, mode = "add") {
  update((s) => bumpQuest(s, id, n, mode));
}

export function claimQuest(id) {
  update((s) => {
    const q = s.quests.items.find((x) => x.id === id);
    if (!q || q.claimed || q.n < q.goal) return s;
    return {
      ...s,
      gems: s.gems + q.reward,
      quests: { ...s.quests, items: s.quests.items.map((x) => (x.id === id ? { ...x, claimed: true } : x)) },
    };
  });
}

export function awardXp(xp) {
  if (xp <= 0) return;
  update((s) => {
    const boosted = s.boost && Date.now() < s.boost ? xp * 2 : xp;
    const today = dayKey();
    return {
      ...s,
      xp: s.xp + boosted,
      days: { ...s.days, [today]: (s.days[today] || 0) + boosted },
      league: { ...s.league, xp: s.league.xp + boosted },
      quests: bumpQuest(s, "xp", boosted).quests,
    };
  });
}

export function spendGems(n) {
  let ok = false;
  update((s) => {
    if (s.gems < n) return s;
    ok = true;
    return { ...s, gems: s.gems - n };
  });
  return ok;
}

export function addGems(n) {
  update((s) => ({ ...s, gems: s.gems + n }));
}

export function buyFreeze() {
  if (getDuo().freezes >= 2) return false;
  if (!spendGems(FREEZE_COST)) return false;
  update((s) => ({ ...s, freezes: s.freezes + 1 }));
  return true;
}

export function buyBoost() {
  if (!spendGems(XP_BOOST_COST)) return false;
  update((s) => ({ ...s, boost: Date.now() + 15 * 60000 }));
  return true;
}

/* Word knowledge, doubling as the spaced-repetition schedule the practice
   sessions read from. */
const WORD_INTERVALS = [0, 4, 24, 3 * 24, 7 * 24, 21 * 24];   /* hours */

export function recordWord(he, en, unit, ok) {
  if (!he) return;
  update((s) => {
    const prev = s.words[he] || { en, unit, seen: 0, ok: 0, level: 0, due: 0 };
    const level = ok ? Math.min(WORD_INTERVALS.length - 1, prev.level + 1) : 0;
    const isNew = !s.words[he];
    const w = {
      ...prev,
      en: prev.en || en,
      unit: prev.unit || unit,
      seen: prev.seen + 1,
      ok: prev.ok + (ok ? 1 : 0),
      level,
      due: Date.now() + WORD_INTERVALS[level] * 3600000,
    };
    const next = { ...s, words: { ...s.words, [he]: w } };
    return isNew ? bumpQuest(next, "words", 1) : next;
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

/* Finishing a session: the crown, the streak, the day's XP, the quests, all in
   one write so nothing half-lands. */
export function finishSession({ unit, node, xp, correct, answered, ms, perfect, kind, advance }) {
  update((s) => {
    const today = dayKey();
    const key = nodeKey(unit, node);
    const boosted = s.boost && Date.now() < s.boost ? xp * 2 : xp;
    let next = {
      ...s,
      xp: s.xp + boosted,
      days: { ...s.days, [today]: (s.days[today] || 0) + boosted },
      league: { ...s.league, xp: s.league.xp + boosted },
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
      const yesterday = dayBefore(today);
      const continued = next.lastLesson === yesterday || next.freezeUsed.includes(yesterday);
      next.streak = continued ? next.streak + 1 : 1;
      next.lastLesson = today;
    }

    next = bumpQuest(next, "xp", boosted);
    if (kind === "lesson") next = bumpQuest(next, "lessons", 1);
    if (perfect) next = bumpQuest(next, "perfect", 1);
    next = bumpQuest(next, "minutes", Math.round(ms / 60000));
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
      u.nodes.forEach((node, i) => { lessons[nodeKey(u.unit, i)] = node.sessions || 1; });
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
  const total = node.sessions || 1;
  const done = lessonsDone(s, unitDef.unit, nodeIndex);
  const complete = done >= total;
  return {
    done, total, complete,
    legendary: !!s.legendary[nodeKey(unitDef.unit, nodeIndex)],
    fraction: Math.min(1, done / total),
  };
}

export const unitComplete = (s, unitDef) =>
  unitDef.nodes.every((_, i) => nodeStatus(s, unitDef, i).complete);

/* The one node the path should be pointing at: the first unfinished node of
   the first unfinished unit. */
export function currentPosition(s, units) {
  for (const u of units) {
    for (let i = 0; i < u.nodes.length; i++) {
      if (!nodeStatus(s, u, i).complete) return { unit: u.unit, node: i };
    }
  }
  const last = units[units.length - 1];
  return { unit: last?.unit ?? 1, node: Math.max(0, (last?.nodes.length ?? 1) - 1) };
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
    { id: "champion", name: "Champion", blurb: "Finish units", icon: "trophy", ...TIERS([1, 3, 6, 12, 25, 50, 84], t.unitsDone) },
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
