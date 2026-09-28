/* Half-life regression: how long a word stays in memory.

   This is Duolingo's own spaced repetition model, as Settles and Meeder
   published it ("A Trainable Spaced Repetition Model for Language Learning",
   ACL 2016) and as Duolingo still describes its student model. A memory fades
   along Ebbinghaus's curve,

       p = 2^(−Δ/h)

   where p is the chance of recalling the word now, Δ the time since it was
   last practised, and h its half-life — the time it takes for that chance to
   fall to a half. The half-life is read off the word's history:

       h = 2^(θ·x)

   with x the square roots of how often it has been got right and got wrong
   (the square root is what worked best on their data), plus a constant.

   What this replaced. The course scheduled words on a Leitner ladder — which
   the same paper shows is HLR with two hand-picked weights, doubling on a
   right answer and halving on a wrong one — and then, in the last change,
   gave each word an ease of its own on top, the way SM-2 does. Duolingo
   tried the same idea at scale, a learned difficulty per word, and took it
   out: the per-word weights overfitted, learners complained that particular
   words "would decay rapidly, regardless of how often they practiced", and
   the model without them lifted daily retention by 12%. So there is no ease
   here. What a word's own history says about it is said by its counts, which
   is where Duolingo left it.

   The weights. Duolingo's trained weights were never published, and nothing
   here has the millions of learning traces it would take to fit them. So they
   are fitted to the ladder the course already used, which is the schedule
   every learner's history was built under: one right answer holds a word for
   about four hours, then a day, three days, eight and three weeks — and it
   keeps going past the ladder's top rung toward Duolingo's own cap of nine
   months, instead of stopping at three weeks for ever. One wrong answer
   halves the half-life of a word nobody has got wrong before; the square root
   makes each further one cost less. And a word is due when its recall falls to
   a half, which is what the half-life is. */

const DAY = 86400000;

/* log2 of the half-life in days: right and wrong on √(1 + count), and a
   constant. Least squares against the old ladder; see check-learner. */
export const THETA = { right: 6.536, wrong: -2.414, bias: -9.198 };

/* Duolingo's own bounds: no half-life under fifteen minutes or over nine
   months, and no probability of exactly 0 or 1. */
export const MIN_H = 15 / (24 * 60);
export const MAX_H = 274;

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/* The half-life in days of a word got right `right` times and wrong `wrong`
   times. Counts may be fractional: an answer that needed help is half of
   each. */
export function halfLife(right, wrong) {
  const x = THETA.right * Math.sqrt(1 + Math.max(0, right))
    + THETA.wrong * Math.sqrt(1 + Math.max(0, wrong))
    + THETA.bias;
  return clamp(2 ** x, MIN_H, MAX_H);
}

/* The chance of recalling it `lag` days after it was practised. */
export const recall = (lag, h) => clamp(2 ** (-Math.max(0, lag) / h), 0.0001, 0.9999);

/* A stored word's counts: `ok` is what it was got right, `seen` every time it
   was asked about. */
export const countsOf = (w) => ({ right: w?.ok || 0, wrong: Math.max(0, (w?.seen || 0) - (w?.ok || 0)) });

/* The half-life a stored word carries, in days — worked out from its counts
   for a word saved before half-lives were kept. */
export const halfLifeOf = (w) => (w?.h > 0 ? w.h : halfLife(countsOf(w).right, countsOf(w).wrong));

/* How likely a stored word is to be recalled now, 0 to 1.

   Read off its review date rather than off when it was last answered, so the
   two stay one fact: a word is due exactly when this reaches a half. That is
   also what lets a word met in passing be kept from fading (touchWords) without
   pretending it was answered. A save from before half-lives measures the
   window it had, and one with no dates at all can only say whether it is due. */
export function recallNow(w, now = Date.now()) {
  if (!w) return 0;
  const span = w.h > 0 ? w.h * DAY : (w.at && (w.due || 0) > w.at ? w.due - w.at : 0);
  if (!span) return (w.due || 0) > now ? 1 : 0;
  return clamp(2 ** (((w.due || 0) - now) / span - 1), 0, 1);
}

/* The rung of the old ladder a half-life corresponds to, 0 to 5 — the stars
   beside a word, and "held" for the weak-spots list. The cut points are
   halfway, on a log scale, between the ladder's steps, so k right answers in a
   row still show k stars. */
const RUNGS = [2 / 24, 0.41, 1.73, 4.58, 12.1];
export const rungOf = (h) => RUNGS.filter((r) => h >= r).length;
