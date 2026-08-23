/* Exercise generation.

   A unit arrives with its share of the course's own sentence bank — 7,615
   sentences harvested from the session API, seventeen to a hundred and forty
   per unit — plus the four to six guidebook key phrases that are the only ones
   carrying a recording, and the vocabulary the skill introduces. Lessons are
   drawn from all three, with older units mixed in for review and for
   distractors that are plausible rather than absurd.

   Everything is seeded. Lesson 2 of a node is not lesson 1 reshuffled, but
   re-opening lesson 2 after a crash gives back the same lesson. */

import { mulberry32 } from "./rand.js";
import { removeNikkud } from "../text.js";
import { LETTERS, lettersUpTo } from "./alphabet.js";
import { pictureFor } from "./images.js";
import { ROOTS, fitsRoot } from "./roots.js";
import { canonEn } from "./synonyms.js";

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */
export const normEn = (s) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

export const tokenizeHe = (s) =>
  String(s || "").split(/\s+/).map((w) => w.replace(/[.,!?;:"'׳״()]/g, "")).filter(Boolean);

/* One Hebrew word, reduced to what marking should turn on: the letters and the
   digits, without the vowel points or the punctuation. */
export const bareHe = (w) => removeNikkud(String(w || "")).replace(/[^֐-׿0-9]+/g, "");

/* A whole sentence, the same way.

   It is built out of the same tokenizer the word bank is built from, because
   the two disagreeing is a way to mark a right answer wrong. They did: a score
   inside a sentence — "בתוצאה 30:25" — became one tile, "3025", while the
   sentence it came from was being read as two words with nothing between them.
   Digits used to be thrown away here along with the punctuation, which also
   meant "3 children" and "5 children" were the same sentence to the marker. */
export const normHe = (s) => tokenizeHe(s).map(bareHe).filter(Boolean).join(" ");

export const norm = (s, lang) => (lang === "he" ? normHe(s) : normEn(s));

/* Hebrew glues its short function words onto the front of the next word — the
   ו of "and", the ה of "the", the ב ל כ מ of the prepositions, the ש that opens a
   clause — so ולילד and ילד are the same word to anyone asking whether this
   sentence is readable yet. One letter is as far as this goes: it is a
   heuristic for weighing a sentence, not a morphological analyser, and
   stripping two starts turning ordinary words into other ordinary words.

   The stem is never stored, only asked after: a word is met if the learner has
   met it, or has met what is left of it once a prefix comes off. */
const PREFIXES = "והבלכמש";
export const heStem = (w) => (w.length > 2 && PREFIXES.includes(w[0]) ? w.slice(1) : w);
/* Is `w` one of the forms in `set` — allowing the one prefix letter heStem
   takes off, because a sentence says הטענה where the word list says טענה.
   Exported so the checks measure targeting by the same rule the builder aims
   by; measured letter-for-letter instead, every prefixed hit reads as a miss. */
export const holds = (set, w) => set.has(w) || set.has(heStem(w));

/* Nearly right.

   A sentence answered with one word wrong is not the same event as a sentence
   answered with no idea, and marking both of them "Correct solution: …" throws
   away the only interesting thing about the first one: the learner had it, and
   missed by a pronoun. So a near miss gets said out loud and gets another go,
   and the answer stays hidden — a hint that names the kind of mistake is a
   thing to think about, and the answer is a thing to copy.

   Near means one word out: one wrong, one missing, one too many, or all the
   right words in the wrong order. Two is not a slip.

   The hint never says which word or what it should be. "Check the pronoun" is
   enough to find הוא where you wrote היא, and does not tell anyone who wrote
   nothing of the sort what to put. */

/* the pronouns, which are what a near miss is usually about */
const HE_PRONOUNS = new Set(`
אני אתה את הוא היא אנחנו אתם אתן הם הן
אותי אותך אותה אותו אותנו אתכם אתכן אותם אותן
שלי שלך שלו שלה שלנו שלכם שלכן שלהם שלהן
לי לך לו לה לנו לכם להם להן
`.trim().split(/\s+/));

const EN_PRONOUNS = new Set(`
i you he she it we they me him her us them
my your his its our their mine yours hers ours theirs
myself yourself himself herself itself ourselves themselves
`.trim().split(/\s+/));

/* Levenshtein over whole words, and it stops caring past two: everything this
   is asked is "is that one word out", and the answer to "is it nine" is no. */
function wordEdits(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag : 1 + Math.min(prev[j], prev[j - 1], diag);
      diag = t;
    }
  }
  return prev[b.length];
}

const sameBag = (a, b) => a.length === b.length && [...a].sort().join(" ") === [...b].sort().join(" ");

/* The one word that differs, where exactly one does. Walks in from both ends,
   which is all it takes once the lengths match and the edit count is one. */
function theOddWord(given, want) {
  let i = 0;
  while (i < given.length && given[i] === want[i]) i++;
  return i < given.length ? [given[i], want[i]] : null;
}

function howItDiffers(given, want, lang) {
  const pronouns = lang === "he" ? HE_PRONOUNS : EN_PRONOUNS;
  if (pronouns.has(given) || pronouns.has(want)) return "Check the pronoun.";
  if (lang !== "he") return "One word isn't right.";
  /* one is the other with something on the end — גדול for גדולה, כותב for
     כותבת — which is the agreement rather than the word */
  if (given.startsWith(want) || want.startsWith(given)) return "Right word, wrong ending.";
  /* one is the other with a letter on the front: the ה of "the", the ו of
     "and", the ב ל כ מ of the prepositions */
  if (heStem(given) === want || given === heStem(want) || heStem(given) === heStem(want)) {
    return "Check the little letter on the front of a word.";
  }
  return "One word isn't the right one.";
}

/* "" when the answer is not close, so the caller can treat this as a question
   worth asking rather than a verdict worth softening. */
export function nearMiss(ex, response) {
  if (!ex || ex.type === "select" || ex.type === "blank" || ex.type === "match"
      || ex.type === "speak" || ex.type === "new") return "";
  const lang = ex.lang || "he";
  const line = (v) => (typeof v === "string" ? norm(v, lang) : (v || []).map((t) => norm(t, lang)).filter(Boolean).join(" "));
  const given = line(response).split(" ").filter(Boolean);
  if (!given.length) return "";

  /* against whichever accepted answer it came closest to: a translation marked
     against the one the course happens to list first is marked against the
     wrong sentence */
  const wants = (ex.accepted?.length ? ex.accepted : [ex.display, ex.answer])
    .filter(Boolean)
    .map((a) => line(a).split(" ").filter(Boolean))
    .filter((w) => w.length);
  if (!wants.length) return "";

  let best = null;
  for (const want of wants) {
    const edits = wordEdits(given, want);
    if (!best || edits < best.edits) best = { want, edits };
  }
  const { want, edits } = best;
  if (edits === 0) return "";                      /* right: not this function's business */
  /* the right words in the wrong order is one thing to say and cannot be
     reached by counting substitutions */
  if (sameBag(given, want)) return "All the right words — not in that order.";
  if (edits > 1) return "";                        /* two out is not a slip */
  if (given.length === want.length) {
    const pair = theOddWord(given, want);
    return pair ? howItDiffers(pair[0], pair[1], lang) : "One word isn't right.";
  }
  return given.length < want.length ? "Something is missing." : "There's a word too many.";
}

/* The copy of a wrong question that goes to the back of the queue.

   A lesson is over when the queue is empty, so a question that keeps coming
   back is a question that has not been got right yet. Two things have to hold
   for that to work: every copy needs its own key, because the player tracks
   where it is by key and two live items answering to one name is a loop; and
   every copy has to remember the question it came from, because the mistake
   store is keyed by question, and a word missed four times that files four
   mistakes has spent four of the sixty slots it keeps on one word. */
export function retryOf(ex) {
  const base = ex.base || ex.key;
  const tries = (ex.tries || 1) + 1;
  return { ...ex, key: `${base}#${tries}`, base, retry: true, tries };
}

/* Sentences are recorded under the same key the pools de-duplicate them by, so
   one line met as a translation, as a dictation and as a blank is one sentence
   carrying one schedule rather than three. */
export const sentenceKey = (he) => normHe(he);

/* The Hebrew sentence an exercise is about, or "" where it is about a word
   rather than a sentence. Spelled out by type rather than sniffed off
   `promptLang`, because a multiple-choice question about a single word has a
   Hebrew prompt too and is not a sentence. */
export const exerciseSentence = (ex) => {
  switch (ex?.type) {
    case "bank": return ex.lang === "he" ? ex.display : ex.prompt;
    case "listen": return ex.text;
    case "blank": return ex.full;
    case "speak": return ex.prompt;
    default: return "";
  }
};

/* Marking should not turn on spelling. A typed answer within a few edits of an
   accepted one is the same answer with a slip in it — Duolingo forgives these
   too — so the distance allowed grows with the length of the sentence. */
function editDistance(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 8) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

export function closeEnough(given, want) {
  if (!given || !want) return false;
  if (given === want) return true;
  const budget = Math.min(3, Math.floor(want.length * 0.12));
  return budget > 0 && editDistance(given, want) <= budget;
}

/* Marking a normalised answer against a normalised translation.

   Into English there is a second try with both sides put through the synonym
   table, because the course ships one wording and there is always another:
   it writes יָפָה as "pretty" in one sentence and "beautiful" in the next, and
   whichever it happened to choose here, the other one is right too. */
export const sameAnswer = (given, want, lang) =>
  closeEnough(given, want)
  || (lang !== "he" && closeEnough(canonEn(given), canonEn(want)));

/* Tiles keep the sentence's own spelling — "I", not "i" — because a word bank
   that lowercases its tiles reads as a bug. Marking normalises instead. */
export const tokenizeEn = (s) =>
  String(s || "").split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z0-9'’]+|[^A-Za-z0-9'’]+$/g, ""))
    .filter(Boolean);

/* ------------------------------------------------------------------ */
/* Random, but repeatable                                              */
/* ------------------------------------------------------------------ */
function rng(seed) {
  const r = mulberry32(seed >>> 0);
  const rand = () => r();
  rand.int = (n) => Math.floor(r() * n);
  rand.pick = (arr) => arr[Math.floor(r() * arr.length)];
  rand.shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  rand.sample = (arr, n) => rand.shuffle(arr).slice(0, n);
  return rand;
}

const hash = (s) => [...String(s)].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 17);

/* ------------------------------------------------------------------ */
/* Pools                                                               */
/* ------------------------------------------------------------------ */
/* `docs` are unit documents, newest last. The target unit's own material is
   weighted heavily; the units behind it supply review and distractors.

   Two kinds of sentence go in. The 367 guidebook key phrases carry Duolingo's
   own recording and its own hint table, and are the best material there is.
   The other 7,600 come from the sentence bank — the sentences the course
   actually serves — and get their tap-hints from the unit's glossary instead.
   A one-word "sentence" is not a sentence: those are the `assist` challenges,
   and they join the word pool. */
export function buildPools(docs, targetUnit) {
  const phrases = [];
  const words = [];
  const seenWord = new Set();
  const seenPhrase = new Set();

  const addWord = (w, unit) => {
    const key = normHe(w.he);
    if (!w.he || !w.en || seenWord.has(key)) return;
    seenWord.add(key);
    words.push({ ...w, unit, own: unit === targetUnit });
  };

  for (const d of docs) {
    const own = d.unit === targetUnit;
    const hints = d.hints || {};
    /* the glossary is keyed on Hebrew letters alone, so a word carrying a
       hyphen or a quote still finds its hint */
    const tokenize = (he) =>
      tokenizeHe(he).map((w) => {
        const key = w.replace(/[^֐-׿]/g, "");
        return hints[key] ? { w, h: hints[key].split(" / ") } : { w };
      });

    for (const p of d.phrases || []) {
      if (!p.he || !p.en) continue;
      const key = normHe(p.he);
      if (seenPhrase.has(key)) continue;
      seenPhrase.add(key);
      phrases.push({ he: p.he, en: p.en, alt: [], audio: p.audio, tokens: p.tokens, unit: d.unit, own, guide: true, kind: "t" });
    }

    for (const s of d.sentences || []) {
      if (!s.he || !s.en) continue;
      if (tokenizeHe(s.he).length < 2) { addWord({ he: s.he, en: s.en, alt: s.alt || [] }, d.unit); continue; }
      const key = normHe(s.he);
      if (seenPhrase.has(key)) continue;
      seenPhrase.add(key);
      phrases.push({
        he: s.he, en: s.en, alt: s.alt || [], audio: s.audio || "",
        tokens: tokenize(s.he), unit: d.unit, own, kind: s.t || "t",
      });
    }

    for (const w of d.words || []) addWord(w, d.unit);
  }
  return { phrases, words };
}

/* Every sense a word carries, normalised. Two words that share any sense
   cannot appear in the same question — "which one of these is you?" with both
   את and אתה on screen has two right answers. */
export const senses = (w) => [w.en, ...(w.alt || [])].map(normEn).filter(Boolean);
const clashes = (a, b) => {
  const s = new Set(senses(a));
  return senses(b).some((x) => s.has(x)) || a.he === b.he;
};

const distinctBy = (arr, f) => {
  const s = new Set();
  return arr.filter((x) => { const k = f(x); if (s.has(k)) return false; s.add(k); return true; });
};

/* ------------------------------------------------------------------ */
/* Builders — each returns an exercise or null                         */
/* ------------------------------------------------------------------ */
const MAX_BANK = 14;

function bankExercise(p, pool, rand, dir) {
  const toEn = dir === "en";
  const answer = toEn ? tokenizeEn(p.en) : tokenizeHe(p.he);
  if (answer.length < 1 || answer.length > 9) return null;

  const distractorSource = toEn
    ? pool.phrases.flatMap((q) => tokenizeEn(q.en)).concat(pool.words.flatMap((w) => tokenizeEn(w.en)))
    : pool.phrases.flatMap((q) => tokenizeHe(q.he)).concat(pool.words.map((w) => w.he));
  const lang = toEn ? "en" : "he";
  const used = new Set(answer.map((t) => norm(t, lang)));
  /* one tile per distinct word — two tiles reading "the" and "The" would be a
     puzzle about capitalisation rather than about Hebrew */
  const byNorm = new Map();
  for (const t of distractorSource) {
    const k = norm(t, lang);
    if (!t || !k || used.has(k) || byNorm.has(k) || t.split(" ").length > 1) continue;
    byNorm.set(k, t);
  }
  const extras = rand.sample(
    [...byNorm.values()],
    Math.min(MAX_BANK - answer.length, Math.max(3, 10 - answer.length))
  );

  return {
    type: "bank",
    lang: toEn ? "en" : "he",
    prompt: toEn ? p.he : p.en,
    promptLang: toEn ? "he" : "en",
    audio: toEn ? p.audio : "",
    hints: toEn ? p.tokens : null,
    instruction: toEn ? "Translate this sentence" : "Write this in Hebrew",
    answer,
    /* the same exercise can be typed instead of tapped, so it carries what a
       typed answer is marked against */
    accepted: toEn ? [p.en, ...(p.alt || [])] : [p.he],
    display: toEn ? p.en : p.he,
    tiles: rand.shuffle([...answer, ...extras]),
    words: p.tokens?.filter((t) => t.h).map((t) => ({ he: t.w, en: t.h[0] })) || [],
  };
}

function listenExercise(p, pool, rand) {
  const ex = bankExercise(p, pool, rand, "he");
  if (!ex) return null;
  return {
    ...ex,
    type: "listen",
    instruction: "Tap what you hear",
    prompt: "",
    promptLang: "",
    audio: p.audio,
    text: p.he,
    accepted: [p.he],
    display: p.he,
    solutionEn: p.en,
  };
}

function selectHeExercise(word, pool, rand, images) {
  /* Duolingo asked this one with photographs — three things on the screen and
     the word for one of them. It only works if every option has a picture,
     since a photograph beside two blank cards gives the answer away, so the
     distractors are drawn from words that have one whenever the answer does. */
  const picture = pictureFor(images, word);
  const rest = pool.words.filter((w) => !clashes(w, word));
  const withPictures = picture ? rest.filter((w) => pictureFor(images, w)) : [];
  const pictorial = withPictures.length >= 2;
  const others = rand.sample(pictorial ? withPictures : rest, 2);
  if (others.length < 2) return null;
  const options = rand.shuffle([word, ...others]).map((w) => ({
    he: w.he, en: w.en, ...(pictorial ? { img: pictureFor(images, w) } : {}),
  }));
  return {
    type: "select",
    instruction: `Which one of these is “${word.en}”?`,
    optionLang: "he",
    pictures: pictorial,
    options,
    answerIndex: options.findIndex((o) => o.he === word.he),
    display: word.he,
    words: [{ he: word.he, en: word.en }],
  };
}

function selectEnExercise(word, pool, rand) {
  const others = rand.sample(pool.words.filter((w) => !clashes(w, word)), 2);
  if (others.length < 2) return null;
  const options = rand.shuffle([word, ...others]).map((w) => ({ he: w.en, en: w.he }));
  return {
    type: "select",
    instruction: "What does this mean?",
    prompt: word.he,
    promptLang: "he",
    optionLang: "en",
    options,
    answerIndex: options.findIndex((o) => o.he === word.en),
    display: word.en,
    words: [{ he: word.he, en: word.en }],
  };
}

/* `want` is the set of bare forms this exercise is meant to be about: the words
   the lesson is teaching, or the ones that have come round again. The gap used
   to fall on whichever glossed word the shuffle landed on, which is a gap
   rather than a question — the sentence tests the word it blanks and nothing
   else, so blanking at random is the difference between practising what you
   came for and practising whatever happened to be in the line.

   It falls back to a glossed word and then to any word, so a sentence that
   does not happen to contain the target is still usable. */
function blankExercise(p, pool, rand, want = null) {
  const tokens = tokenizeHe(p.he);
  if (tokens.length < 3) return null;
  const glossed = (p.tokens || []).filter((t) => t.h && tokens.includes(t.w));
  const wanted = want ? tokens.filter((t) => holds(want, bareHe(t))) : [];
  const target = wanted.length ? rand.pick(wanted)
    : glossed.length ? rand.pick(glossed).w
    : rand.pick(tokens);
  const others = rand.sample(
    pool.words.filter((w) => !tokens.includes(w.he) && w.he.length > 1),
    2
  );
  if (others.length < 2) return null;
  const options = rand.shuffle([{ he: target }, ...others.map((w) => ({ he: w.he }))]);
  const idx = tokens.indexOf(target);
  /* What the answer is worth to the schedule. Filing it under the pool's own
     spelling is what lets a word that was due actually come off the due list,
     rather than being banked under ולילד as something new.

     The pool's spelling is taken outright where the target matches it letter
     for letter. A prefix stripped off the front is trusted only where what is
     left is a word this exercise was aiming at anyway: מים is not a prefixed
     ים, and guessing that it is would file "water" under "sea". */
  const bare = bareHe(target);
  const hinted = glossed.find((t) => t.w === target);
  const aimed = want ? [...want].find((x) => x === bare || x === heStem(bare)) : null;
  const held = pool.words.find((w) => bareHe(w.he) === bare)
    || (aimed ? pool.words.find((w) => bareHe(w.he) === aimed) : null);
  return {
    type: "blank",
    instruction: "Fill in the blank",
    sentence: tokens.map((t, i) => (i === idx ? null : t)),
    translation: p.en,
    audio: p.audio,
    full: p.he,
    optionLang: "he",
    options,
    answerIndex: options.findIndex((o) => o.he === target),
    display: target,
    words: held ? [{ he: held.he, en: held.en }]
      : hinted ? [{ he: hinted.w, en: hinted.h[0] }]
      : [],
  };
}

function matchExercise(words, rand) {
  /* build the five pairs one at a time so no two of them share a sense */
  const pairs = [];
  for (const w of rand.shuffle(distinctBy(words, (x) => normEn(x.en)))) {
    if (pairs.some((p) => clashes(p, w))) continue;
    pairs.push(w);
    if (pairs.length === 5) break;
  }
  if (pairs.length < 4) return null;
  return {
    type: "match",
    instruction: "Tap the matching pairs",
    pairs: pairs.map((w) => ({ he: w.he, en: w.en })),
    he: rand.shuffle(pairs.map((w) => w.he)),
    en: rand.shuffle(pairs.map((w) => w.en)),
    words: pairs.map((w) => ({ he: w.he, en: w.en })),
  };
}

function speakExercise(p) {
  return {
    type: "speak",
    instruction: "Speak this sentence",
    prompt: p.he,
    translation: p.en,
    audio: p.audio,
    display: p.he,
    words: p.tokens?.filter((t) => t.h).map((t) => ({ he: t.w, en: t.h[0] })) || [],
  };
}

function newWordExercise(word, rand, images) {
  return {
    type: "new",
    instruction: "New word",
    he: word.he,
    en: word.en,
    alt: word.alt || [],
    img: pictureFor(images, word),
    words: [{ he: word.he, en: word.en }],
  };
}

/* The alphabet units get drills about letters rather than sentences. */
function letterExercise(unit, rand, mode) {
  const pool = lettersUpTo(Math.max(3, unit));
  const target = rand.pick(pool);
  const others = rand.sample(LETTERS.filter((x) => x.l !== target.l), 2);
  if (mode === "sound") {
    const options = rand.shuffle([target, ...others]).map((x) => ({ he: x.l, en: x.name }));
    return {
      type: "select",
      instruction: `Which letter makes the sound “${target.sound}”?`,
      optionLang: "he",
      big: true,
      options,
      answerIndex: options.findIndex((o) => o.he === target.l),
      display: target.l,
      words: [],
    };
  }
  const options = rand.shuffle([target, ...others]).map((x) => ({ he: x.name, en: x.l }));
  return {
    type: "select",
    instruction: "What is this letter called?",
    prompt: target.l,
    promptLang: "he",
    promptBig: true,
    optionLang: "en",
    options,
    answerIndex: options.findIndex((o) => o.he === target.name),
    display: target.name,
    words: [],
  };
}

/* ------------------------------------------------------------------ */
/* Session assembly                                                    */
/* ------------------------------------------------------------------ */
const LENGTHS = {
  placement: 3,          /* one rung of the placement ladder — see PLACEMENT_ASK */
  test: 20,
  checkpoint: 25,
  lesson: 14,
  practice: 12,
  roots: 12,
  chest: 8,
  review: 18,
  legendary: 16,
  mistakes: 12,
  listening: 10,
  speaking: 8,
  personalized: 14,
};

/* ------------------------------------------------------------------ */
/* Root families                                                       */
/* ------------------------------------------------------------------ */
/* Four questions off one family, all of them ordinary multiple choice, so the
   session player, the marking, the XP and the mistakes list all work already.

   The order below is the order they are worth asking in: recognise that the
   family holds together, then read a member you have not met off one you have,
   then read the binyan itself — which is the part that generalises, because
   nif'al being the passive of pa'al is one fact that unlocks נכתב, נשמע, נסגר
   and נפתח at once. */

const selectOf = (instruction, prompt, promptLang, opts, answer, note) => ({
  type: "select",
  instruction,
  prompt,
  promptLang,
  optionLang: /[֐-׿]/.test(opts[0]) ? "he" : "en",
  options: opts.map((o) => ({ he: o, en: "" })),
  answerIndex: opts.indexOf(answer),
  display: answer,
  note,
  words: [],
});

/* Which one is not from this root? The wrong answer is hand-picked where the
   family names one, and otherwise a word from another family that this root's
   letters genuinely cannot produce — checked, not assumed. */
function rootOddExercise(fam, rand) {
  const members = rand.sample(fam.words, 3).map((w) => w.he);
  if (members.length < 3) return null;
  const picked = (fam.impostors || [])[0];
  const outsiders = ROOTS.filter((f) => f.root !== fam.root)
    .flatMap((f) => f.words)
    .filter((w) => !fitsRoot(w.he, fam.root) && !members.includes(w.he));
  const odd = picked ? picked.he : rand.sample(outsiders, 1)[0]?.he;
  if (!odd || members.includes(odd)) return null;
  const opts = rand.shuffle([...members, odd]);
  return selectOf(`Which word is not from ${fam.root}?`, fam.root, "he", opts, odd,
    picked ? `${picked.he} is ${picked.en}, from ${picked.from}.` : `The other three all come from ${fam.root} — ${fam.sense}.`);
}

/* You know one member; read another off it. */
function rootDeriveExercise(fam, rand) {
  /* anchor on the family's first word, which is the plainest one it has — the
     point is to read a rarer word off a common one, not the other way round */
  const known = fam.words[0];
  const rest = fam.words.filter((w) => w.he !== known.he && w.en !== known.en);
  const target = rand.sample(rest, 1)[0];
  if (!known || !target) return null;
  const others = ROOTS.filter((f) => f.root !== fam.root).flatMap((f) => f.words);
  const wrong = rand.sample(others.filter((w) => w.en !== target.en), 3).map((w) => w.en);
  if (wrong.length < 3) return null;
  const opts = rand.shuffle([target.en, ...wrong]);
  return selectOf(`You know ${known.he} — ${known.en}. Same root: what is ${target.he}?`,
    target.he, "he", opts, target.en,
    `${fam.root} is ${fam.sense}. ${target.he} is ${target.form}.`);
}

/* The binyan itself: given the plain verb, what does the derived one do? */
function rootBinyanExercise(fam, rand) {
  const base = fam.words.find((w) => w.form.startsWith("pa'al"));
  const derived = fam.words.filter((w) => /^(nif'al|pi'el|hif'il|hitpa'el|pu'al|huf'al)/.test(w.form));
  if (!base || !derived.length) return null;
  const target = rand.sample(derived, 1)[0];
  const others = ROOTS.filter((f) => f.root !== fam.root)
    .flatMap((f) => f.words)
    .filter((w) => /^(nif'al|pi'el|hif'il|hitpa'el|pu'al|huf'al)/.test(w.form) && w.en !== target.en);
  const wrong = rand.sample(others, 3).map((w) => w.en);
  if (wrong.length < 3) return null;
  const opts = rand.shuffle([target.en, ...wrong]);
  return selectOf(`${base.he} is ${base.en}. What is ${target.he}?`, target.he, "he", opts, target.en,
    `${target.he} is ${target.form}.`);
}

/* What idea do these three share? */
function rootSenseExercise(fam, rand) {
  const three = rand.sample(fam.words, 3).map((w) => w.he);
  if (three.length < 3) return null;
  const wrong = rand.sample(ROOTS.filter((f) => f.root !== fam.root), 3).map((f) => f.sense);
  if (wrong.length < 3) return null;
  const opts = rand.shuffle([fam.sense, ...wrong]);
  return selectOf("These share a root. What idea do they share?", three.join(" · "), "he", opts, fam.sense,
    `They are all ${fam.root}.`);
}

export function buildRootSession(seed = 1, count = LENGTHS.roots) {
  const rand = rng(hash(`roots:${seed}`));
  const out = [];
  const makers = [rootOddExercise, rootDeriveExercise, rootBinyanExercise, rootSenseExercise];
  const fams = rand.shuffle([...ROOTS]);
  for (let i = 0; out.length < count && i < fams.length * 4; i++) {
    const fam = fams[i % fams.length];
    const make = makers[i % makers.length];
    const ex = make(fam, rand);
    if (ex && !out.some((o) => o.instruction === ex.instruction && o.prompt === ex.prompt)) {
      out.push({ ...ex, key: `root-${out.length}` });
    }
  }
  return out;
}

export function sessionLength(kind) { return LENGTHS[kind] || 12; }

/* `known` is the set of Hebrew words the player has already met, so the first
   lesson of a node introduces vocabulary and the fifth does not. `sentLevels`
   is the same record kept a sentence at a time — what the sentence weighing
   below reads to tell a line met once from one had right five times running. */
export function buildSession({
  unit, docs, kind = "lesson", lessonIndex = 0, known = new Set(),
  settings = {}, mistakes = [], dueWords = [], voice = true, images = null,
  sentLevels = {}, now = Date.now(), reached = 0, lexicon = null,
}) {
  const rand = rng(hash(`${kind}:${unit}:${lessonIndex}`) + lessonIndex * 977);
  const target = docs.find((d) => d.unit === unit) || docs[docs.length - 1];
  if (!target) return [];
  const pool = buildPools(docs, unit);
  const wantLetters = unit <= 3;

  /* Root families are not a unit's business — ל-מ-ד spans a dozen of them — so
     the drill is built from the families themselves rather than the pool. */
  if (kind === "roots") return buildRootSession(unit + lessonIndex);

  if (kind === "mistakes") {
    return mistakes.slice(0, LENGTHS.mistakes).map((m, i) => ({ ...m.ex, key: `mistake-${i}`, fromMistake: m.key }));
  }

  /* A checkpoint test is meant to cover a whole block of the tree, so nothing
     in the pool counts as "old" — every unit sampled for it is fair game. */
  const wholeSpan = kind === "checkpoint";
  const ownPhrases = pool.phrases.filter((p) => wholeSpan || p.own);
  const oldPhrases = pool.phrases.filter((p) => !wholeSpan && !p.own);
  const ownWords = pool.words.filter((w) => wholeSpan || w.own);
  const oldWords = pool.words.filter((w) => !wholeSpan && !w.own);
  const phrases = ownPhrases.length ? ownPhrases : pool.phrases;
  const words = ownWords.length ? ownWords : pool.words;
  if (!phrases.length && !words.length) return [];

  /* The bank records which kind of challenge each sentence was served as.
     Duolingo dictates the listenTap ones and asks you to translate the rest,
     so the same split is kept here — and a sentence with a real recording is
     always the better thing to dictate. */
  const spoken = phrases.filter((p) => p.audio);
  const dictatable = voice
    ? [...spoken, ...phrases.filter((p) => !p.audio && p.kind === "l")]
    : spoken;
  const translatable = phrases.filter((p) => p.kind !== "l" || p.guide);
  const sayable = spoken.length ? spoken : phrases;
  const toTranslate = translatable.length ? translatable : phrases;
  const toDictate = dictatable.length ? dictatable : (voice ? phrases : []);

  /* Has this learner been taught this word?

     The word map answers for anyone who walked here. It answers wrongly for
     anyone who did not: a placement test can open forty units without a single
     question being answered inside them, which leaves the map empty and every
     lesson afterwards introducing vocabulary the learner has known for years —
     and, since the sentence weighing reads the same set, marking their
     perfectly readable sentences as too hard.

     So the course's own index is asked as well: a word whose first unit is
     behind where they have reached has been taught, whether or not this device
     ever saw them answer about it. Prefixes come off before the lookup, as
     everywhere else. */
  const taught = (he) => {
    if (known.has(he)) return true;
    if (!lexicon || !reached) return false;
    const b = bareHe(he);
    const at = lexicon[b] ?? lexicon[heStem(b)];
    return at != null && at <= reached;
  };

  /* Words this lesson is responsible for teaching, up to three, front-loaded
     the way Duolingo front-loads a "New word" card. */
  const teaching = (kind === "lesson" || kind === "personalized")
    ? words.filter((w) => !taught(w.he)).slice(lessonIndex * 3, lessonIndex * 3 + 3)
    : [];

  /* ---------------------------------------------------------------- */
  /* Which sentence to ask about                                      */
  /* ---------------------------------------------------------------- */
  /* Every maker below used to say rand.pick(toTranslate): any sentence of the
     unit, with equal odds and nothing tying it to the lesson it landed in.
     Measured against the course's own data that put a third of a lesson's
     sentences on material the unit does not teach at all, and a quarter of
     them two or more words past anything the course had introduced by then.

     Clozemaster's answer is the one worth borrowing, and it is not the blank —
     it is which sentence gets blanked. A sentence earns its place by what it
     exercises: the word this lesson is teaching, the word that has come round
     again, the sentence itself falling due. It loses its place for every word
     beyond those that the learner has not met, and for running long.

     The scores go into a bag with the good sentences in it up to four times
     and the worst ones once, rather than into a ranking. A ranking would serve
     the same handful of best-scoring lines every lesson; a bag keeps the
     variety and still bends the odds. Everything stays seeded, so a lesson
     re-opened after a crash is the lesson that was interrupted. */
  const familiar = new Set();
  for (const w of pool.words) familiar.add(bareHe(w.he));
  for (const d of docs) for (const k of Object.keys(d.hints || {})) familiar.add(bareHe(k));
  for (const he of known) familiar.add(bareHe(he));
  /* and everything the course taught behind them, which the two-unit window the
     pool is built from cannot see */
  if (lexicon && reached) {
    for (const [w, at] of Object.entries(lexicon)) if (at <= reached) familiar.add(w);
  }

  const targets = new Set();
  for (const w of teaching) targets.add(bareHe(w.he));
  for (const d of dueWords) targets.add(bareHe(d.he));

  const scores = new Map();
  const scoreOf = (p) => {
    if (scores.has(p)) return scores.get(p);
    const toks = tokenizeHe(p.he).map(bareHe).filter(Boolean);
    let strange = 0;
    const hits = new Set();
    for (const t of toks) {
      if (!holds(familiar, t)) strange++;
      if (holds(targets, t)) hits.add(t);
    }
    /* A sentence already answered right five times running is worth less than
       one that is coming round again. Where nothing is recorded — a fresh save,
       or the checker — this term is zero and the rest of the score decides. */
    const rec = sentLevels[sentenceKey(p.he)];
    const rep = !rec ? 0 : (rec.due || 0) <= now ? 2 : -Math.min(2, rec.level || 0);
    const score = Math.min(2, hits.size) * 2 - Math.min(3, strange) + rep
      + (toks.length > 9 ? -1 : 0);
    scores.set(p, score);
    return score;
  };

  const bagOf = (list) => {
    if (list.length < 2) return list;
    const bag = [];
    for (const p of list) {
      const copies = Math.max(1, Math.min(4, 2 + scoreOf(p)));
      for (let i = 0; i < copies; i++) bag.push(p);
    }
    return bag;
  };

  /* Sentences indexed by the words in them, for putting a word that is due
     back inside one. Built on the first ask, since only personalised practice
     wants it. */
  let byWord = null, byStem = null;
  const sentencesFor = (w) => {
    if (!byWord) {
      byWord = new Map();
      byStem = new Map();
      const file = (map, k, p) => { if (!map.has(k)) map.set(k, []); map.get(k).push(p); };
      for (const p of toTranslate) {
        const toks = tokenizeHe(p.he);
        if (toks.length < 3) continue;
        for (const b of new Set(toks.map(bareHe).filter(Boolean))) {
          file(byWord, b, p);
          if (heStem(b) !== b) file(byStem, heStem(b), p);
        }
      }
    }
    /* the word standing on its own first, and only then the word wearing a
       prefix, so a due ים is not answered with a sentence about מים */
    const k = bareHe(w.he);
    return byWord.get(k) || byStem.get(k) || [];
  };

  const translateBag = bagOf(toTranslate);
  const dictateBag = bagOf(toDictate);
  const sayBag = bagOf(sayable);

  /* The fill-the-blank goes further than weighing. Weighing only bends the
     odds, and a lesson teaching three words out of a unit's thirty draws a
     sentence holding one of them less than half the time — so the gap fell
     back to whatever else was glossed, which is where it started. The blank is
     the one exercise that tests a single word and nothing else, so it is worth
     choosing the sentence for the word rather than the other way round. */
  const blankWant = targets.size ? targets : null;
  const blankFrom = blankWant
    ? toTranslate.filter((p) => {
        const toks = tokenizeHe(p.he);
        return toks.length >= 3 && toks.some((t) => holds(blankWant, bareHe(t)));
      })
    : [];
  const blankBag = blankFrom.length ? bagOf(blankFrom) : translateBag;

  const out = [];
  const push = (ex) => { if (ex) out.push(ex); };

  for (const w of teaching) {
    push(newWordExercise(w, rand, images));
    push(selectHeExercise(w, { ...pool, words: pool.words }, rand, images));
  }

  /* A weighted bag of makers, then draw until the session is long enough. The
     weights are what make a lesson feel like a lesson: mostly translation,
     some listening, a little of everything else. */
  const listening = settings.listening !== false && toDictate.length > 0;
  const speaking = settings.speaking !== false && kind !== "chest";

  const makers = [];
  const add = (weight, fn) => { for (let i = 0; i < weight; i++) makers.push(fn); };

  add(kind === "listening" ? 1 : 5, () => bankExercise(rand.pick(translateBag), pool, rand, "en"));
  add(kind === "listening" ? 1 : 4, () => bankExercise(rand.pick(translateBag), pool, rand, "he"));
  if (listening) add(kind === "listening" ? 12 : 3, () => listenExercise(rand.pick(dictateBag), pool, rand));
  add(2, () => selectEnExercise(rand.pick(words), pool, rand));
  add(2, () => selectHeExercise(rand.pick(words), pool, rand, images));
  add(2, () => blankExercise(rand.pick(blankBag), pool, rand, blankWant));
  if (speaking) add(kind === "speaking" ? 12 : 1, () => speakExercise(rand.pick(sayBag)));
  if (wantLetters) {
    add(4, () => letterExercise(unit, rand, "sound"));
    add(3, () => letterExercise(unit, rand, "name"));
  }
  /* Review sessions reach back into the units behind this one. */
  if ((kind === "review" || kind === "legendary" || kind === "practice" || kind === "test") && oldPhrases.length) {
    const older = oldPhrases.filter((p) => p.kind !== "l" || p.guide);
    const olderBag = bagOf(older.length ? older : oldPhrases);
    add(4, () => bankExercise(rand.pick(olderBag), pool, rand, "en"));
    add(3, () => bankExercise(rand.pick(olderBag), pool, rand, "he"));
    if (oldWords.length) add(2, () => selectEnExercise(rand.pick(oldWords), pool, rand));
  }
  /* Practice built from what is actually due.

     A word that is due comes back inside a sentence rather than beside two
     other words. Picking אוכל out of a list of three is not the skill this
     course is for; reading it where it stands, in a line that means something,
     is — and it is the same retrieval either way, so the harder one is free.
     Multiple choice stays for the words no sentence in the window contains,
     and as a change of pace where they do. */
  if (kind === "personalized" && dueWords.length) {
    const due = dueWords.map((d) => pool.words.find((w) => w.he === d.he)).filter(Boolean);
    if (due.length) {
      const inSentences = due.filter((w) => sentencesFor(w).length);
      if (inSentences.length) add(6, () => {
        const w = rand.pick(inSentences);
        return blankExercise(rand.pick(sentencesFor(w)), pool, rand, new Set([bareHe(w.he)]));
      });
      add(inSentences.length ? 2 : 6, () => selectEnExercise(rand.pick(due), pool, rand));
      add(inSentences.length ? 2 : 4, () => selectHeExercise(rand.pick(due), pool, rand, images));
    }
  }

  const wanted = LENGTHS[kind] || 12;
  /* Where the pair-matching exercise goes — counted from wherever the new-word
     cards left off, not from zero. Fixed at 3-5 it sat behind the six cards a
     first lesson opens with, so a lesson that taught anything never contained
     one at all. */
  const matchAt = wanted > 8 ? out.length + 2 + rand.int(3) : -1;
  /* How often one sentence has been asked about. Choosing sentences for what
     they teach narrows the field they are chosen from, and a narrowed field
     repeats: the fill-the-blank in particular draws from whichever lines hold
     this lesson's three words, which in a thin unit is a handful. Twice in a
     lesson is a second angle on the same sentence; a third time is the lesson
     running out of ideas. The cap lifts once the loop is running out of
     attempts, because a short lesson is worse than a repeat. */
  const asked = new Map();
  let guard = 0;
  while (out.length < wanted && guard++ < wanted * 12) {
    if (out.length === matchAt) {
      const m = matchExercise(pool.words.length >= 5 ? pool.words : words, rand);
      if (m) { out.push(m); continue; }
    }
    const ex = rand.pick(makers)();
    if (!ex) continue;
    /* no exercise twice in a row on the same sentence */
    const last = out[out.length - 1];
    if (last && last.type === ex.type && last.display === ex.display) continue;
    const key = sentenceKey(exerciseSentence(ex));
    if (key && guard < wanted * 6 && (asked.get(key) || 0) >= 2) continue;
    if (key) asked.set(key, (asked.get(key) || 0) + 1);
    out.push(ex);
  }

  return out.slice(0, wanted).map((ex, i) => ({ ...ex, key: ex.key || `${kind}-${unit}-${lessonIndex}-${i}` }));
}

/* ------------------------------------------------------------------ */
/* Placement                                                           */
/* ------------------------------------------------------------------ */
/* Someone who already reads Hebrew should not have to tap through the alphabet
   to reach the part they do not know. The test climbs a ladder of units, and
   whatever it clears is opened.

   It used to stop dead at the first rung that beat them, and hand back the last
   rung they had cleared. The rungs are up to thirteen units apart, so clearing
   57 and failing 70 said only that the answer lay somewhere between — and the
   test answered 57, leaving up to twelve units of material the learner did not
   need. Three questions is also not a measurement: someone who genuinely knows
   four in five of a rung gets fewer than two right one time in ten, and against
   an eight-rung ladder those chances compound.

   So it does not stop. A rung that beats them fixes the top of a range rather
   than ending the test, and the ladder becomes a search: halve what is left
   between the highest unit cleared and the lowest known to be too hard, ask
   again, and settle once the gap is down to two units.

   The obvious fix — more questions a rung — turns out to be the wrong one, and
   simulating it against a learner who answers noisily is what showed it.
   Asking five and passing on three does place people almost exactly, but costs
   43 questions against a banner that promises two minutes. The search is what
   was actually missing: once a bad rung is recoverable rather than final, three
   questions are enough, because a rung failed by bad luck is simply re-probed
   from below a moment later. Three questions with the search places a unit
   short on average and 23 questions long; three questions without it placed
   nearly five units short, and left one learner in six more than ten units
   short of where they belonged. */
export const PLACEMENT_LADDER = [3, 8, 15, 24, 34, 45, 57, 70, 82];
export const PLACEMENT_ASK = LENGTHS.placement;
export const PLACEMENT_PASS = 2;        /* of three */
/* Close enough to stop asking: two units of material nobody needed is a few
   lessons, and chasing the last one costs more questions than it saves. */
export const PLACEMENT_GAP = 2;

/* `rung` carries the search: `at` is how far up the ladder it has climbed,
   `reached` the highest unit cleared, and `hi` the lowest unit known to be too
   hard — set once something has beaten them, which is what turns the climb
   into a search. */
export function placementStep(rung, right, asked) {
  const passed = !asked || right >= PLACEMENT_PASS;
  const reached = passed && asked ? (rung.unit ?? PLACEMENT_LADDER[rung.at]) : rung.reached;
  const hi = passed ? rung.hi : Math.min(rung.hi ?? Infinity, rung.unit ?? PLACEMENT_LADDER[rung.at]);

  /* still climbing, and still passing */
  if (passed && hi == null) {
    const at = (asked ? rung.at + 1 : rung.at);
    if (at >= PLACEMENT_LADDER.length) return { done: true, reached };
    return { done: false, at, reached, hi: null, unit: PLACEMENT_LADDER[at] };
  }

  /* something has beaten them: halve what is left between what they cleared
     and what they did not, until there is nothing left to halve */
  const lo = reached;
  if (hi - lo <= PLACEMENT_GAP) return { done: true, reached };
  const unit = Math.floor((lo + hi) / 2);
  return { done: false, at: rung.at, reached, hi, unit };
}

/* ------------------------------------------------------------------ */
/* Marking                                                             */
/* ------------------------------------------------------------------ */
export function checkAnswer(ex, response) {
  switch (ex.type) {
    case "new":
      return { ok: true, solution: ex.he };
    case "bank":
    case "listen": {
      /* tapped: an array of tiles. typed: a string, marked against every
         translation the course recorded rather than against tile order. */
      if (typeof response === "string") {
        const given = norm(response, ex.lang);
        const ok = !!given && (ex.accepted || [ex.display]).some((a) => sameAnswer(given, norm(a, ex.lang), ex.lang));
        return { ok, solution: ex.display };
      }
      /* both sides built the same way, empties dropped: a tile that normalises
         to nothing must not leave a space behind on one side only */
      const line = (tokens) => (tokens || []).map((t) => norm(t, ex.lang)).filter(Boolean).join(" ");
      return { ok: line(response) === line(ex.answer), solution: ex.display };
    }
    case "type": {
      const given = norm(response, ex.lang);
      const ok = !!given && (ex.accepted || []).some((a) => sameAnswer(given, norm(a, ex.lang), ex.lang));
      return { ok, solution: ex.display };
    }
    case "select":
    case "blank":
      return { ok: response === ex.answerIndex, solution: ex.display };
    case "match":
      return { ok: true, solution: "" };
    case "speak":
      return { ok: response !== false, solution: ex.display };
    default:
      return { ok: false, solution: ex.display || "" };
  }
}

/* What a matching pair is worth: the words behind an exercise, so the spaced
   repetition schedule learns from every answer. */
export const exerciseWords = (ex) => ex.words || [];
