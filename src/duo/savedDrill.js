/* Practice built out of the words you starred while reading.

   These used to be reviewed as flashcards: a Hebrew word on a card, tap to
   turn it over, say whether you knew it. That is a different activity from
   everything else on the Practice screen — self-graded, one exercise type,
   played by a player of its own in the reader — and the words you asked to
   practise were the only ones practised that way.

   So they go through the lesson player now, in the shapes the rest of the
   course uses: what does this word mean, which of these is that word, fill
   the gap in the sentence you starred it in, write it from its meaning, match
   the pairs, and — where a voice is available — take down the sentence by
   ear. Every answer is graded by the player and reported back to the
   reader's own Leitner schedule, so the star, the due count and the export all
   carry on meaning what they meant.

   Nothing here needs a key or a network. The distractors come from the
   reader's other starred words first, because those are at the same level,
   and are topped up from the course's own vocabulary around the unit the
   path has reached. */

import { isDue } from "../srs.js";
import { tokenizeHe, bareHe, normEn } from "./exercises.js";
import { heForms } from "./morph.js";

/* Words per session, and what the session is allowed to grow to. Seven words
   asked about twice, a round of pairs and a dictation or two is fifteen or so
   exercises, which is the length of an ordinary practice. */
const WORDS = 7;
const MATCH_PAIRS = 5;
const MIN_MATCH = 4;
const DICTATIONS = 2;

/* A gap needs a sentence with something either side of it; a dictation has
   to fit in the ear. */
const MIN_BLANK_TOKENS = 3;
const MAX_BLANK_TOKENS = 22;
const MIN_DICTATION_TOKENS = 4;
const MAX_DICTATION_TOKENS = 9;
/* a gloss that would not fit on a matching tile */
const MAX_MATCH_GLOSS = 28;

const gloss = (e) => String(e?.g || "").replace(/\s+/g, " ").trim();

/* Every sense a gloss carries. The reader's glosses come from dictionaries and
   read "house / home" or "to go; to walk", so they are split before two words
   are judged to mean the same thing. */
const sensesOf = (w) => [w.en, ...(w.alt || [])]
  .flatMap((s) => String(s || "").split(/[/;,]/))
  .map(normEn).filter(Boolean);

/* Every spelling a word answers to: the forms the reader met it in, and what
   the morphology makes of each — so ⁧הספר⁩ is not offered beside a gap that
   ⁧ספר⁩ fills, and ⁧הביתה⁩ is not a distractor for ⁧בית⁩. */
const spellings = (w) => new Set((w.bare ? [...w.bare] : [bareHe(w.he)]).flatMap(heForms));

const clashes = (a, b) => {
  const sa = spellings(a);
  if ([...spellings(b)].some((x) => sa.has(x))) return true;
  const s = new Set(sensesOf(a));
  return sensesOf(b).some((x) => s.has(x));
};

/* What the schedule is told. `saved` is the key the reader files the word
   under, which is how the answer finds its way back to the right entry. */
const credit = (w) => ({ he: w.he, en: w.en, saved: w.key });

/* The starred entries, as the builders want them: the key is the dictionary
   form, `forms` the spellings met in the text, `bare` every spelling reduced
   to its letters so the gap can find the word inside its sentence. */
function wordsOf(saved) {
  return Object.entries(saved || {}).map(([key, e]) => {
    const forms = [...new Set([key, ...(e?.forms || [])].map((f) => String(f).trim()).filter(Boolean))];
    return {
      he: key, en: gloss(e), key, forms,
      sent: String(e?.sent || "").replace(/\s+/g, " ").trim(),
      bare: new Set(forms.flatMap((f) => f.split(/\s+/)).map(bareHe).filter(Boolean)),
      due: e?.due ?? 0,
    };
  });
}

/* Two other things to put beside the answer. The reader's own starred words
   first — they are the right level, and a word starred last week is a better
   distractor than one the course taught in unit 3 — then the course's
   vocabulary around where the path is. */
function pickOthers(word, mine, course, rand, ok, n = 2) {
  const out = [];
  for (const list of [mine, course]) {
    if (out.length >= n) break;
    const fit = list.filter((x) => x !== word && ok(x) && !clashes(x, word) && !out.some((o) => clashes(o, x)));
    out.push(...rand.sample(fit, n - out.length));
  }
  return out.length >= n ? out : null;
}

/* ------------------------------------------------------------------ */
/* Builders — each returns an exercise or null                         */
/* ------------------------------------------------------------------ */

function meaningOf(word, mine, course, rand) {
  const others = pickOthers(word, mine, course, rand, (x) => !!x.en);
  if (!others) return null;
  const options = rand.shuffle([word, ...others].map((x) => ({ he: x.en, en: x.he })));
  return {
    type: "select",
    instruction: "What does this mean?",
    prompt: word.he,
    promptLang: "he",
    optionLang: "en",
    options,
    answerIndex: options.findIndex((o) => o.en === word.he),
    display: word.en,
    words: [credit(word)],
  };
}

function whichIs(word, mine, course, rand) {
  const others = pickOthers(word, mine, course, rand, (x) => !!x.he);
  if (!others) return null;
  const options = rand.shuffle([word, ...others].map((x) => ({ he: x.he, en: x.en })));
  return {
    type: "select",
    instruction: `Which one of these is “${word.en}”?`,
    optionLang: "he",
    options,
    answerIndex: options.findIndex((o) => o.he === word.he),
    display: word.he,
    words: [credit(word)],
  };
}

/* The gap falls on the word in the sentence it was starred in — whichever
   spelling it wore there, since the entry is filed under the dictionary form
   and the text said ⁧בבית⁩. */
function gapIn(word, mine, course, rand) {
  const tokens = tokenizeHe(word.sent);
  if (tokens.length < MIN_BLANK_TOKENS || tokens.length > MAX_BLANK_TOKENS) return null;
  const idx = tokens.findIndex((t) => word.bare.has(bareHe(t)));
  if (idx < 0) return null;
  const answer = tokens[idx];
  const bare = bareHe(answer);
  const inSentence = new Set(tokens.map(bareHe));
  /* about as long as the answer, so the gap is not answered by shape alone */
  const near = (x) => {
    const b = bareHe(x.he);
    return b.length > 1 && !inSentence.has(b) && !/\s/.test(x.he.trim()) && Math.abs(b.length - bare.length) <= 2;
  };
  const others = pickOthers({ ...word, he: answer }, mine, course, rand, near)
    || pickOthers({ ...word, he: answer }, mine, course, rand, (x) => bareHe(x.he).length > 1 && !inSentence.has(bareHe(x.he)) && !/\s/.test(x.he.trim()));
  if (!others) return null;
  const options = rand.shuffle([{ he: answer }, ...others.map((x) => ({ he: x.he }))]);
  return {
    type: "blank",
    instruction: "Fill in the blank",
    sentence: tokens.map((t, i) => (i === idx ? null : t)),
    /* the reader's sentences carry no English, and an empty line is honest */
    translation: "",
    full: word.sent,
    optionLang: "he",
    options,
    answerIndex: options.findIndex((o) => o.he === answer),
    display: answer,
    words: [credit(word)],
  };
}

/* Produce the word from its meaning — what the flashcard's typing mode did,
   marked by the same forgiving rules as the course's own typed answers. */
function writeIt(word) {
  return {
    type: "type",
    lang: "he",
    instruction: "Write this in Hebrew",
    prompt: word.en,
    promptLang: "en",
    accepted: word.forms,
    display: word.he,
    words: [credit(word)],
  };
}

function dictationOf(word, course, rand) {
  const tokens = tokenizeHe(word.sent);
  if (tokens.length < MIN_DICTATION_TOKENS || tokens.length > MAX_DICTATION_TOKENS) return null;
  const inSentence = new Set(tokens.map(bareHe));
  const extras = rand.sample(
    course.map((x) => x.he).filter((he) => !/\s/.test(he.trim()) && !inSentence.has(bareHe(he))),
    Math.max(3, 10 - tokens.length),
  );
  if (extras.length < 3) return null;
  return {
    type: "listen",
    lang: "he",
    instruction: "Tap what you hear",
    prompt: "",
    promptLang: "",
    audio: "",
    text: word.sent,
    accepted: [word.sent],
    display: word.sent,
    answer: tokens,
    tiles: rand.shuffle([...tokens, ...extras]),
    solutionEn: "",
    words: [credit(word)],
  };
}

function pairsOf(words, rand) {
  const pairs = [];
  for (const w of rand.shuffle(words.filter((x) => x.en && x.en.length <= MAX_MATCH_GLOSS && !/\s/.test(x.he.trim())))) {
    if (pairs.some((p) => clashes(p, w))) continue;
    pairs.push(w);
    if (pairs.length === MATCH_PAIRS) break;
  }
  if (pairs.length < MIN_MATCH) return null;
  return {
    type: "match",
    instruction: "Tap the matching pairs",
    pairs: pairs.map((w) => ({ he: w.he, en: w.en, saved: w.key })),
    he: rand.shuffle(pairs.map((w) => w.he)),
    en: rand.shuffle(pairs.map((w) => w.en)),
    words: pairs.map(credit),
  };
}

/* ------------------------------------------------------------------ */
/* The session                                                         */
/* ------------------------------------------------------------------ */
/* `saved` is the reader's starred entries; `pool` the course's word pool
   around the unit the path has reached, for distractors; `voice` whether a
   Hebrew voice exists to read a dictation.

   The words that are due come first, then the ones nearest to coming due, so
   a session on a day with two words due is two reviews and five of the words
   that will be due soonest rather than two reviews and nothing. Each word is
   asked about twice — recognised first, produced after — with the recognitions
   together at the front so a word is met before it has to be written. */
export function buildSavedDrill({ saved, pool, rand, voice }) {
  const all = wordsOf(saved);
  const course = (pool?.words || []).filter((w) => w.he && w.en);
  const now = Date.now();
  const due = rand.shuffle(all.filter((w) => isDue(w, now)));
  const soon = rand.shuffle(all.filter((w) => !isDue(w, now))).sort((a, b) => a.due - b.due);

  const first = [];
  const second = [];
  const chosen = [];
  const usedSents = new Set();
  for (const w of [...due, ...soon]) {
    if (chosen.length >= WORDS) break;
    /* recognition and production, in turn — a word with no gloss can only be
       asked about inside its sentence, which is still a question */
    const mine = all.filter((x) => x !== w);
    const recognise = w.en
      ? (chosen.length % 2 ? whichIs(w, mine, course, rand) : meaningOf(w, mine, course, rand))
        || meaningOf(w, mine, course, rand)
      : null;
    let produce = null;
    if (w.sent && !usedSents.has(w.sent)) {
      produce = gapIn(w, mine, course, rand);
      if (produce) usedSents.add(w.sent);
    }
    if (!produce && w.en) produce = writeIt(w);
    if (!recognise && !produce) continue;
    chosen.push(w);
    if (recognise) first.push(recognise);
    if (produce) second.push(produce);
  }
  if (!chosen.length) return [];

  const out = [...rand.shuffle(first)];
  const match = pairsOf(all, rand);
  if (match) out.push(match);
  out.push(...rand.shuffle(second));
  if (voice) {
    let n = 0;
    for (const w of chosen) {
      if (n >= DICTATIONS) break;
      const ex = dictationOf(w, course, rand);
      if (ex) { out.push(ex); n++; }
    }
  }
  return out.map((ex, i) => ({ ...ex, key: `saved-${i}` }));
}
