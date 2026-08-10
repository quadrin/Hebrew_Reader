/* Cloze exercises — fill-in-the-blank drills built from real sentences:
   random sentences drawn from the current book, plus sentences the reader
   saved words from. Entirely client-side and instant. */

import { stripWord, removeNikkud, splitSentences, shuffle } from "./text.js";

/* Function words that make bad blanks and bad distractors */
const STOP = new Set([
  "של", "את", "הוא", "היא", "זה", "זאת", "אני", "אתה", "אתם", "לא", "כן",
  "גם", "אם", "כי", "על", "עם", "אל", "או", "מן", "כל", "יש", "אין", "הם",
  "הן", "מה", "מי", "עוד", "רק", "אבל", "אז", "שם", "פה", "כך", "היה",
  "הייתה", "היתה", "היו", "אשר", "כמו", "עד", "בין", "אחרי", "לפני",
  "אולי", "הנה", "לו", "לה", "להם", "בו", "בה", "אחד", "אחת", "ואת",
]);

export function isContentWord(token) {
  const s = stripWord(token);
  if (!s) return false;
  const bare = removeNikkud(s);
  return bare.length >= 3 && !STOP.has(bare);
}

const bareForm = (token) => removeNikkud(stripWord(token));

function makeItem(sentence, blankIdx, distractorPool, rng) {
  const tokens = sentence.split(" ");
  const answer = stripWord(tokens[blankIdx]);
  const answerBare = bareForm(tokens[blankIdx]);
  const distractors = [];
  const seen = new Set([answerBare]);
  for (const w of shuffle(distractorPool)) {
    const b = removeNikkud(w);
    if (seen.has(b)) continue;
    seen.add(b);
    distractors.push(w);
    if (distractors.length === 3) break;
  }
  if (distractors.length < 3) return null;
  const options = shuffle([answer, ...distractors]);
  return {
    sentence,
    tokens,
    blankIdx,
    answer,
    correctIdx: options.indexOf(answer),
    options,
  };
}

/* Random cloze items from a book's pages (or any array of prose strings).
   Words in `exclude` (bare forms the reader marked as known) are never
   blanked — drilling them teaches nothing. */
export function buildBookCloze(pages, count, exclude = new Set()) {
  const source = pages.length > 60 ? shuffle(pages).slice(0, 60) : pages;
  const sentences = [];
  for (const p of source) {
    for (const s of splitSentences(p || "")) {
      const toks = s.split(" ");
      if (toks.length >= 5 && toks.length <= 18 && toks.some(isContentWord)) sentences.push(s);
    }
  }
  if (!sentences.length) return [];
  /* distractor pool: unique content words across the sampled sentences */
  const pool = [];
  const poolSeen = new Set();
  for (const s of sentences) {
    for (const t of s.split(" ")) {
      if (!isContentWord(t)) continue;
      const b = bareForm(t);
      if (poolSeen.has(b)) continue;
      poolSeen.add(b);
      pool.push(stripWord(t));
    }
  }
  const items = [];
  for (const s of shuffle(sentences)) {
    if (items.length >= count) break;
    const toks = s.split(" ");
    const contentIdxs = toks
      .map((t, i) => (isContentWord(t) && !exclude.has(bareForm(t)) ? i : -1))
      .filter((i) => i >= 0);
    if (!contentIdxs.length) continue;
    const blankIdx = contentIdxs[Math.floor(Math.random() * contentIdxs.length)];
    const item = makeItem(s, blankIdx, pool, Math.random);
    if (item) items.push(item);
  }
  return items;
}

/* Cloze items from saved words that remember their source sentence */
export function buildSavedCloze(saved, count, extraPool = []) {
  const entries = Object.entries(saved).filter(([, e]) => e.sent);
  const pool = [
    ...Object.keys(saved),
    ...extraPool,
  ].filter((w) => isContentWord(w)).map((w) => stripWord(w));
  const items = [];
  for (const [word, e] of shuffle(entries)) {
    if (items.length >= count) break;
    /* entries are keyed by base form — blank whichever surface form
       actually appears in the source sentence */
    const targets = new Set(
      [word, ...(e.forms || [])]
        .flatMap((f) => String(f).split(/\s+/))
        .map((f) => bareForm(f))
        .filter(Boolean)
    );
    const toks = e.sent.split(" ");
    const blankIdx = toks.findIndex((t) => targets.has(bareForm(t)));
    if (blankIdx < 0) continue;
    const item = makeItem(e.sent, blankIdx, pool, Math.random);
    if (item) items.push({ ...item, savedWord: word });
  }
  return items;
}
