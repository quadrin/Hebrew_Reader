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
    const payload = JSON.stringify({
      id: w.id,
      title: w.title,
      author: w.author,
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
      author: w.author,
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
