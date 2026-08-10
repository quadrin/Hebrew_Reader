/* Free dictionary lookups — Wiktionary's public REST API serves Hebrew
   definitions with open CORS, so tapped words in any book get a gloss even
   with no AI key. The AI tutor (when configured) stays the primary source
   because it reads the word in context. */

import { removeNikkud, stripBidi } from "./text.js";

const cache = new Map(); /* headword candidate -> parsed result | null */

/* Hebrew one-letter prefixes (and/the/in/to/from/that/as) — text words often
   carry them, but dictionary headwords don't. Peel them one at a time. */
const PREFIX = /^[ובלכמשה]/;

function candidatesFor(word) {
  const bare = removeNikkud(stripBidi(word)).replace(/[^א-ת]/g, "");
  const list = [];
  let w = bare;
  while (w.length >= 2 && list.length < 4) {
    list.push(w);
    if (!PREFIX.test(w)) break;
    w = w.slice(1);
  }
  return list;
}

const stripHtml = (html) => {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  return (doc.body?.textContent || "").replace(/\s+/g, " ").trim();
};

async function fetchEntry(headword) {
  if (cache.has(headword)) return cache.get(headword);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(headword)}`,
      { signal: ctl.signal, headers: { "Api-User-Agent": "Lavan Hebrew Reader (github.com/quadrin/Hebrew_Reader)" } }
    );
    if (!r.ok) { cache.set(headword, null); return null; }
    const data = await r.json();
    const entries = data?.he;
    if (!Array.isArray(entries) || !entries.length) { cache.set(headword, null); return null; }
    const senses = [];
    for (const entry of entries) {
      const pos = (entry.partOfSpeech || "").toLowerCase();
      for (const def of entry.definitions || []) {
        const text = stripHtml(def.definition);
        if (text) senses.push({ pos, text });
        if (senses.length >= 4) break;
      }
      if (senses.length >= 4) break;
    }
    if (!senses.length) { cache.set(headword, null); return null; }
    /* inflected-form entries ("Third-person ... of רָאָה") name their lemma —
       capture it so the app can file the word under its base form */
    let lemma = null;
    const m = senses[0].text.match(/\bof\s+([֐-׿][֐-׿׳״]*)/);
    if (m) lemma = m[1];
    const parsed = { headword, senses, lemma };
    cache.set(headword, parsed);
    return parsed;
  } catch (e) {
    /* network error — don't cache, a retry may succeed */
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function formatEntry(entry, firstCandidate) {
  const [first, ...rest] = entry.senses;
  let g = first.text;
  if (g.length > 110) g = g.slice(0, 107).trimEnd() + "…";
  const extras = rest
    .slice(0, 2)
    .map((s) => (s.pos && s.pos !== first.pos ? `${s.pos}: ${s.text}` : s.text))
    .map((t) => (t.length > 90 ? t.slice(0, 87).trimEnd() + "…" : t));
  const parts = [];
  if (first.pos) parts.push(first.pos);
  if (firstCandidate && entry.headword !== firstCandidate) parts.push(`entry: ${entry.headword}`);
  if (extras.length) parts.push(extras.join(" · "));
  return { g, n: parts.join(" · "), headword: entry.headword };
}

/* Look a word up, peeling prefixes until something matches.
   Returns { g, n, headword, base } or throws if nothing is found. */
export async function wiktionaryLookup(word) {
  for (const cand of candidatesFor(word)) {
    const entry = await fetchEntry(cand);
    if (!entry) continue;
    /* base form: the lemma an inflected entry points at, else the headword
       (which is the tapped word with any ב/ל/מ/ה prefixes peeled off) */
    return { ...formatEntry(entry, candidatesFor(word)[0]), base: entry.lemma || entry.headword };
  }
  throw new Error("no dictionary entry");
}

/* Fixed expressions: probe the dictionary for two-word combinations of the
   tapped word with its neighbors (מגדל תצפית, בית ספר…), including variants
   with a leading ה stripped, since headwords are usually indefinite. */
export async function wiktionaryPhraseLookup(prevTok, word, nextTok) {
  const bare = (t) => removeNikkud(stripBidi(String(t || ""))).replace(/[^א-ת]/g, "");
  const w = bare(word);
  if (!w) throw new Error("no word");
  const p = bare(prevTok), nx = bare(nextTok);
  const combos = [];
  if (p) combos.push(`${p} ${w}`);
  if (nx) combos.push(`${w} ${nx}`);
  if (nx && nx.length > 2 && nx.startsWith("ה")) combos.push(`${w} ${nx.slice(1)}`);
  if (p && p.length > 2 && p.startsWith("ה")) combos.push(`${p.slice(1)} ${w}`);
  for (const c of combos.slice(0, 4)) {
    const entry = await fetchEntry(c);
    if (!entry) continue;
    return { ...formatEntry(entry, null), phrase: entry.headword };
  }
  throw new Error("no phrase entry");
}
