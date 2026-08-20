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

/* Hebrew, reduced to what marking should turn on: the letters and the digits,
   without the vowel points or the punctuation.

   It is built out of the same tokenizer the word bank is built from, because
   the two disagreeing is a way to mark a right answer wrong. They did: a score
   inside a sentence — "בתוצאה 30:25" — became one tile, "3025", while the
   sentence it came from was being read as two words with nothing between them.
   Digits used to be thrown away here along with the punctuation, which also
   meant "3 children" and "5 children" were the same sentence to the marker. */
export const normHe = (s) => tokenizeHe(s)
  .map((w) => removeNikkud(w).replace(/[^֐-׿0-9]+/g, ""))
  .filter(Boolean)
  .join(" ");

export const norm = (s, lang) => (lang === "he" ? normHe(s) : normEn(s));

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

function blankExercise(p, pool, rand) {
  const tokens = tokenizeHe(p.he);
  if (tokens.length < 3) return null;
  const glossed = (p.tokens || []).filter((t) => t.h && tokens.includes(t.w));
  const target = glossed.length ? rand.pick(glossed).w : rand.pick(tokens);
  const others = rand.sample(
    pool.words.filter((w) => !tokens.includes(w.he) && w.he.length > 1),
    2
  );
  if (others.length < 2) return null;
  const options = rand.shuffle([{ he: target }, ...others.map((w) => ({ he: w.he }))]);
  const idx = tokens.indexOf(target);
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
    words: glossed.filter((t) => t.w === target).map((t) => ({ he: t.w, en: t.h[0] })),
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
  placement: 3,          /* one rung of the placement ladder */
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
   lesson of a node introduces vocabulary and the fifth does not. */
export function buildSession({
  unit, docs, kind = "lesson", lessonIndex = 0, known = new Set(),
  settings = {}, mistakes = [], dueWords = [], voice = true, images = null,
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

  const out = [];
  const push = (ex) => { if (ex) out.push(ex); };

  /* Words this lesson is responsible for teaching, up to three, front-loaded
     the way Duolingo front-loads a "New word" card. */
  if (kind === "lesson" || kind === "personalized") {
    const fresh = words.filter((w) => !known.has(w.he)).slice(lessonIndex * 3, lessonIndex * 3 + 3);
    for (const w of fresh) {
      push(newWordExercise(w, rand, images));
      push(selectHeExercise(w, { ...pool, words: pool.words }, rand, images));
    }
  }

  /* A weighted bag of makers, then draw until the session is long enough. The
     weights are what make a lesson feel like a lesson: mostly translation,
     some listening, a little of everything else. */
  const listening = settings.listening !== false && toDictate.length > 0;
  const speaking = settings.speaking !== false && kind !== "chest";

  const makers = [];
  const add = (weight, fn) => { for (let i = 0; i < weight; i++) makers.push(fn); };

  add(kind === "listening" ? 1 : 5, () => bankExercise(rand.pick(toTranslate), pool, rand, "en"));
  add(kind === "listening" ? 1 : 4, () => bankExercise(rand.pick(toTranslate), pool, rand, "he"));
  if (listening) add(kind === "listening" ? 12 : 3, () => listenExercise(rand.pick(toDictate), pool, rand));
  add(2, () => selectEnExercise(rand.pick(words), pool, rand));
  add(2, () => selectHeExercise(rand.pick(words), pool, rand, images));
  add(2, () => blankExercise(rand.pick(toTranslate), pool, rand));
  if (speaking) add(kind === "speaking" ? 12 : 1, () => speakExercise(rand.pick(sayable)));
  if (wantLetters) {
    add(4, () => letterExercise(unit, rand, "sound"));
    add(3, () => letterExercise(unit, rand, "name"));
  }
  /* Review sessions reach back into the units behind this one. */
  if ((kind === "review" || kind === "legendary" || kind === "practice" || kind === "test") && oldPhrases.length) {
    const older = oldPhrases.filter((p) => p.kind !== "l" || p.guide);
    const olderT = older.length ? older : oldPhrases;
    add(4, () => bankExercise(rand.pick(olderT), pool, rand, "en"));
    add(3, () => bankExercise(rand.pick(olderT), pool, rand, "he"));
    if (oldWords.length) add(2, () => selectEnExercise(rand.pick(oldWords), pool, rand));
  }
  /* Practice built from what is actually due. */
  if (kind === "personalized" && dueWords.length) {
    const due = dueWords.map((d) => pool.words.find((w) => w.he === d.he)).filter(Boolean);
    if (due.length) {
      add(6, () => selectEnExercise(rand.pick(due), pool, rand));
      add(4, () => selectHeExercise(rand.pick(due), pool, rand, images));
    }
  }

  const wanted = LENGTHS[kind] || 12;
  /* Where the pair-matching exercise goes — counted from wherever the new-word
     cards left off, not from zero. Fixed at 3-5 it sat behind the six cards a
     first lesson opens with, so a lesson that taught anything never contained
     one at all. */
  const matchAt = wanted > 8 ? out.length + 2 + rand.int(3) : -1;
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
    out.push(ex);
  }

  return out.slice(0, wanted).map((ex, i) => ({ ...ex, key: ex.key || `${kind}-${unit}-${lessonIndex}-${i}` }));
}

/* ------------------------------------------------------------------ */
/* Placement                                                           */
/* ------------------------------------------------------------------ */
/* Someone who already reads Hebrew should not have to tap through the alphabet
   to reach the part they do not know. The test climbs: three questions from a
   unit, and if two are right it moves up a rung, stopping at the first rung
   that defeats them. Nine rungs across eighty-four units means about fifteen
   questions to place at the top, and three to place at the bottom. */
export const PLACEMENT_LADDER = [3, 8, 15, 24, 34, 45, 57, 70, 82];
export const PLACEMENT_PASS = 2;        /* of three */

export function placementStep(rung, right, asked) {
  if (asked && right < PLACEMENT_PASS) return { done: true, reached: rung.reached };
  const reached = PLACEMENT_LADDER[rung.at];
  const at = rung.at + 1;
  if (at >= PLACEMENT_LADDER.length) return { done: true, reached };
  return { done: false, at, reached, unit: PLACEMENT_LADDER[at] };
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
