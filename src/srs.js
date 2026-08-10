/* Spaced repetition (Leitner boxes) for My Words.
   Each saved word carries {box, due, seen, lapses}; missing fields mean the
   word has never been reviewed and is due immediately. */

export const SRS_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30];
const DAY = 86400000;

export const isDue = (entry, now = Date.now()) => (entry?.due ?? 0) <= now;

export const dueCount = (saved, now = Date.now()) =>
  Object.values(saved).filter((e) => isDue(e, now)).length;

export function srsAnswer(entry, knew, now = Date.now()) {
  const seen = (entry?.seen ?? 0) + 1;
  if (!knew) {
    return { ...entry, box: 0, due: now, seen, lapses: (entry?.lapses ?? 0) + 1 };
  }
  const box = Math.max(0, Math.min(entry?.box ?? 0, SRS_INTERVALS_DAYS.length - 1));
  const nextBox = Math.min(box + 1, SRS_INTERVALS_DAYS.length - 1);
  return { ...entry, box: nextBox, due: now + SRS_INTERVALS_DAYS[nextBox] * DAY, seen };
}

/* Human label for the words screen: "due now" / "in 3d" */
export function dueLabel(entry, now = Date.now()) {
  const due = entry?.due ?? 0;
  if (due <= now) return "due";
  const days = Math.ceil((due - now) / DAY);
  return `in ${days}d`;
}
