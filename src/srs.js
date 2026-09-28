/* Spaced repetition (Leitner boxes) for My Words.
   Each saved word carries {box, due, seen, lapses}; missing fields mean the
   word has never been reviewed and is due immediately. It also carries an
   ease — how hard this word has been for this reader, the same measure the
   course keeps for its own words (see duo/learner.js) — which stretches or
   shrinks the box's interval, and `looks`, how often its meaning has been
   looked up in a book. */

import { nextEase, easeFactor, gradeOf, LOOK_GAP } from "./duo/learner.js";

export const SRS_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30];
const DAY = 86400000;

export const isDue = (entry, now = Date.now()) => (entry?.due ?? 0) <= now;

export const dueCount = (saved, now = Date.now()) =>
  Object.values(saved).filter((e) => isDue(e, now)).length;

/* `knew` is true or false, or a grade: "good" moves up a box, "hard" — right,
   but with help — stays in the box it is in, and "again" goes back to the
   first. */
export function srsAnswer(entry, knew, now = Date.now()) {
  const grade = gradeOf(knew);
  const seen = (entry?.seen ?? 0) + 1;
  const ease = nextEase(entry?.ease, grade);
  if (grade === "again") {
    return { ...entry, box: 0, due: now, seen, lapses: (entry?.lapses ?? 0) + 1, ease };
  }
  const box = Math.max(0, Math.min(entry?.box ?? 0, SRS_INTERVALS_DAYS.length - 1));
  const nextBox = grade === "good" ? Math.min(box + 1, SRS_INTERVALS_DAYS.length - 1) : box;
  return { ...entry, box: nextBox, due: now + SRS_INTERVALS_DAYS[nextBox] * DAY * easeFactor(ease), seen, ease };
}

/* A word looked up again in a book. Every lookup is counted, one per sitting,
   so the reader can say when a word keeps being looked up without being
   starred. A starred word is in practice already, and looking it up is a
   review failed in the wild: it comes due now, a box lower. */
export function srsLookup(entry, now = Date.now()) {
  if (!entry || now - (entry.lookedAt || 0) < LOOK_GAP) return entry;
  const looks = (entry.looks || 0) + 1;
  if (!entry.star) return { ...entry, looks, lookedAt: now };
  return {
    ...entry,
    looks,
    lookedAt: now,
    ease: nextEase(entry.ease, "look"),
    box: Math.max(0, (entry.box ?? 0) - 1),
    due: Math.min(entry.due ?? now, now),
  };
}

/* Human label for the words screen: "due now" / "in 3d" */
export function dueLabel(entry, now = Date.now()) {
  const due = entry?.due ?? 0;
  if (due <= now) return "due";
  const days = Math.ceil((due - now) / DAY);
  return `in ${days}d`;
}
