/* Hebrew morphology — as much of it as "have they been taught this word?" needs.

   Hebrew glues its function words onto the front of the next word and its
   possessives onto the back, and the course's word index is keyed by whichever
   spelling happened to turn up first. Between them, the index lied. עיר is
   unit 1 and העיר was unit 102. מדינה is unit 3 and מדינת was unit 125.
   גדולה is unit 12 and הגדולה was unit 170. בירה is unit 8 and בירתה was
   nothing at all — a word the course had never heard of.

   Everything downstream reads that index: which sentences are weighed as
   readable, which words a lesson front-loads as new, whether a passage clears
   the coverage bar, how much of a unit's vocabulary is still held. So the lie
   propagated, and it always pointed the same way — real Hebrew looked years
   further off than it is. Scored a letter at a time, the opening sentence of
   the Hebrew Wikipedia article on Jerusalem is 60% readable at unit 84. Scored
   with the prefixes and suffixes taken off, it is fully readable at unit 40.

   This is not a morphological analyser and does not try to be. It generates
   the forms a word could be standing in for and lets the caller look each one
   up: a form nobody was ever taught costs nothing, and a form that lands is
   the answer. Which makes the only real failure mode over-generation — a whole
   word read as a prefixed one, so מים is credited to whoever knows ים. Three
   things hold that down: the stacking follows the order Hebrew actually
   allows, an analysis may not bottom out on a two-letter word except in the
   one step where that is ordinary, and the words that look decomposable but
   are not are listed by hand in OPAQUE below.

   The proper fix for the tail is a real lemmatiser at build time — hspell's
   inflection database, or Dicta's Nakdan, which hands back a lemma per token.
   These rules are what runs with no network and no build step. */

/* The five letters that change shape at the end of a word. Cutting a suffix
   off exposes a letter that was in the middle and now is not — מלכים is מלכ
   before it is מלך — so the shape has to be put back or the lookup misses. */
const FINAL = { "כ": "ך", "מ": "ם", "נ": "ן", "פ": "ף", "צ": "ץ" };
const finalized = (w) => {
  const f = FINAL[w[w.length - 1]];
  return f ? w.slice(0, -1) + f : w;
};

/* Words whose first letter only looks like one of Hebrew's glued-on function
   words, where what is left over is itself a word the course teaches — so
   without this list the index would credit לחם to anyone who knows חם, מים to
   anyone who knows ים, and שבת to anyone who knows בת.

   It blocks the front of the word and not the back: מלכים is still read as a
   plural of מלך, it is only never read as לכים. Endings are much less prone to
   this, because an ending that comes off leaves a stem rather than another
   whole word — and where it does leave one, as איש does from אישה, the two are
   related closely enough that a learner who has one can read the other.

   The bar for being here is that both halves are real and unrelated. כתב off
   מכתב is the same root and a learner who knows one can guess the other, so
   מכתב is not on the list. לב off כלב is a coincidence of spelling. */
const OPAQUE = new Set(`
מים מלך מלכה מקום משפחה מספר מעט מלא מצא מיד מנהל מורה מכונה משקה מזג
מלחמה מדינה
כלב כסף כדור כפר כתום כיתה
לחם לבן לילה לשון
שבת שאל שפה שמים שקר שולחן שמלה שמש שלם שלמה
בחור בקבוק בגד בריא בעל
הבין הלך הכיר הגיע היום הכי
`.trim().split(/\s+/));

/* The one-letter starts, for the near-miss hint that wants to name the mistake
   rather than fix it. Kept exactly as it was: a hint saying "check the little
   letter on the front" is about one letter, whatever the index now allows. */
const PREFIXES = "והבלכמש";
export const heStem = (w) => (w.length > 2 && PREFIXES.includes(w[0]) ? w.slice(1) : w);

/* How much word an analysis is allowed to leave behind.

   Hebrew's shortest words are its commonest — לא, כן, ים, בן, שם, על — which
   makes a two-letter residue both where a wrong analysis usually lands and the
   most expensive place for it to land, on a word the course teaches in its
   first fortnight. But it is also where plenty of right ones land: ולא and וזה
   and בכל are one letter on a two-letter word, and they are everywhere.

   What separates them is depth. One clitic on a short word is ordinary Hebrew;
   two stacked clitics arriving at a short word is the analyser talking itself
   into something — ומלא is not ו־מ־לא, and שלמים is not ש־ל־מים. So a single
   strip may leave two letters and anything past that may not. Endings are held
   to three throughout, since an ending coming off a three-letter word is
   almost always a misreading: מים as מי, שמיים as a plural of שם. */
const FLOOR = 3;

/* Hebrew lets the glued-on words stack, but only in one order: the ו of "and"
   outside the ש of "that", and both of them outside the article and the
   one-letter prepositions. וכשבבית is ו־כש־ב־בית and nothing else, so the
   peeling runs in slots rather than in a loop, and a stripping the language
   does not allow is never even proposed.

   ב, כ and ל swallow the article rather than stand next to it — בעיר is both
   "in a city" and "in the city" — so each of them also proposes the definite
   form, which is how העיר gets found under a word that never shows the ה. */
function prefixForms(w) {
  const out = [];
  /* two letters is enough after one strip, three after any more */
  const push = (x, depth) => {
    if (x.length >= (depth > 1 ? FLOOR : 2) && !out.includes(x)) out.push(x);
  };

  const inner = (x, depth) => {
    push(x, depth);
    if (x.length < 3) return;
    const c = x[0];
    if (c === "ה") push(x.slice(1), depth + 1);
    else if (c === "מ") {
      push(x.slice(1), depth + 1);
      if (x[1] === "ה" && x.length > 3) push(x.slice(2), depth + 2);   /* מהעיר */
    } else if (c === "ב" || c === "כ" || c === "ל") {
      push(x.slice(1), depth + 1);                                      /* in a city */
      push("ה" + x.slice(1), depth + 1);                                /* in the city */
    }
  };

  const middle = (x, depth) => {
    inner(x, depth);
    for (const p of ["לכש", "כש", "מש", "ש"]) {
      if (x.startsWith(p) && x.length - p.length >= 2) { inner(x.slice(p.length), depth + 1); break; }
    }
  };

  middle(w, 0);
  if (w[0] === "ו" && w.length >= 3) middle(w.slice(1), 1);
  return out;
}

/* A pronoun hanging off the back — of a noun (ביתי), a preposition (אליהם) or
   a verb (ראיתיו). Longest match wins, because ־יהם is one ending and not ־ה
   after ־יה. The ־י־ ones sit on a plural base, so they also propose the
   plural: ילדיהם is ילדים before it is ילד. */
const POSSESSIVE = ["יהם", "יהן", "יכם", "יכן", "ינו", "יה", "יו", "יך", "יי",
                    "הם", "הן", "כם", "כן", "נו", "ה", "ו", "י", "ך", "ם", "ן"];

/* What a plural, a construct or a feminine ending leaves behind, and what the
   dictionary spelling of it looks like — מדינות and מדינת are both מדינה,
   ילדי is ילדים, שולחנות is שולחן once the נ goes back to its final shape. */
const ENDINGS = [["יים", ["", "ה"]], ["ים", ["", "ה"]], ["ות", ["", "ה"]],
                 ["ת", ["ה", ""]], ["י", ["ים", ""]], ["ה", [""]]];

function suffixForms(w, push) {
  const bases = [w];
  for (const end of POSSESSIVE) {
    if (!w.endsWith(end)) continue;
    const cut = w.slice(0, -end.length);
    if (cut.length < FLOOR) break;
    bases.push(cut, finalized(cut));
    if (end[0] === "י" && cut.length >= FLOOR) bases.push(cut + "ים", cut + "ות");
    break;
  }
  for (const b of bases) {
    push(b);
    for (const [end, adds] of ENDINGS) {
      if (!b.endsWith(end)) continue;
      const cut = b.slice(0, -end.length);
      if (cut.length < FLOOR) continue;
      for (const a of adds) push(cut + a);
      push(finalized(cut));
    }
  }
}

const cache = new Map();

/* Every spelling this word could be standing in for, the word itself first.

   Order is not a ranking and callers should not read it as one — the point is
   that a set of candidates gets looked up, not that the first hit is the right
   analysis. */
export function heForms(word) {
  const w = String(word || "");
  if (!w || w.length < 2) return w ? [w] : [];
  const hit = cache.get(w);
  if (hit) return hit;

  /* The word is always a form of itself whatever the floor says about what may
     be derived from it: half of Hebrew's commonest words are two letters long,
     and dropping את and יש on the way in is how a passage made of them reads as
     untaught.

     Endings come off first, and only then does the front become a question,
     because a word is opaque as a word rather than as a spelling. מלך is
     listed, so מלכים must not be read as לכים either — and it is the plural
     that knows to say so. */
  const own = [w];
  const collect = (list) => (x) => { if (x.length >= 2 && !list.includes(x)) list.push(x); };
  suffixForms(w, collect(own));

  const forms = [...own];
  if (!own.some((f) => OPAQUE.has(f))) {
    const push = collect(forms);
    for (const p of prefixForms(w)) if (p !== w) suffixForms(p, push);
  }
  /* Bounded because it is asked about every token of every sentence in the
     course, and a map that grows for ever inside a session is a leak. */
  if (cache.size > 20000) cache.clear();
  cache.set(w, forms);
  return forms;
}

/* Is `w` one of the forms in `set`? The question every caller actually has —
   "does this sentence use a word they have met" — where the sentence says
   ובעירנו and the word list says עיר. */
export const holds = (set, w) => {
  if (set.has(w)) return true;
  const forms = heForms(w);
  for (let i = 1; i < forms.length; i++) if (set.has(forms[i])) return true;
  return false;
};

/* The unit that first teaches this word, reading through the inflection: the
   earliest unit of any form it could be standing in for.

   Earliest rather than the surface form's own entry, because the surface
   form's entry is the thing that was wrong. העיר is in the index at 102 and
   that is not when anyone learns it — it is when the corpus first happens to
   spell it that way. */
export function lexUnit(lexicon, w) {
  if (!lexicon) return null;
  let best = null;
  for (const f of heForms(w)) {
    const at = lexicon[f];
    if (at != null && (best == null || at < best)) best = at;
  }
  return best;
}
