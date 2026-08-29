/* What counts as a readable piece of real Hebrew.

   Shared by the harvester and by check:feed, for the reason the session
   builder and its checks share `holds`: a measure that disagrees with the
   thing it measures reports on a course nobody is taking. The feed is
   generated data, so the check's job is to re-derive every shipped number from
   the committed lexicon and say so when they no longer agree — which is what
   happens the moment the morphology or the course changes underneath it. */

import { lexUnit } from "../../src/duo/morph.js";

/* A sentence shorter than this is a caption, and longer than this is a chain
   of clauses nobody reads for pleasure at any level. */
export const MIN_TOKENS = 6;
export const MAX_TOKENS = 26;
/* How many words an item may leave for the gloss. One in twelve is roughly the
   95% the reading research asks for; three is the ceiling however long the
   passage runs, because four things to look up is a lesson, not a read. */
export const GLOSS_SHARE = 1 / 12;
export const GLOSS_CAP = 3;
/* Of the words that are not glossed, the share already taught for the item to
   count as readable at a unit. */
export const COVERAGE = 0.95;
/* Sentences joined into one item, and the tokens they may add up to. */
export const MAX_LINES = 5;
export const MAX_RUN_TOKENS = 70;
/* The least a line can carry and still say anything about who can read it: a
   sentence that is mostly the article's own name says nothing. */
export const MIN_KNOWN = 4;

export const glossBudget = (n) => Math.min(GLOSS_CAP, Math.max(1, Math.floor(n * GLOSS_SHARE)));

/* A Wikipedia lead opens on its own name in four alphabets. ⁧ירושלים⁩ begins
   "יְרוּשָׁלַיִם (בערבית: …, נהגה אל-קֻדְס [משמעות מילולית: …]) היא בירתה של…", and
   none of that is Hebrew anyone reads. Parentheses go if they hold a foreign
   script; brackets always go, being pronunciation and editorial notes. */
export const FOREIGN = /[A-Za-z؀-ۿͰ-ϿЀ-ӿ]/;

export function clean(text) {
  let t = String(text || "");
  /* innermost outwards, twice, because these parentheticals nest */
  for (let i = 0; i < 2; i++) t = t.replace(/\([^()]*\)/g, (m) => (FOREIGN.test(m) ? " " : m));
  return t
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[‎‏‪-‮]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ ([,.;:!?])/g, "$1")
    .trim();
}

export const bare = (s) => s.replace(/[֑-ׇ]/g, "").replace(/[^֐-׿0-9]/g, "");

/* A hyphen joins two words and is not a letter in either of them. Splitting on
   whitespace alone turned ⁧רב-לאומית⁩ into ⁧רבלאומית⁩ — a spelling nobody uses,
   which the index cannot know, so it was scored as an unknown word and then
   offered to the reader as one of the words to learn. Both halves are ordinary
   Hebrew and at least one of them is usually taught. */
export const tokens = (s) => String(s).split(/[\s־–—-]+/).map(bare).filter(Boolean);

/* A line still carrying a foreign alphabet, an unclosed parenthesis or a bare
   date is not a line to read. */
export const readable = (s) => !FOREIGN.test(s) && !/[()[\]]/.test(s) && !/^\d/.test(String(s).trim());

/* Everything about a stretch of Hebrew that deciding takes.

   Words of the article's own title that the course never teaches are free, the
   way a passage's declared names are: nobody is taught ⁧ירושלים⁩, and a reader
   looking at an article about cats knows what it is about before the first
   word. A title word the course does teach is not made free by appearing in
   the title — it keeps its own unit, or an article named after an early word
   would read as easier than it is.

   Everything else the course has never taught is a word to gloss. Those are
   listed rather than forgiven: a text with nothing unknown in it is a test and
   not a read, so a few are wanted and many disqualify the line.

   `at` is the unit from which this is readable — the unit of the last word
   needed to reach COVERAGE, counting only what is not glossed. Measured over
   the whole item rather than over its hardest sentence, because coverage is a
   property of a text and not of its worst line. */
export function weigh(text, free, lexicon) {
  const toks = tokens(text);
  const units = [];
  const gloss = [];
  for (const t of toks) {
    const at = lexUnit(lexicon, t);
    if (at != null) units.push(at);
    else if (!free.has(t)) gloss.push(t);
  }
  units.sort((a, b) => a - b);
  const need = Math.ceil(units.length * COVERAGE);
  return {
    n: toks.length,
    known: units.length,
    gloss: [...new Set(gloss)],
    at: need ? units[need - 1] : 1,
  };
}

/* May this sentence join a run? Length, alphabet, and its own share of unknown
   words — the run's own total is checked separately, since a paragraph is
   allowed more glossing than any one of its lines. */
export function lineFits(sentence, w) {
  return readable(sentence) && w.n >= MIN_TOKENS && w.n <= MAX_TOKENS
    && w.known >= MIN_KNOWN && w.gloss.length <= glossBudget(w.n);
}

/* Which words of a title the reader gets for free. */
export const freeWords = (title, lexicon) =>
  new Set(tokens(title).filter((t) => lexUnit(lexicon, t) == null));
