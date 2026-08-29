/* Practice built out of the paragraphs you have just read.

   A reading screen with nothing after it is not practice, whatever tab it sits
   on: you read, you tap a word, and tomorrow the app knows nothing about
   either. What was missing is the second half of the loop the rest of the
   course already runs — read a paragraph, star what you did not know, then
   answer about those words inside those sentences, and have them come round
   again on the schedule.

   So the drill is made from the session's own text. Not from a unit's sentence
   bank, not from a theme: the gap falls on a word you starred, in the sentence
   you starred it in, and the dictation reads back a line you have already seen
   once. That is the whole argument for reading real Hebrew inside the course
   rather than beside it — the words arrive with a sentence behind them.

   Everything here works with no key and no network. The exercises come out in
   the shape the session player already renders, so the reading feeds the
   grader, the mistake list and the review schedule that were built for the
   path, rather than a second set of them built for this.

   What it cannot do without help is ask for a translation. A feed paragraph
   has no English — that is what makes it real — so there is nothing to mark a
   typed translation against, and the only exercises here are the ones that
   need no reference: the gap, and the dictation. */

import { splitSentences } from "../text.js";
import { isContentWord } from "../cloze.js";
import { bareHe, tokenizeHe } from "./exercises.js";
import { lexUnit, heForms } from "./morph.js";

/* Long enough to have a middle worth blanking, short enough to hold in the ear
   for a dictation. */
const MIN_TOKENS = 5;
const MAX_CLOZE_TOKENS = 18;
const MAX_DICTATION_TOKENS = 9;

const CLOZE = 6;
const DICTATION = 4;

/* Distractors have to be wrong without being absurd. A gap in a Hebrew
   sentence offering ⁧כלב⁩, ⁧אוניברסיטה⁩ and ⁧ב⁩ is answered by shape alone, so the
   pool is drawn from words the course has taught by the level being read at,
   and then narrowed to ones about as long as the answer. */
function distractorPool(lexicon, reached) {
  const pool = [];
  for (const [w, at] of Object.entries(lexicon)) {
    if (at <= reached && w.length >= 3 && w.length <= 9) pool.push(w);
  }
  return pool;
}

/* Which word the gap should fall on.

   A word the reader stopped and looked up is the best question there is: they
   have already told you they did not know it. Failing that, the latest-taught
   content word in the line, because the gap is worth spending on the word the
   sentence is actually teaching rather than on ⁧של⁩. */
function targetIn(tokens, starred, lexicon) {
  const bare = tokens.map(bareHe);
  let best = -1, bestAt = -1;
  for (let i = 0; i < tokens.length; i++) {
    const b = bare[i];
    if (!b || !isContentWord(tokens[i])) continue;
    if (starred.has(b)) return i;
    const at = lexUnit(lexicon, b) ?? 0;
    if (at > bestAt) { bestAt = at; best = i; }
  }
  return best;
}

function clozeFrom(sentence, starred, lexicon, pool, rand) {
  const tokens = tokenizeHe(sentence);
  if (tokens.length < MIN_TOKENS || tokens.length > MAX_CLOZE_TOKENS) return null;
  const idx = targetIn(tokens, starred, lexicon);
  if (idx < 0) return null;

  const answer = tokens[idx];
  const bare = bareHe(answer);
  const inSentence = new Set(tokens.map(bareHe));
  const near = pool.filter((w) => Math.abs(w.length - bare.length) <= 2 && !inSentence.has(w));
  const others = rand.sample(near.length >= 8 ? near : pool.filter((w) => !inSentence.has(w)), 2);
  if (others.length < 2) return null;

  const options = rand.shuffle([{ he: answer }, ...others.map((he) => ({ he }))]);
  return {
    type: "blank",
    instruction: "Fill in the blank",
    sentence: tokens.map((t, i) => (i === idx ? null : t)),
    /* no English to show under it, and an empty line is honest — the sentence
       is the context, which is the point of taking it from something read */
    translation: "",
    full: sentence,
    optionLang: "he",
    options,
    answerIndex: options.findIndex((o) => o.he === answer),
    display: answer,
    /* what the schedule is told. Only a word whose meaning the reader actually
       looked up carries one, since a word filed with no English is a card that
       cannot be reviewed. */
    words: starred.has(bare) ? [{ he: bare, en: starred.get(bare) }] : [],
  };
}

function dictationFrom(sentence, starred, pool, rand) {
  const tokens = tokenizeHe(sentence);
  if (tokens.length < MIN_TOKENS || tokens.length > MAX_DICTATION_TOKENS) return null;
  const inSentence = new Set(tokens.map(bareHe));
  const extras = rand.sample(pool.filter((w) => !inSentence.has(w)), Math.max(3, 10 - tokens.length));
  if (extras.length < 3) return null;
  const bare = tokens.map(bareHe);
  return {
    type: "listen",
    lang: "he",
    instruction: "Tap what you hear",
    prompt: "",
    promptLang: "",
    audio: "",
    text: sentence,
    accepted: [sentence],
    display: sentence,
    answer: tokens,
    tiles: rand.shuffle([...tokens, ...extras]),
    solutionEn: "",
    words: bare.filter((b) => starred.has(b)).map((b) => ({ he: b, en: starred.get(b) })),
  };
}

/* The session, in the order it is answered: the gaps first, while the
   paragraph is still in mind, then the dictations, which ask for the same
   sentences with the text taken away. */
export function buildFeedDrill({ items, starred, lexicon, reached, rand, voice }) {
  const pool = distractorPool(lexicon, Math.max(reached, 40));
  if (pool.length < 20) return [];

  /* Every line of everything read, longest-lived first: a sentence carrying a
     word the reader looked up is worth more than one they read straight past. */
  const lines = [];
  for (const it of items) {
    for (const s of splitSentences(it.he)) {
      const has = tokenizeHe(s).map(bareHe).some((b) => starred.has(b));
      lines.push({ s, has });
    }
  }
  const ordered = [...lines.filter((l) => l.has), ...rand.shuffle(lines.filter((l) => !l.has))];

  const out = [];
  /* No line twice, and no word twice — where "twice" is judged through the
     morphology rather than letter for letter. Gaps on ⁧לאומי⁩, ⁧הלאומי⁩ and
     ⁧לאומים⁩ are three spellings of one question, and by the third the answer
     is remembered rather than read. */
  const usedLines = new Set();
  const usedWords = new Set();
  for (const { s } of ordered) {
    if (out.length >= CLOZE || usedLines.has(s)) continue;
    const ex = clozeFrom(s, starred, lexicon, pool, rand);
    if (!ex) continue;
    const forms = heForms(bareHe(ex.display));
    if (forms.some((f) => usedWords.has(f))) continue;
    out.push(ex);
    usedLines.add(s);
    for (const f of forms) usedWords.add(f);
  }
  if (voice) {
    let n = 0;
    for (const { s } of ordered) {
      if (n >= DICTATION) break;
      const ex = dictationFrom(s, starred, pool, rand);
      if (ex) { out.push(ex); n++; }
    }
  }
  return out;
}
