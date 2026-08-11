/* Builds the offline starter shelf in public/shelf/ from Project Ben-Yehuda's
   public-domain dump.

   The dump is ~3 GB, so it is not a build dependency: run this by hand when
   you want to refresh the shelf, and commit what it writes — the same
   arrangement scripts/fetch-fonts.mjs uses for the webfonts. The deploy
   workflow then needs nothing but the committed JSON.

       git clone --depth 1 https://github.com/projectbenyehuda/public_domain_dump
       npm run build:shelf -- --dump ../public_domain_dump

   Every work in that dump is public domain; its LICENSE asks that reuse
   credit "Project Ben-Yehuda volunteers", which the shelf does on each book.

   Difficulty is measured against the corpus itself rather than an outside
   word list: the script ranks every word in a large sample of the dump by
   frequency, then scores a work by how much of it is built from the commonest
   2,000 words. A learner who knows those words understands that fraction of
   the text, which is the number the reader already shows per page. */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "public", "shelf");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const DUMP = arg("dump", "/workspace/projectbenyehuda/public_domain_dump");
const TARGET = Number(arg("count", 72));          /* works to ship */
const MAX_PER_AUTHOR = Number(arg("per-author", 3));
const MIN_CHARS = 1800;
const MAX_CHARS = 26000;
const FREQ_SAMPLE = 4000;                          /* works read to rank vocabulary */
const COMMON_WORDS = 2000;

/* Genres worth reading end to end. "reference" and "lexicon" are dictionaries,
   "letters" is mostly correspondence fragments — both read poorly as books. */
const GENRES = {
  "he.prose": "prose",
  "he.fables": "fables",
  "he.poetry": "poetry",
  "he.memoir": "memoir",
  "he.article": "essay",
  "he.drama": "drama",
};

const HEB = /[֐-׿]/;
const stripNikkud = (s) => s.replace(/[֑-ׇ]/g, "");
const words = (s) =>
  stripNikkud(s).split(/[^א-ת]+/).filter((w) => w.length > 1);

/* ------------------------------------------------------------------ */
/* romanization                                                        */
/* ------------------------------------------------------------------ */

/* Titles exist only in Hebrew, so they get romanized rather than translated —
   enough for a reader who can't yet decode the script to pronounce a title and
   tell two books apart.

   This only works from nikkud: Hebrew script doesn't write most vowels, so an
   unvocalized title cannot be sounded out without knowing the word already.
   Guessing produced nonsense (אגודת הסופרים came out "Gavadat Haasavafarayam"),
   so a title that can't be vocalized simply gets no romanization. Where the
   title is bare but the book's own text is vocalized, the text supplies the
   missing vowels — that recovers a good number of them. */

const DAGESHABLE = { "ב": ["b", "v"], "כ": ["k", "kh"], "פ": ["p", "f"], "ך": ["k", "kh"], "ף": ["p", "f"] };
const CONSONANT = {
  "א": "", "ב": "v", "ג": "g", "ד": "d", "ה": "h", "ו": "v", "ז": "z", "ח": "ch",
  "ט": "t", "י": "y", "כ": "kh", "ך": "kh", "ל": "l", "מ": "m", "ם": "m", "נ": "n",
  "ן": "n", "ס": "s", "ע": "", "פ": "f", "ף": "f", "צ": "tz", "ץ": "tz", "ק": "k",
  "ר": "r", "ש": "sh", "ת": "t",
};
const VOWEL = {
  "ַ": "a", "ָ": "a", "ֲ": "a",          /* patach, kamatz, chataf-patach */
  "ֵ": "e", "ֶ": "e", "ֱ": "e",          /* tzere, segol, chataf-segol */
  "ִ": "i",                                          /* chirik */
  "ֹ": "o", "ֻ": "u",                          /* cholam, kubutz */
  "ֳ": "o",                                          /* chataf-kamatz */
};
const SHEVA = "ְ";
const DAGESH = "ּ";
const SHIN_DOT = "ׁ";
const SIN_DOT = "ׂ";

function romanizeWord(word) {
  let out = "";
  let lastShevaSilent = false;
  let sheva = null;
  const chars = [...word];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (!/[א-ת]/.test(c)) continue;
    /* diacritics attached to this letter */
    let marks = "";
    let j = i + 1;
    while (j < chars.length && /[֑-ׇ]/.test(chars[j])) { marks += chars[j]; j++; }

    let letter;
    if (c === "ש") letter = marks.includes(SIN_DOT) ? "s" : "sh";
    else if (DAGESHABLE[c]) letter = DAGESHABLE[c][marks.includes(DAGESH) ? 0 : 1];
    else letter = CONSONANT[c] ?? "";

    /* ו and י double as vowel letters */
    if (c === "ו" && marks.includes(DAGESH) && !marks.includes(SHIN_DOT)) letter = "u";
    else if (c === "ו" && marks.includes("ֹ")) letter = "o";
    else if (c === "ה" && i === chars.length - 1 && !marks) letter = "";       /* silent final ה */
    else if (c === "י" && !marks && /[ִֵ]/.test(chars[i - 1] || "")) letter = "";
    /* א and ע are silent, but between two vowels they mark the break */
    else if ((c === "א" || c === "ע") && /[aeiou]$/.test(out) && [...marks].some((m) => VOWEL[m])) letter = "'";

    out += letter;
    for (const m of marks) {
      if (VOWEL[m]) out += VOWEL[m];
      /* A sheva is sounded at the start of a word, and in the second of two in
         a row — לִכְבוֹד is Likhvod, but אִיסְטְנִיס is Istenis. Elsewhere it
         closes a syllable silently. */
      else if (m === SHEVA && (i === 0 || lastShevaSilent)) { out += "e"; sheva = "vocal"; }
      else if (m === SHEVA) sheva = "silent";
    }
    lastShevaSilent = sheva === "silent";
    sheva = null;
    i = j - 1;
  }
  out = out.replace(/([aeiou])\1+/g, "$1");
  return out ? out[0].toUpperCase() + out.slice(1) : "";
};

/* Vocalize a bare title from the book's own text, which often carries nikkud
   even when the catalogue's title line doesn't. */
const isBare = (w) => /[א-ת]{2}/.test(w) && !/[ְ-ּ]/.test(w);

function vocalizeFrom(title, body) {
  /* Some titles are only partly vocalized, so fill word by word rather than
     accepting the whole title on the strength of one nikkud mark. */
  if (!title.split(/\s+/).some(isBare)) return title;
  const forms = new Map();
  for (const w of body.split(/[^֐-׿]+/)) {
    if (!/[ְ-ּ]/.test(w)) continue;
    const bare = stripNikkud(w);
    if (bare.length > 1 && !forms.has(bare)) forms.set(bare, w);
  }
  const parts = title.split(/(\s+)/).map((t) => forms.get(stripNikkud(t).trim()) || t);
  const filled = parts.join("");
  /* a title is only worth showing if every word of it could be vocalized */
  return filled.split(/\s+/).some(isBare) ? null : filled;
}

const romanize = (title, body) => {
  const vocalized = vocalizeFrom(String(title || ""), body || "");
  if (!vocalized) return "";
  return String(vocalized).split(/\s+/).map(romanizeWord).filter(Boolean).join(" ");
};

/* ------------------------------------------------------------------ */
/* read the catalogue                                                  */
/* ------------------------------------------------------------------ */

/* The catalogue is real CSV: quoted fields contain commas. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.length === head.length).map((r) =>
    Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

if (!existsSync(join(DUMP, "pseudocatalogue.csv"))) {
  console.error(`No dump at ${DUMP}\nPass --dump <path to public_domain_dump clone>`);
  process.exit(1);
}

console.log(`reading catalogue from ${DUMP}`);
const catalogue = parseCsv(readFileSync(join(DUMP, "pseudocatalogue.csv"), "utf8"));
const version = existsSync(join(DUMP, "VERSION"))
  ? readFileSync(join(DUMP, "VERSION"), "utf8").trim() : "";
console.log(`  ${catalogue.length} works in dump ${version}`);

const textPath = (rec) => join(DUMP, "txt", `${rec.path}.txt`);

const candidates = catalogue.filter((r) => {
  const genre = GENRES[String(r.genre).replace("Translation missing: ", "")];
  return genre && r.path && r.authors && existsSync(textPath(r));
});
console.log(`  ${candidates.length} in readable genres`);

/* ------------------------------------------------------------------ */
/* rank the corpus vocabulary                                          */
/* ------------------------------------------------------------------ */
console.log(`ranking vocabulary over ${FREQ_SAMPLE} works…`);
const freq = new Map();
const stride = Math.max(1, Math.floor(candidates.length / FREQ_SAMPLE));
for (let i = 0; i < candidates.length; i += stride) {
  let raw = "";
  try { raw = readFileSync(textPath(candidates[i]), "utf8"); } catch (e) { continue; }
  for (const w of words(raw)) freq.set(w, (freq.get(w) || 0) + 1);
}
const common = new Set(
  [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, COMMON_WORDS).map(([w]) => w)
);
console.log(`  ${freq.size} distinct words; keeping the top ${common.size}`);

/* ------------------------------------------------------------------ */
/* score every candidate                                               */
/* ------------------------------------------------------------------ */
const cleanBody = (raw, title) => {
  const lines = raw.split("\n");
  /* the dump repeats the title as the first line and pads with stray tabs */
  if (lines.length && stripNikkud(lines[0]).trim() === stripNikkud(title).trim()) lines.shift();
  return lines
    .map((l) => l.replace(/\t+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

console.log("scoring candidates…");
const scored = [];
for (const rec of candidates) {
  let raw = "";
  try { raw = readFileSync(textPath(rec), "utf8"); } catch (e) { continue; }
  const body = cleanBody(raw, rec.title);
  if (body.length < MIN_CHARS || body.length > MAX_CHARS) continue;
  if (!HEB.test(body)) continue;

  const toks = words(body);
  if (toks.length < 300) continue;
  const known = toks.filter((w) => common.has(w)).length;
  const coverage = known / toks.length;

  const sentences = body.split(/[.!?…]+/).filter((s) => s.trim().length > 10);
  const avgSentence = sentences.length ? toks.length / sentences.length : 40;
  const variety = new Set(toks).size / toks.length;
  const nikkudRatio = (body.match(/[ְ-ּ]/g) || []).length / body.length;

  scored.push({
    id: rec.ID,
    title: rec.title.trim(),
    author: String(rec.authors).split(";")[0].trim(),
    authorQid: (String(rec.author_uris).match(/Q\d+/) || [])[0] || null,
    genre: GENRES[String(rec.genre).replace("Translation missing: ", "")],
    translated: !!String(rec.original_language).trim(),
    chars: body.length,
    words: toks.length,
    coverage,
    avgSentence,
    variety,
    nikkud: nikkudRatio > 0.06,
    body,
  });
}
console.log(`  ${scored.length} works scored`);

/* Readability: mostly how much of the text is built from common words, with a
   nudge for short sentences and for repeating vocabulary rather than
   scattering it. Vocalized text is easier to sound out, so it counts too. */
for (const w of scored) {
  w.score =
    w.coverage * 100 -
    Math.min(w.avgSentence, 60) * 0.35 -
    w.variety * 40 +
    (w.nikkud ? 4 : 0);
}

scored.sort((a, b) => b.score - a.score);
const cut = (p) => scored[Math.floor(scored.length * p)].score;
const bands = [cut(0.08), cut(0.28), cut(0.55), cut(0.8)];
const levelOf = (s) => (s >= bands[0] ? 1 : s >= bands[1] ? 2 : s >= bands[2] ? 3 : s >= bands[3] ? 4 : 5);
for (const w of scored) w.level = levelOf(w.score);

/* ------------------------------------------------------------------ */
/* pick a balanced shelf                                               */
/* ------------------------------------------------------------------ */
const perLevel = Math.ceil(TARGET / 5);
const byAuthor = new Map();
const picked = [];
for (const level of [1, 2, 3, 4, 5]) {
  let taken = 0;
  for (const w of scored) {
    if (w.level !== level || taken >= perLevel) continue;
    const seen = byAuthor.get(w.author) || 0;
    if (seen >= MAX_PER_AUTHOR) continue;
    byAuthor.set(w.author, seen + 1);
    picked.push(w);
    taken++;
  }
}
console.log(`selected ${picked.length} works by ${byAuthor.size} authors`);

/* ------------------------------------------------------------------ */
/* English author names                                                */
/* ------------------------------------------------------------------ */

/* The catalogue links most authors to Wikidata, which is the authority on
   how a name is spelled in English — better than romanizing "נחמן מברסלב"
   ourselves and landing somewhere no one searches for. Anyone without a
   Wikidata link falls back to romanization. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function englishAuthors(qids) {
  const out = new Map();
  for (let i = 0; i < qids.length; i += 45) {
    const batch = qids.slice(i, i + 45);
    const url = "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|descriptions&languages=en&ids=" + batch.join("|");
    /* Wikidata answers a burst of rebuilds with 429s, and a half-filled shelf
       would quietly ship Hebrew-only names — so back off and retry instead. */
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const r = await fetch(url, { headers: { "User-Agent": "Lavan Hebrew Reader shelf builder (github.com/quadrin/Hebrew_Reader)" } });
        if (r.status === 429 || r.status >= 500) {
          const wait = Number(r.headers.get("retry-after")) * 1000 || 2000 * 2 ** attempt;
          console.log(`  ${r.status} from Wikidata — waiting ${Math.round(wait / 1000)}s`);
          await sleep(wait);
          continue;
        }
        if (!r.ok) throw new Error(`wikidata ${r.status}`);
        const data = await r.json();
        for (const [qid, e] of Object.entries(data.entities || {})) {
          const label = e?.labels?.en?.value;
          if (label) out.set(qid, { name: label, note: e?.descriptions?.en?.value || "" });
        }
        break;
      } catch (e) {
        if (attempt === 4) console.warn(`  batch failed (${e.message}) — those authors show their Hebrew name only`);
        else await sleep(2000 * 2 ** attempt);
      }
    }
    await sleep(400);
  }
  return out;
}

/* No source in the dump describes what a work is about, and there is no
   translation to hand at build time, so the blurb is the book's own opening —
   which says more about its voice than a summary would anyway. */
function openingLines(body, limit = 165) {
  const firstProse = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 60 && /[א-ת]/.test(l));
  if (!firstProse) return "";
  if (firstProse.length <= limit) return firstProse;
  const sentences = firstProse.split(/(?<=[.!?…])\s+/);
  let out = "";
  for (const s of sentences) {
    if (out && (out + " " + s).length > limit) break;
    out = out ? out + " " + s : s;
    if (out.length >= limit) break;
  }
  if (!out) out = firstProse;
  return out.length > limit ? out.slice(0, limit).replace(/\s\S*$/, "") + "…" : out;
}

const qids = [...new Set(picked.map((w) => w.authorQid).filter(Boolean))];
console.log(`looking up ${qids.length} author names on Wikidata…`);
const enNames = await englishAuthors(qids);
console.log(`  ${enNames.size} resolved`);

/* ------------------------------------------------------------------ */
/* write it out                                                        */
/* ------------------------------------------------------------------ */
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const CREDIT = "Project Ben-Yehuda volunteers";
let bytes = 0;
const index = picked
  .sort((a, b) => a.level - b.level || b.score - a.score)
  .map((w) => {
    const file = `${w.id}.json`;
    const titleEn = romanize(w.title, w.body);
    const person = enNames.get(w.authorQid);
    const authorEn = person?.name || "";
    const authorNote = person?.note || "";
    const blurb = openingLines(w.body);
    const payload = JSON.stringify({
      id: w.id,
      title: w.title,
      titleEn,
      author: w.author,
      authorEn,
      text: w.body,
      src: {
        name: "Project Ben-Yehuda",
        license: "Public domain",
        credit: CREDIT,
        url: `https://benyehuda.org/read/${w.id}`,
      },
    });
    writeFileSync(join(OUT_DIR, file), payload);
    bytes += payload.length;
    return {
      id: w.id,
      title: w.title,
      titleEn,
      author: w.author,
      authorEn,
      authorNote,
      blurb,
      genre: w.genre,
      level: w.level,
      words: w.words,
      minutes: Math.max(1, Math.round(w.words / 110)),
      coverage: Math.round(w.coverage * 100),
      nikkud: w.nikkud,
      translated: w.translated,
    };
  });

writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify({
  version, credit: CREDIT, commonWords: COMMON_WORDS, books: index,
}));

const counts = index.reduce((m, b) => ({ ...m, [b.level]: (m[b.level] || 0) + 1 }), {});
console.log(`\nwrote ${index.length} books + index to public/shelf/ (${(bytes / 1e6).toFixed(2)} MB)`);
console.log("per level:", counts);
console.log("files:", readdirSync(OUT_DIR).length);
