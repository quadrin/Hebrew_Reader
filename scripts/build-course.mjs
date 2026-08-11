/* Builds the graded course in public/course/ from Project Ben-Yehuda's
   public-domain dump — the same corpus as the shelf, cut a different way.

   A textbook's real trick isn't its exercises, it's the ordering: you meet
   words in the order that unlocks the most text, and every reading is chosen so
   you can almost already read it. Both halves of that fall out of the corpus
   itself, so no textbook is needed and nothing here is copyrighted:

     · Rank every word in the corpus by frequency. Unit N introduces the next
       band of that ranking, so you always learn the word that buys the most.
     · For each unit, pick the passage best covered by everything introduced so
       far. Early units land on plain narrative; later ones reach literary prose
       without anyone hand-grading it.

   The course runs well past a beginner course: sixty units carrying ~2,300
   words, the last third drawn from the same literary vocabulary as the shelf's
   hardest books.

       npm run build:course -- --dump ../public_domain_dump

   With an API key it also glosses each unit's new words (cached in
   scripts/course-glosses.json, committed); without one the words ship bare and
   the reader's own tap-to-translate fills them in. */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { resolveProvider, makeAsker, askAll } from "./lib/ask.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "public", "course");
const GLOSS_CACHE = join(HERE, "course-glosses.json");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const DUMP = arg("dump", "/workspace/projectbenyehuda/public_domain_dump");
const FREQ_SAMPLE = 5000;      /* works read to rank vocabulary */
const PASSAGE_SAMPLE = 4000;   /* works split into candidate passages */
const TARGET_COVERAGE = 0.85;  /* a reading should be almost readable already */

/* The bands take this past a beginner course: the step grows, so later units
   cover ground fast and end in genuinely literary vocabulary.

   `words` is the length of that band's reading, and it matters as much as the
   vocabulary. Hebrew inflects heavily, so coverage by surface form climbs
   slowly — at 300 words known, no paragraph is readable, but a sentence often
   is. Readings therefore grow with the learner: a sentence at the start, a
   page by the end. Fixing the length at 150 words for every unit put unit 1 at
   28% coverage, which is a wall rather than a reading. */
const BANDS = [
  { units: 15, newWords: 25, level: 1, name: "Foundation", words: 14, spread: 8 },
  { units: 15, newWords: 35, level: 2, name: "Everyday", words: 45, spread: 20 },
  { units: 15, newWords: 50, level: 3, name: "Fluent reading", words: 110, spread: 40 },
  { units: 15, newWords: 75, level: 4, name: "Literary", words: 190, spread: 70 },
];
/* candidate spans are cut at these lengths so every band has material */
const SPAN_SIZES = [...new Set(BANDS.map((b) => b.words))];

const GENRES = {
  "he.prose": "prose", "he.fables": "fables", "he.poetry": "poetry",
  "he.memoir": "memoir", "he.article": "essay", "he.drama": "drama",
};

const stripNikkud = (s) => s.replace(/[֑-ׇ]/g, "");
const tokens = (s) => stripNikkud(s).split(/[^א-ת]+/).filter((w) => w.length > 1);

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.length === head.length)
    .map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

if (!existsSync(join(DUMP, "pseudocatalogue.csv"))) {
  console.error(`No dump at ${DUMP}\nPass --dump <path to public_domain_dump clone>`);
  process.exit(1);
}

console.log(`reading catalogue from ${DUMP}`);
const catalogue = parseCsv(readFileSync(join(DUMP, "pseudocatalogue.csv"), "utf8"));
const version = existsSync(join(DUMP, "VERSION"))
  ? readFileSync(join(DUMP, "VERSION"), "utf8").trim() : "";
const textPath = (rec) => join(DUMP, "txt", `${rec.path}.txt`);

const works = catalogue.filter((r) => {
  const g = GENRES[String(r.genre).replace("Translation missing: ", "")];
  return g && r.path && r.authors && existsSync(textPath(r));
});
console.log(`  ${works.length} works in readable genres`);

/* ------------------------------------------------------------------ */
/* 1. rank the vocabulary                                              */
/* ------------------------------------------------------------------ */
console.log(`ranking vocabulary over ${FREQ_SAMPLE} works…`);
const freq = new Map();
const stride = Math.max(1, Math.floor(works.length / FREQ_SAMPLE));
for (let i = 0; i < works.length; i += stride) {
  let raw = "";
  try { raw = readFileSync(textPath(works[i]), "utf8"); } catch (e) { continue; }
  for (const w of tokens(raw)) freq.set(w, (freq.get(w) || 0) + 1);
}
const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);
const rankOf = new Map(ranked.map((w, i) => [w, i]));
const UNKNOWN = 1e9;
console.log(`  ${ranked.length} distinct words ranked`);

/* ------------------------------------------------------------------ */
/* 2. cut the corpus into candidate passages                           */
/* ------------------------------------------------------------------ */

/* Each passage keeps its token ranks, sorted. Coverage by any vocabulary size
   is then "how many ranks fall below this threshold" — a binary search, so
   scoring every passage against every unit stays cheap. */
const countBelow = (sortedRanks, threshold) => {
  let lo = 0, hi = sortedRanks.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedRanks[mid] < threshold) lo = mid + 1; else hi = mid;
  }
  return lo;
};

console.log(`cutting ${PASSAGE_SAMPLE} works into spans of ${SPAN_SIZES.join(", ")} words…`);
const passages = [];
const pStride = Math.max(1, Math.floor(works.length / PASSAGE_SAMPLE));
for (let i = 0; i < works.length; i += pStride) {
  const rec = works[i];
  let raw = "";
  try { raw = readFileSync(textPath(rec), "utf8"); } catch (e) { continue; }
  const lines = raw.split("\n").map((l) => l.replace(/\t+/g, " ").trim()).filter(Boolean);
  if (lines.length && stripNikkud(lines[0]) === stripNikkud(rec.title.trim())) lines.shift();

  /* Sentences are the unit a span is built from, so a reading never starts or
     ends mid-thought however short it is. */
  const sentences = [];
  for (const line of lines) {
    for (const s of line.split(/(?<=[.!?…:])\s+/)) {
      const t = s.trim();
      if (t && tokens(t).length) sentences.push(t);
    }
  }

  const meta = {
    workId: rec.ID,
    title: rec.title.trim(),
    author: String(rec.authors).split(";")[0].trim(),
    genre: GENRES[String(rec.genre).replace("Translation missing: ", "")],
  };
  for (const size of SPAN_SIZES) {
    let buf = [], count = 0;
    const flush = () => {
      if (count >= size * 0.6 && buf.length) {
        const text = buf.join(" ");
        const ranks = tokens(text).map((w) => rankOf.get(w) ?? UNKNOWN);
        passages.push({ ...meta, text, ranks: Int32Array.from(ranks).sort(), n: ranks.length });
      }
      buf = []; count = 0;
    };
    for (const s of sentences) {
      buf.push(s);
      count += tokens(s).length;
      if (count >= size) flush();
    }
    flush();
  }
}
console.log(`  ${passages.length} candidate spans`);

/* ------------------------------------------------------------------ */
/* 3. lay out the units                                                */
/* ------------------------------------------------------------------ */
const units = [];
let cumulative = 0;
for (const band of BANDS) {
  for (let i = 0; i < band.units; i++) {
    const from = cumulative;
    cumulative += band.newWords;
    units.push({
      n: units.length + 1,
      level: band.level,
      levelName: band.name,
      newWords: ranked.slice(from, cumulative),
      knownAfter: cumulative,
      minWords: Math.max(6, band.words - band.spread),
      maxWords: band.words + band.spread,
    });
  }
}
console.log(`laying out ${units.length} units up to ${cumulative} words`);

/* Pick each unit's reading: comfortably readable with what's been taught, and
   ideally exercising the words just introduced. One work is used once, so the
   course reads widely rather than marching through a single book. */
const usedWork = new Set();
for (const unit of units) {
  const T = unit.knownAfter;
  const newFrom = T - unit.newWords.length;
  const fits = (p) => !usedWork.has(p.workId) && p.n >= unit.minWords && p.n <= unit.maxWords;

  let best = null, bestScore = -1;
  for (const p of passages) {
    if (!fits(p)) continue;
    const coverage = countBelow(p.ranks, T) / p.n;
    if (coverage < TARGET_COVERAGE) continue;
    /* how much of this unit's new vocabulary the passage actually practises */
    const fresh = countBelow(p.ranks, T) - countBelow(p.ranks, newFrom);
    const score = fresh * 1000 + coverage * 100;
    if (score > bestScore) { bestScore = score; best = { p, coverage, fresh }; }
  }
  if (!best) {
    /* nothing clears the bar — fall back to the most readable span of the right
       length, so a unit always has something to read */
    for (const p of passages) {
      if (!fits(p)) continue;
      const coverage = countBelow(p.ranks, T) / p.n;
      if (coverage > bestScore) { bestScore = coverage; best = { p, coverage, fresh: 0 }; }
    }
  }
  if (!best) continue;
  usedWork.add(best.p.workId);
  unit.reading = {
    workId: best.p.workId,
    title: best.p.title,
    author: best.p.author,
    genre: best.p.genre,
    text: best.p.text,
    words: best.p.n,
    coverage: Math.round(best.coverage * 100),
    practises: best.fresh,
  };
}
const placed = units.filter((u) => u.reading).length;
console.log(`  ${placed}/${units.length} units matched to a reading`);

/* ------------------------------------------------------------------ */
/* 4. gloss the new words                                              */
/* ------------------------------------------------------------------ */
const GLOSS_SCHEMA = {
  type: "object",
  properties: {
    words: {
      type: "array",
      items: {
        type: "object",
        properties: {
          he: { type: "string", description: "the Hebrew word, exactly as given" },
          en: { type: "string", description: "its everyday English meaning, two or three words at most" },
          pos: { type: "string", description: "part of speech: noun, verb, adjective, adverb, preposition, pronoun, conjunction, particle, or other" },
        },
        required: ["he", "en", "pos"],
        additionalProperties: false,
      },
    },
  },
  required: ["words"],
  additionalProperties: false,
};

const { provider, key, model } = resolveProvider({
  provider: arg("provider"), apiKey: arg("api-key"), model: arg("model"),
});
const ask = key ? await makeAsker({
  provider, key, model, schema: GLOSS_SCHEMA,
  system:
    "You gloss Hebrew vocabulary for a reading course. Give the word's most common everyday " +
    "meaning in modern Hebrew, not an archaic or rare sense. Keep glosses to two or three words. " +
    "Return every word you are given, in the order given.",
}) : null;
if (key) console.log(`glossing with ${model} (${provider})`);

const glosses = await askAll({
  jobs: units.map((u) => ({
    id: `unit-${u.n}`,
    prompt: `Gloss these ${u.newWords.length} Hebrew words:\n${u.newWords.join("\n")}`,
  })),
  cachePath: GLOSS_CACHE,
  ask,
  concurrency: Number(arg("concurrency", 4)),
  maxTokens: 4000,
  label: "unit glosses",
});

/* ------------------------------------------------------------------ */
/* 5. write it out                                                     */
/* ------------------------------------------------------------------ */
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const CREDIT = "Project Ben-Yehuda volunteers";
let bytes = 0;
const index = units.filter((u) => u.reading).map((u) => {
  const glossed = glosses[`unit-${u.n}`]?.words || [];
  const byWord = new Map(glossed.map((g) => [g.he, g]));
  const words = u.newWords.map((he) => ({
    he,
    en: byWord.get(he)?.en || "",
    pos: byWord.get(he)?.pos || "",
  }));

  const payload = JSON.stringify({
    n: u.n,
    level: u.level,
    levelName: u.levelName,
    knownAfter: u.knownAfter,
    words,
    reading: u.reading,
    src: {
      name: "Project Ben-Yehuda",
      license: "Public domain",
      credit: CREDIT,
      url: `https://benyehuda.org/read/${u.reading.workId}`,
    },
  });
  writeFileSync(join(OUT_DIR, `unit-${u.n}.json`), payload);
  bytes += payload.length;

  return {
    n: u.n,
    level: u.level,
    levelName: u.levelName,
    newWords: u.newWords.length,
    knownAfter: u.knownAfter,
    glossed: words.filter((w) => w.en).length,
    coverage: u.reading.coverage,
    readingWords: u.reading.words,
    minutes: Math.max(1, Math.round(u.reading.words / 110)),
    title: u.reading.title,
    author: u.reading.author,
    genre: u.reading.genre,
  };
});

writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify({
  version, credit: CREDIT, units: index,
  vocabulary: cumulative,
  levels: BANDS.map((b) => ({ level: b.level, name: b.name })),
}));

console.log(`\nwrote ${index.length} units to public/course/ (${(bytes / 1e6).toFixed(2)} MB)`);
console.log("per level:", BANDS.map((b) => `${b.name} ${index.filter((u) => u.level === b.level).length}`).join(", "));
console.log(`vocabulary taught: ${cumulative} words`);
console.log(`mean reading coverage: ${Math.round(index.reduce((s, u) => s + u.coverage, 0) / index.length)}%`);
console.log("files:", readdirSync(OUT_DIR).length);
