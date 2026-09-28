/* Learning the learner.

   The schedule already knows when each word and each sentence was last got
   right, and the units know how each one went. What nothing knew was how
   somebody goes wrong — and that is most of what a teacher notices. Two
   learners at 75% can be missing entirely different things: one hears every
   word and cannot put an ending on a verb, the other writes perfect Hebrew
   and cannot catch it spoken. Marked the same, they were practised the same.

   So every answer leaves more behind than a tick or a cross:

   - which skill it was — reading, writing, listening, speaking, word meanings,
     a word in its sentence — and whether it needed help: a tap-hint opened, a
     sentence played slowly, a "Close!" to put it right, or "I don't know";
   - what kind of mistake it was, where it was one — a pronoun, an ending, a
     letter on the front of a word, the order, a word left out or added, or a
     different word altogether — and whether the learner then asked to have it
     explained, which is the plainest sign there is that they did not see why;
   - which two words they took for each other, where a wrong pick or a wrong
     pair says so.

   How good somebody is at each skill is estimated the way Duolingo's
   Birdbrain first did it (IEEE Spectrum, 2023): a logistic model out of item
   response theory, where the chance of getting an exercise right is the
   learner's ability set against the exercise's difficulty, the difficulty is
   the sum of the difficulties of its parts — the kind of exercise and the
   words in it — and every answer moves the ability one step, further the more
   the answer surprised the model. That step is the Elo rating system, which
   is what Duolingo says it amounts to. The words' part is read off their
   half-lives (hlr.js): a sentence full of words about to be forgotten is a
   harder sentence for this learner than the same one a day after practising
   them.

   Nothing here decides anything on its own. `diagnose` reads it back as the
   few things worth saying — the skill that lags, the mistake that keeps
   coming back, the words that keep slipping — and `focusOf` hands the lesson
   builder the same thing as weights and as a predicted chance per exercise,
   so practice leans on what is weak and is pitched at the difficulty that
   teaches rather than drawing evenly from what is there.

   Plain data and pure functions, like the rest of the store: the session
   builds the events, state.js keeps the profile, and the check script can run
   all of it without a browser. */

import { recallNow } from "./hlr.js";

const DAY = 86400000;

/* The skills an exercise can exercise, and roughly what a learner who is
   keeping up gets on each on the first try. They are not the same number: a
   pick of one word from three is easier than writing a sentence in Hebrew,
   and a model that compared the two straight would call writing weak for
   everybody and so for nobody. So each is the prior difficulty of its kind of
   exercise — Birdbrain's per-type difficulty, which Duolingo fits across
   millions of learners and this can only set by hand — and a skill's ability
   is measured from there: zero is keeping up, below zero is lagging. */
export const SKILLS = {
  read: { label: "Reading Hebrew", short: "reading", expect: 0.8 },
  write: { label: "Writing Hebrew", short: "writing Hebrew", expect: 0.7 },
  listen: { label: "Listening", short: "listening", expect: 0.75 },
  speak: { label: "Speaking", short: "speaking", expect: 0.75 },
  words: { label: "Word meanings", short: "word meanings", expect: 0.9 },
  cloze: { label: "Words in a sentence", short: "filling gaps", expect: 0.85 },
};

/* The kinds of mistake the marking can tell apart, each with the one thing
   worth knowing about it. The tip is the rule rather than the error, for the
   same reason the Explain note leads with the rule: it is the part that
   carries over to the next sentence. */
export const KINDS = {
  pronoun: {
    label: "Pronouns", short: "pronouns",
    tip: "הוא or היא, אתה or את — and the endings that carry them, as in שלו, שלה, לי, לך.",
  },
  ending: {
    label: "Endings", short: "endings",
    tip: "The right word with the wrong end on it: ה or ת for a woman, ים or ות for more than one, and the person a verb is in.",
  },
  prefix: {
    label: "The letters on the front", short: "the letters on the front",
    tip: "ה for “the”, ו for “and”, ב ל כ מ for “in”, “to”, “like”, “from”, and ש for “that” — one letter, joined to the next word.",
  },
  order: {
    label: "Word order", short: "word order",
    tip: "All the right words in the wrong order. The adjective comes after its noun: ספר טוב, “a good book”.",
  },
  gaps: {
    label: "A word left out or added", short: "missing words",
    tip: "Often את before a definite object, or an “is” that Hebrew does not say in the present.",
  },
  vocab: {
    label: "A different word", short: "vocabulary",
    tip: "Not a slip but another word altogether: the meaning is the thing to practise, and the words listed here are where to start.",
  },
};

/* First attempts kept per skill before the count ages, the way a unit's are:
   past this the counts halve, so the reading follows how the skill is going
   now rather than how it went in the first month. */
const SKILL_WINDOW = 60;
/* How long a mistake keeps half its weight. A month: long enough that a habit
   shows, short enough that one fixed stays fixed rather than being brought up
   for ever. */
const HALF_LIFE_DAYS = 30;
/* Answers on a skill before it is judged — eight is a thin reading, but it is
   compared with the skill's own mark rather than taken as a verdict. */
const MIN_SKILL = 8;
/* An ability this far below keeping up is a lagging skill: at a typical
   exercise of its kind, somewhere around six to eight points under the mark. */
const WEAK_AT = -0.35;
/* Answers in all before any of this is shown. Twenty is a lesson and a half:
   enough for a pattern to be a pattern rather than one bad sentence. */
export const READY_AT = 20;
/* Mistakes of known kind before any one kind is called a habit, and the share
   of them it has to take. */
const MIN_KINDS = 4;
const HABIT_SHARE = 0.25;
/* A confusion has to happen about once before it is worth putting the two
   words side by side, and the list is kept short: it is advice, not a log. */
const RIVAL_AT = 0.9;
const KEEP_RIVALS = 40;

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round = (x) => Math.round(x * 1000) / 1000;

/* The letters of a Hebrew word and nothing else: no vowel points, no
   punctuation. The same reduction exercises.js makes, written out here so this
   module does not pull the whole exercise builder in behind it. */
export const bareWord = (w) => String(w || "").replace(/[֑-ׇ]/g, "").replace(/[^א-ת0-9]/g, "");

export const freshProfile = () => ({ skills: {}, kinds: {}, rivals: {}, explains: null });

/* A count that fades: what `n` is worth by `now`, having been written at `at`. */
export const decayed = (rec, now = Date.now()) =>
  rec ? (rec.n || 0) * Math.pow(0.5, Math.max(0, now - (rec.at || 0)) / (HALF_LIFE_DAYS * DAY)) : 0;
const bump = (rec, by, now) => ({ n: round(decayed(rec, now) + by), at: now });

/* ------------------------------------------------------------------ */
/* Which skill an exercise is                                           */
/* ------------------------------------------------------------------ */
/* Null for the drills that are about something else: the alphabet's letters
   and the root families carry no words and are practised on their own. */
export function skillOf(ex) {
  switch (ex?.type) {
    case "bank": case "type": return ex.lang === "he" ? "write" : "read";
    case "listen": return "listen";
    case "speak": return "speak";
    case "blank": return "cloze";
    case "match": return "words";
    case "select": return ex.words?.length ? "words" : null;
    default: return null;
  }
}

/* ------------------------------------------------------------------ */
/* Taking an answer in                                                  */
/* ------------------------------------------------------------------ */
/* One exercise, once it is settled — after any Explain, after any late ruling
   from the grader, so a mark taken back is not counted as a mistake.

   `first` is whether this was the question's first showing: a skill is read
   off first attempts only, for the reason the units are — a question got
   right on its third go inside the same lesson is a question got wrong.
   `kinds` are the mistakes in a final wrong answer, `nudged` the one a
   "Close!" named before it was put right, `rivals` pairs of bare Hebrew
   words taken for each other. `expected` is the chance the model gave this
   answer of being right before it was given (predictCorrect), which is what
   the ability moves against; without it, the chance at an exercise of this
   kind with nothing forgotten in it. */
export function noteExercise(profile, e, now = Date.now()) {
  const p = { ...freshProfile(), ...(profile || {}) };
  let { skills, kinds, rivals, explains } = p;

  if (e.first && e.skill && SKILLS[e.skill]) {
    const prev = skills[e.skill] || { n: 0, ok: 0, aided: 0, gave: 0, at: 0 };
    const aged = prev.n >= SKILL_WINDOW;
    const half = (x) => (aged ? Math.round((x || 0) / 2) : x || 0);
    /* The Elo step. A right answer the model was sure of moves the ability
       hardly at all; a wrong one it was sure of moves it a long way. A right
       answer that needed help scores half, as it does for its words. */
    const ability = abilityOf(prev, e.skill);
    const expected = e.expected ?? sigmoid(ability - TYPE_DIFFICULTY[e.skill]);
    const scored = e.ok ? (e.aided ? 0.5 : 1) : 0;
    skills = {
      ...skills,
      [e.skill]: {
        n: half(prev.n) + 1,
        ok: half(prev.ok) + (e.ok ? 1 : 0),
        aided: half(prev.aided) + (e.aided ? 1 : 0),
        gave: half(prev.gave) + (e.gaveUp ? 1 : 0),
        ability: round(clamp(ability + ELO_K * (scored - expected), -MAX_ABILITY, MAX_ABILITY)),
        at: now,
      },
    };
  }

  const weigh = (list, by) => {
    for (const k of new Set(list || [])) {
      if (!KINDS[k]) continue;
      if (kinds === p.kinds) kinds = { ...kinds };
      kinds[k] = bump(kinds[k], by, now);
    }
  };
  /* A mistake counts whole; one a "Close!" caught counts half, since the
     learner put it right themselves once it was pointed at. Asking why counts
     on top: a mistake nobody could see the reason for is the one most worth
     coming back to. */
  if (e.first) {
    weigh(e.kinds, 1);
    weigh(e.nudged, 0.5);
  }
  if (e.explained && !e.ok) {
    explains = bump(explains, 1, now);
    weigh(e.kinds, 0.5);
  }

  for (const [x, y] of e.rivals || []) {
    const a = bareWord(x), b = bareWord(y);
    if (!a || !b || a === b) continue;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const key = `${lo}|${hi}`;
    if (rivals === p.rivals) rivals = { ...rivals };
    rivals[key] = { ...bump(rivals[key], 1, now), a: lo, b: hi };
  }
  if (rivals !== p.rivals && Object.keys(rivals).length > KEEP_RIVALS) {
    rivals = Object.fromEntries(Object.entries(rivals)
      .sort((x, y) => decayed(y[1], now) - decayed(x[1], now))
      .slice(0, KEEP_RIVALS));
  }

  return { ...p, skills, kinds, rivals, explains };
}

/* ------------------------------------------------------------------ */
/* Will they get it right?                                              */
/* ------------------------------------------------------------------ */
/* Birdbrain's first model, as Duolingo described it: the chance of a right
   answer is a logistic function of the learner's ability minus the exercise's
   difficulty, and the difficulty is a sum over the exercise's parts. Here the
   parts are its kind — the prior difficulty in SKILLS — and its words, each of
   which adds difficulty for how far it has faded (its half-life recall, from
   hlr.js). A word just practised adds nothing; one fully forgotten adds
   WORD_WEIGHT, which is enough to take a typical sentence from a four-in-five
   chance to about a half. The ability is per skill, which is the part of
   Birdbrain's second model this can afford: it knows "good at reading, weak
   at listening" without an LSTM behind it. */
const logit = (p) => Math.log(p / (1 - p));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
export const TYPE_DIFFICULTY = Object.fromEntries(Object.entries(SKILLS).map(([id, s]) => [id, -logit(s.expect)]));
const WORD_WEIGHT = 1.5;
/* How far one surprising answer moves an ability. Birdbrain takes one step of
   gradient descent per exercise; this is the size of that step, and the cap
   keeps a long bad run from pinning a skill somewhere no answer can recover
   it from. */
const ELO_K = 0.3;
const MAX_ABILITY = 4;
/* A word the record has never seen answered — met in a sentence, never asked
   about — counts as mostly known: it is in the course's practice because the
   lessons behind it taught it. */
const UNRECORDED = 0.85;

/* A skill's ability, or — for a record kept before abilities were — a
   starting estimate from its accuracy against the skill's mark, shrunk toward
   keeping up by how few answers it rests on. */
function abilityOf(r, id) {
  if (r?.ability != null) return r.ability;
  if (!r?.n || !SKILLS[id]) return 0;
  const acc = clamp(r.ok / r.n, 0.05, 0.95);
  return round(clamp(logit(acc) - logit(SKILLS[id].expect), -MAX_ABILITY, MAX_ABILITY) * (r.n / (r.n + 10)));
}

export const abilitiesOf = (profile) => Object.fromEntries(
  Object.entries(profile?.skills || {}).map(([id, r]) => [id, abilityOf(r, id)]));

/* Every word's recall now, by its bare letters, taking the weaker where two
   spellings reduce to the same word. */
export function recallMap(words, now = Date.now()) {
  const out = {};
  for (const [he, w] of Object.entries(words || {})) {
    const b = bareWord(he);
    if (!b) continue;
    const p = recallNow(w, now);
    out[b] = b in out ? Math.min(out[b], p) : p;
  }
  return out;
}

/* The chance this learner gets `ex` right, or null for an exercise that is
   about something else (a letter, a root). `model` is { abilities, recall }. */
export function predictCorrect(model, ex) {
  const skill = skillOf(ex);
  if (!skill || !SKILLS[skill]) return null;
  let faded = 0;
  for (const w of ex.words || []) faded += 1 - (model?.recall?.[bareWord(w.he)] ?? UNRECORDED);
  return sigmoid((model?.abilities?.[skill] || 0) - TYPE_DIFFICULTY[skill] - WORD_WEIGHT * faded);
}

/* An answer is right, right with help, or wrong. A boolean is how every caller
   used to say it and still may. */
export const gradeOf = (x) =>
  x === "good" || x === "hard" || x === "again" ? x : x ? "good" : "again";

/* The same meaning looked up again inside this long is the same moment of not
   knowing it, not another one: a word tapped on page three and again on page
   five of one sitting is one lapse. */
export const LOOK_GAP = 3600000;

/* ------------------------------------------------------------------ */
/* Reading it back                                                      */
/* ------------------------------------------------------------------ */
function rivalRows(p, words, now) {
  const enOf = {};
  for (const [he, w] of Object.entries(words || {})) {
    const b = bareWord(he);
    if (b && !enOf[b]) enOf[b] = w.en || "";
  }
  return Object.values(p?.rivals || {})
    .map((r) => ({ a: r.a, b: r.b, ae: enOf[r.a] || "", be: enOf[r.b] || "", weight: decayed(r, now) }))
    .filter((r) => r.weight >= RIVAL_AT)
    .sort((x, y) => y.weight - x.weight);
}

/* A word that keeps slipping: missed more than once, or looked up more than
   once, and not since climbed back to where a word is plainly held. The
   level is the check on the history — a word missed twice in March and right
   five times since is not trouble any more. */
const SOLID = 4;
function troubleWords(words, now = Date.now()) {
  return Object.entries(words || {})
    .map(([he, w]) => {
      const lapses = w.lapses || 0, looks = w.looks || 0;
      return { he, en: w.en || "", lapses, looks, level: w.level || 0,
        score: lapses + 0.5 * looks, p: recallNow(w, now) };
    })
    .filter((w) => w.level < SOLID && (w.lapses >= 2 || w.looks >= 2 || w.lapses + w.looks >= 3))
    /* the most missed first, and between two missed as often, the one nearer
       to being forgotten */
    .sort((a, b) => b.score - a.score || a.p - b.p);
}

/* What is worth saying about this learner, or `ready: false` while there is
   not enough to say anything. `words` is the course's word map, read for the
   words that keep slipping and for the English of the pairs mixed up. */
export function diagnose(profile, words = {}, now = Date.now()) {
  const p = profile || freshProfile();
  const answered = Object.values(p.skills || {}).reduce((a, r) => a + (r?.n || 0), 0);

  /* Each skill by its ability: how far this learner sits from somebody keeping
     up at that kind of exercise, measured against what each answer was
     expected to be — so a skill is not called weak for having been given hard
     sentences, and a right answer that needed a slowed-down replay counts for
     less than one that did not. The accuracy is kept to show, since "64%
     right" is a number a person can read and a logit is not. */
  const skills = Object.entries(SKILLS).map(([id, s]) => {
    const r = p.skills?.[id];
    if (!r || r.n < MIN_SKILL) return null;
    const acc = r.ok / r.n, aided = (r.aided || 0) / r.n, gave = (r.gave || 0) / r.n;
    const ability = abilityOf(r, id);
    return { id, label: s.label, short: s.short, n: r.n, acc, aided, gave, ability, weak: ability <= WEAK_AT };
  }).filter(Boolean).sort((a, b) => a.ability - b.ability);

  /* Kinds as a share of the mistakes that could be classified: "what goes
     wrong when it goes wrong". A raw count would only say who has answered
     the most questions. */
  const rows = Object.entries(KINDS)
    .map(([id, k]) => ({ id, label: k.label, short: k.short, tip: k.tip, weight: decayed(p.kinds?.[id], now) }))
    .filter((k) => k.weight >= 0.05);
  const total = rows.reduce((a, k) => a + k.weight, 0);
  const kinds = rows.map((k) => ({
    ...k,
    share: total ? k.weight / total : 0,
    weak: total >= MIN_KINDS && k.weight >= 1.5 && k.weight / total >= HABIT_SHARE,
  })).sort((a, b) => b.weight - a.weight);

  const trouble = troubleWords(words, now);
  const rivals = rivalRows(p, words, now);

  const weakSkills = skills.filter((s) => s.weak);
  const weakKinds = kinds.filter((k) => k.weak && k.id !== "vocab");
  const parts = [...weakSkills.slice(0, 2).map((s) => s.short), ...weakKinds.slice(0, 2).map((k) => k.short)].slice(0, 3);
  if (!parts.length && trouble.length) parts.push(`${trouble.length} word${trouble.length === 1 ? "" : "s"} that keep slipping`);
  const summary = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0] || "";

  return {
    ready: answered >= READY_AT,
    answered,
    left: Math.max(0, READY_AT - answered),
    skills, kinds, trouble: trouble.slice(0, 8), rivals: rivals.slice(0, 4),
    /* how many mistakes the kinds are shares of, recent ones weighing most */
    mistakes: total,
    habitsShown: total >= MIN_KINDS,
    explains: decayed(p.explains, now),
    summary,
  };
}

/* The same reading, as the lesson builder wants it: a weight per skill for the
   exercise makers, the share of each habit worth leaning sentences towards,
   the words to aim gaps at, each word's rivals to put beside it as the wrong
   answer — and the model itself, abilities and recall, so the builder can ask
   of every exercise it drafts how likely this learner is to get it right.
   Plain objects, so buildSession takes it without knowing where it came from.

   The rivals, the words and the model are handed over as soon as there are
   any — putting two words that were mixed up side by side is right after one
   mix-up, and a word's recall is known from its first answer. The weights wait
   until the profile is `ready`, because leaning a whole session on eight
   answers is leaning it on noise. */
export function focusOf(profile, words = {}, now = Date.now()) {
  const d = diagnose(profile, words, now);
  const skills = {};
  const kinds = {};
  if (d.ready) {
    /* a lagging skill weighs up to three times its usual share, and one well
       ahead of its mark drops back a little rather than out */
    for (const s of d.skills) skills[s.id] = round(clamp(1 - s.ability, 0.7, 3));
    /* "a different word" is answered by aiming at the words, not the grammar */
    for (const k of d.kinds) if (k.weak && k.id !== "vocab") kinds[k.id] = round(k.share);
  }
  const rivals = {};
  for (const r of rivalRows(profile, words, now)) {
    (rivals[r.a] ||= []).push(r.b);
    (rivals[r.b] ||= []).push(r.a);
  }
  return {
    ready: d.ready, skills, kinds, rivals,
    words: troubleWords(words, now).slice(0, 12).map((w) => w.he),
    abilities: abilitiesOf(profile),
    recall: recallMap(words, now),
  };
}
