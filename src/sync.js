/* Progress, moved between devices.

   There is no server and no account, so nothing syncs by itself. What this
   does instead is make the progress portable: collect everything that counts
   as progress — the path's crowns and streak and vocabulary, the reader's
   saved words and course scores — into one small blob, and move it by file,
   by pasted code, or by link.

   The important half is `mergeProgress`. Anyone with two devices will have
   done something on each, so an import that overwrote would throw one of them
   away. Counters take the larger of the two, sets are unioned, per-day
   figures take the better day, and a word met on both devices keeps the
   stronger memory of it. Merging twice gives the same answer as merging once,
   which is what makes it safe to send the same code back and forth.

   The blob deliberately leaves out books, cached audio and API keys: books are
   megabytes and re-importable, audio regenerates, and a key is not progress —
   it is a credential, and putting one in a link people paste around is how
   credentials leak. */

import { gzipSync, gunzipSync, strToU8, strFromU8 } from "fflate";
import { storage } from "./storage.js";

export const DUO_KEY = "lavan-duo-v1";
export const READER_KEY = "lavan-hebrew-reader-v1";
export const FORMAT = 1;

/* ------------------------------------------------------------------ */
/* Collect and apply                                                   */
/* ------------------------------------------------------------------ */
const readJson = async (key) => {
  try {
    const raw = await storage.get(key);
    return raw?.value ? JSON.parse(raw.value) : null;
  } catch (e) { return null; }
};

/* The reader keeps books and their vocalisations under the same roof as its
   progress; only the progress travels. */
const READER_FIELDS = ["saved", "known", "sents", "quiz", "ch", "courseProgress", "prefs"];

export async function collectProgress() {
  const duo = await readJson(DUO_KEY);
  const reader = await readJson(READER_KEY);
  const slim = {};
  for (const f of READER_FIELDS) if (reader && reader[f] != null) slim[f] = reader[f];
  return {
    app: "lavan",
    format: FORMAT,
    at: new Date().toISOString(),
    duo: duo || null,
    reader: Object.keys(slim).length ? slim : null,
  };
}

export function summarise(blob) {
  const d = blob?.duo || {};
  const r = blob?.reader || {};
  return {
    at: blob?.at ? new Date(blob.at) : null,
    xp: d.xp || 0,
    streak: d.streak || 0,
    nodes: Object.keys(d.lessons || {}).length,
    words: Object.keys(d.words || {}).length,
    saved: Object.keys(r.saved || {}).length,
    lessons: Object.keys(r.courseProgress || {}).length,
  };
}

export async function applyProgress(blob, { mode = "merge" } = {}) {
  if (blob?.app !== "lavan" || !blob.format) throw new Error("that isn't a Lavan progress code");
  if (blob.format > FORMAT) throw new Error("that code came from a newer version of the app");

  if (blob.duo) {
    const mine = await readJson(DUO_KEY);
    const next = mode === "replace" || !mine ? blob.duo : mergeDuo(mine, blob.duo);
    await storage.set(DUO_KEY, JSON.stringify(next));
  }
  if (blob.reader) {
    const mine = (await readJson(READER_KEY)) || {};
    const merged = mode === "replace" ? { ...mine, ...blob.reader } : mergeReader(mine, blob.reader);
    await storage.set(READER_KEY, JSON.stringify(merged));
  }
  return summarise(blob);
}

/* ------------------------------------------------------------------ */
/* Merging                                                             */
/* ------------------------------------------------------------------ */
const bigger = (a, b) => (Number(a) || 0) > (Number(b) || 0) ? (Number(a) || 0) : (Number(b) || 0);

const mergeCounts = (a = {}, b = {}) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = bigger(out[k], v);
  return out;
};

const mergeFlags = (a = {}, b = {}) => ({ ...a, ...b });

/* A word known on two devices: the one that has been seen more, got right
   more, and sits at the higher level, with the earlier review date — being
   asked again sooner is the safe direction to be wrong in. */
function mergeWords(a = {}, b = {}) {
  const out = { ...a };
  for (const [he, w] of Object.entries(b)) {
    const mine = out[he];
    if (!mine) { out[he] = w; continue; }
    out[he] = {
      ...mine, ...w,
      en: mine.en || w.en,
      unit: Math.min(mine.unit || 999, w.unit || 999),
      seen: bigger(mine.seen, w.seen),
      ok: bigger(mine.ok, w.ok),
      level: bigger(mine.level, w.level),
      due: Math.min(mine.due || 0, w.due || 0) || bigger(mine.due, w.due),
    };
  }
  return out;
}

/* Fields of the leagues, quests and shop, which are gone. A gist written
   before they were taken out still carries them, and the spread below would
   otherwise copy them forward on every sync for ever. */
const RETIRED = ["gems", "freezes", "freezeUsed", "boost", "quests", "league"];

export function mergeDuo(a, b) {
  if (!a) return b;
  if (!b) return a;
  const newer = (b.lastLesson || "") >= (a.lastLesson || "") ? b : a;
  const older = newer === b ? a : b;
  const out = {
    ...older,
    ...newer,
    xp: bigger(a.xp, b.xp),
    streak: bigger(a.streak, b.streak),
    goal: newer.goal ?? a.goal,
    lastLesson: newer.lastLesson || older.lastLesson,
    days: mergeCounts(a.days, b.days),
    lessons: mergeCounts(a.lessons, b.lessons),
    legendary: mergeFlags(a.legendary, b.legendary),
    words: mergeWords(a.words, b.words),
    accepted: (() => {
      const out = { ...(a.accepted || {}) };
      for (const [s, list] of Object.entries(b.accepted || {})) {
        out[s] = [...new Set([...(out[s] || []), ...list])].slice(-8);
      }
      return out;
    })(),
    /* mistakes are a to-do list, not a score: keep both devices' */
    mistakes: (() => {
      const seen = new Set();
      return [...(b.mistakes || []), ...(a.mistakes || [])]
        .filter((m) => (seen.has(m.key) ? false : (seen.add(m.key), true)))
        .slice(0, 60);
    })(),
    stats: {
      lessons: bigger(a.stats?.lessons, b.stats?.lessons),
      perfect: bigger(a.stats?.perfect, b.stats?.perfect),
      correct: bigger(a.stats?.correct, b.stats?.correct),
      answered: bigger(a.stats?.answered, b.stats?.answered),
      ms: bigger(a.stats?.ms, b.stats?.ms),
      sessions: bigger(a.stats?.sessions, b.stats?.sessions),
      tests: bigger(a.stats?.tests, b.stats?.tests),
    },
    settings: { ...(a.settings || {}), ...(newer.settings || {}) },
  };
  for (const k of RETIRED) delete out[k];
  return out;
}

export function mergeReader(a = {}, b = {}) {
  const out = { ...a, ...b };
  /* saved words carry review scheduling of their own */
  out.saved = mergeWords(a.saved, b.saved);
  out.known = { ...(a.known || {}), ...(b.known || {}) };
  out.sents = { ...(a.sents || {}), ...(b.sents || {}) };
  out.quiz = { ...(a.quiz || {}), ...(b.quiz || {}) };
  out.ch = bigger(a.ch, b.ch);
  out.courseProgress = (() => {
    const merged = { ...(a.courseProgress || {}) };
    for (const [id, p] of Object.entries(b.courseProgress || {})) {
      const mine = merged[id];
      merged[id] = !mine ? p : {
        ...mine, ...p,
        done: mine.done || p.done,
        score: bigger(mine.score, p.score),
        of: bigger(mine.of, p.of),
      };
    }
    return merged;
  })();
  out.prefs = { ...(a.prefs || {}), ...(b.prefs || {}) };
  return out;
}

/* ------------------------------------------------------------------ */
/* The code                                                            */
/* ------------------------------------------------------------------ */
/* base64url so it survives a URL, a text message and a QR reader. */
const toB64url = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromB64url = (str) => {
  const s = str.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export function encodeProgress(blob) {
  return "LVN1" + toB64url(gzipSync(strToU8(JSON.stringify(blob)), { level: 9 }));
}

export function decodeProgress(code) {
  const trimmed = String(code || "").trim().replace(/\s+/g, "");
  if (!trimmed.startsWith("LVN1")) throw new Error("that doesn't look like a transfer code");
  const blob = JSON.parse(strFromU8(gunzipSync(fromB64url(trimmed.slice(4)))));
  if (blob?.app !== "lavan") throw new Error("that code isn't from this app");
  return blob;
}

export const restoreLink = (code) =>
  `${location.origin}${location.pathname}#restore=${code}`;

/* A link the browser will actually open. Anything longer is still fine as a
   pasted code, but stops being a link worth sending. */
export const LINK_LIMIT = 12000;

export function codeInLink(code) {
  return code.length + 40 <= LINK_LIMIT;
}

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */
export function downloadProgress(blob) {
  const name = `lavan-progress-${new Date().toISOString().slice(0, 10)}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(blob, null, 1)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

export async function readProgressFile(file) {
  const text = await file.text();
  const blob = text.trim().startsWith("LVN1") ? decodeProgress(text) : JSON.parse(text);
  if (blob?.app !== "lavan") throw new Error("that isn't a Lavan progress file");
  return blob;
}

/* A link opened on the other device leaves the code in the address bar; the
   caller consumes it once and clears it so a refresh does not re-import. */
export function pendingRestore() {
  const m = /#restore=([A-Za-z0-9\-_]+)/.exec(location.hash || "");
  if (!m) return null;
  try {
    return decodeProgress(m[1]);
  } catch (e) {
    return null;
  }
}

export function clearRestoreHash() {
  try {
    history.replaceState(null, "", location.pathname + location.search);
  } catch (e) {
    location.hash = "";
  }
}
