/* The word drill.

   Three ways of knowing a word: hear it and spot the thing it names; see the
   thing and pick the word for it; see the thing and write the word. Each word
   in a session is asked once, in one of the three ways, and the three are
   dealt out evenly across the session so it is never ten of the same thing.
   Only the first way has a voice — the word is read out as it appears — and
   the other two are silent, because the point of them is reading the word for
   yourself and then producing it.

   Every question is about one word and nothing else, which is what separates
   this from the rest of the Practice screen: a lesson puts a word back inside
   a sentence, and this takes it out again. It is the drill for the day a
   sentence is too much — new words, a tired evening, a phone held in one hand.
   How many words it goes through is the learner's to set, in Settings.

   The pictures are the course's own: the photograph a new word arrived with,
   when it arrived with one. Where a word has none the same questions are
   asked with words instead — the meaning among four meanings, the word among
   four words, the word written from its meaning — so the drill is never short
   of material just because the picture index is.

   Nothing here needs a key or a network. The words come from the course's own
   vocabulary around the unit the path has reached, and only the words the
   lessons have already put in front of somebody: this is practice, not a
   preview. */

import { bareHe, normEn, senses } from "./exercises.js";
import { pictureFor } from "./images.js";
import { heForms, lexUnit } from "./morph.js";

/* Words a session asks about when nothing else has been said, and the
   lengths a learner can choose between. */
export const VOCAB_WORDS = 10;
export const VOCAB_CHOICES = [5, 10, 15, 20, 30];
/* Duolingo's picture question is three-up; the drill asks four, the way a
   vocabulary app does, because four pictures is still one glance and a word
   among four is a fairer test than a word among three. */
const OPTIONS = 4;
/* Fewer words than this and the drill would be asking the same three or four
   things about each other; below it the whole window is drawn on instead. */
const MIN_WORDS = 4;

/* Every sense a word carries, and every spelling it answers to. Two words that
   share either cannot appear in the same question: "which one of these is
   you?" with את and אתה both on screen has two right answers, and הבית beside
   בית is the same word twice. */
const spellings = (w) => new Set(heForms(bareHe(w.he)));
const clashes = (a, b) => {
  if (a === b || a.he === b.he) return true;
  const sa = spellings(a);
  if ([...spellings(b)].some((x) => sa.has(x))) return true;
  const s = new Set(senses(a));
  return senses(b).some((x) => s.has(x));
};

/* What the schedule is told. */
const credit = (w) => ({ he: w.he, en: w.en });

/* Three other things to put beside the answer, none of them the answer in
   disguise and none of them each other. `ok` narrows the field — to words
   with a picture, for the picture question — and `key` says what "the same"
   means for it, since two words illustrated by one photograph are one option
   twice however different they read. */
function pickOthers(word, from, rand, { ok = () => true, key = (w) => w.he } = {}) {
  const out = [];
  const taken = new Set([key(word)]);
  for (const w of rand.shuffle(from)) {
    if (out.length >= OPTIONS - 1) break;
    if (w === word || !ok(w) || taken.has(key(w))) continue;
    if (clashes(w, word) || out.some((o) => clashes(o, w))) continue;
    taken.add(key(w));
    out.push(w);
  }
  return out.length >= OPTIONS - 1 ? out : null;
}

/* ------------------------------------------------------------------ */
/* Builders — each returns an exercise or null                         */
/* ------------------------------------------------------------------ */

/* Heard: the word, read aloud, and four pictures. The word is shown as
   well as spoken — the drill is not a listening test, and a learner with no
   Hebrew voice on their device is still asked a fair question.

   The pictures carry no caption. The word is the prompt, so a word under each
   picture would be the answer written under the answer; and tapping a picture
   does not read its word out either, which is the same leak by ear. */
function spotIt(word, from, images, rand) {
  const img = pictureFor(images, word);
  if (!img) return null;
  const others = pickOthers(word, from, rand, {
    ok: (w) => !!pictureFor(images, w),
    key: (w) => pictureFor(images, w),
  });
  if (!others) return null;
  const options = rand.shuffle([word, ...others]).map((w) => ({ he: w.he, en: w.en, img: pictureFor(images, w) }));
  return {
    type: "select",
    instruction: "Tap the picture for this word",
    prompt: word.he,
    promptLang: "he",
    say: true,
    quiet: true,
    optionLang: "he",
    pictures: true,
    labels: false,
    options,
    answerIndex: options.findIndex((o) => o.he === word.he),
    display: word.he,
    words: [credit(word)],
  };
}

/* The same question for a word with no picture: hear it, and pick its meaning
   from four. */
function hearIt(word, from, rand) {
  const others = pickOthers(word, from, rand);
  if (!others) return null;
  const options = rand.shuffle([word, ...others]).map((w) => ({ he: w.en, en: w.he }));
  return {
    type: "select",
    instruction: "What does this mean?",
    prompt: word.he,
    promptLang: "he",
    say: true,
    optionLang: "en",
    options,
    answerIndex: options.findIndex((o) => o.en === word.he),
    display: word.en,
    words: [credit(word)],
  };
}

/* Read: the thing, and four words. Silent — the words are there to be
   read, not heard, so nothing is played on arrival and nothing on a tap. The
   meaning is in the question either way, because a photograph on its own can
   be read as the thing or as what it is doing. */
function pickIt(word, from, images, rand) {
  const others = pickOthers(word, from, rand);
  if (!others) return null;
  const options = rand.shuffle([word, ...others]).map((w) => ({ he: w.he, en: w.en }));
  const img = pictureFor(images, word);
  return {
    type: "select",
    instruction: `Which one of these is “${word.en}”?`,
    ...(img ? { promptImg: img } : {}),
    prompt: "",
    quiet: true,
    optionLang: "he",
    options,
    answerIndex: options.findIndex((o) => o.he === word.he),
    display: word.he,
    words: [credit(word)],
  };
}

/* Written: the thing, and a box. Marked by the same forgiving rules as
   every typed answer in the course, so a slip of one letter in a long word is
   a slip, and no voice, since the answer is the one thing not to read out. */
function writeIt(word, images) {
  const img = pictureFor(images, word);
  return {
    type: "type",
    lang: "he",
    instruction: "Write this in Hebrew",
    ...(img ? { promptImg: img } : {}),
    prompt: word.en,
    promptLang: "en",
    audio: "",
    accepted: [word.he],
    display: word.he,
    words: [credit(word)],
  };
}

/* ------------------------------------------------------------------ */
/* The session                                                         */
/* ------------------------------------------------------------------ */
/* `pool` is the course's word pool around the unit the path has reached;
   `unit` that unit; `known`, `lexicon` and `reached` together say which words
   the lessons have already taught, the same way the lesson builder reads
   them; `dueWords` what the schedule wants back; `images` the picture index;
   `words` how many to ask about, each once.

   The words that are due come first, then the ones with a picture, then the
   rest, so a session is reviews before it is anything else and pictures
   before it is words. The three kinds of question are dealt out in turn
   across the words and the result shuffled, so every session has all three
   in it and no run of one. */
export function buildVocabDrill({
  pool, unit, known = new Set(), lexicon = null, reached = 0, dueWords = [],
  images = null, rand, words = VOCAB_WORDS,
}) {
  const all = (pool?.words || []).filter((w) => w.he && w.en && normEn(w.en));
  if (!all.length) return [];

  const taught = (he) => {
    if (known.has(he)) return true;
    if (!lexicon || !reached) return false;
    const at = lexUnit(lexicon, bareHe(he));
    return at != null && at <= reached;
  };
  /* what the lessons have put in front of somebody: the units behind this
     one whole, and of this one only what has been answered about or taught */
  let met = all.filter((w) => w.unit < unit || taught(w.he));
  if (met.length < MIN_WORDS) met = all;

  const due = new Set(dueWords.map((d) => d.he));
  const pictured = (w) => !!pictureFor(images, w);
  const groups = [
    met.filter((w) => due.has(w.he) && pictured(w)),
    met.filter((w) => !due.has(w.he) && pictured(w)),
    met.filter((w) => due.has(w.he) && !pictured(w)),
    met.filter((w) => !due.has(w.he) && !pictured(w)),
  ];

  const chosen = [];
  for (const g of groups) {
    for (const w of rand.shuffle(g)) {
      if (chosen.length >= words) break;
      if (!chosen.some((c) => clashes(c, w))) chosen.push(w);
    }
    if (chosen.length >= words) break;
  }
  if (!chosen.length) return [];

  /* the wrong answers come from everything met, not only from the words
     chosen: ten words drilling each other is a session you can answer by
     elimination */
  const kinds = [
    (w) => spotIt(w, met, images, rand) || hearIt(w, met, rand),
    (w) => pickIt(w, met, images, rand),
    (w) => writeIt(w, images),
  ];
  const out = [];
  chosen.forEach((w, i) => {
    /* the kind this word is dealt, and failing that — no three other words
       to put beside it — the one that needs nothing beside it */
    const ex = kinds[i % kinds.length](w) || writeIt(w, images);
    out.push(ex);
  });

  return rand.shuffle(out).map((ex, i) => ({ ...ex, key: `vocab-${i}` }));
}
