/* Builds the Ben-Yehuda browse directory in public/browse/ from the
   public-domain dump's catalogue.

   The Ben-Yehuda tab used to be a bare search box, which is only useful if you
   already know what you're looking for. Its API can fetch any work by id, but
   its search filters aren't documented, so browsing had nothing to stand on.

   The dump's catalogue solves that offline: it lists every author and every
   work with its id. Ship that as a directory and the tab can browse without
   the API at all — pick an author, see their works, and only then fetch the
   one you chose by id. Metadata only; no text ships here.

       npm run build:authors -- --dump ../public_domain_dump

   With an API key it also translates author descriptions; without one the
   directory still builds. */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { englishAuthors } from "./lib/wikidata.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "public", "browse");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const DUMP = arg("dump", "/workspace/projectbenyehuda/public_domain_dump");
const MIN_WORKS = Number(arg("min-works", 3)); /* authors with fewer are noise */
/* Uncapped by default. A cap keeps the files small, but the writers it would
   bite are Bialik, Halevi, Tchernichovsky — exactly the ones somebody is
   looking for a particular poem by. The largest file it costs us is a few
   hundred KB of titles, which gzips down and is fetched only if that writer is
   opened. Pass --max-works to cap anyway; the UI then says what it's hiding. */
const MAX_WORKS = Number(arg("max-works", 0)) || Infinity;

const GENRES = {
  "he.prose": "prose", "he.fables": "fables", "he.poetry": "poetry",
  "he.memoir": "memoir", "he.article": "essay", "he.drama": "drama",
  "he.letters": "letters", "he.reference": "reference", "he.lexicon": "lexicon",
};

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
console.log(`  ${catalogue.length} works`);

/* ------------------------------------------------------------------ */
/* group works by author                                               */
/* ------------------------------------------------------------------ */
const byAuthor = new Map();
for (const rec of catalogue) {
  const author = String(rec.authors || "").split(";")[0].trim();
  if (!author || !rec.ID || !rec.title) continue;
  const genre = GENRES[String(rec.genre).replace("Translation missing: ", "")] || "";
  if (!byAuthor.has(author)) {
    byAuthor.set(author, {
      name: author,
      qid: (String(rec.author_uris).match(/Q\d+/) || [])[0] || null,
      works: [],
    });
  }
  const a = byAuthor.get(author);
  if (!a.qid) a.qid = (String(rec.author_uris).match(/Q\d+/) || [])[0] || null;
  a.works.push({
    id: rec.ID,
    title: rec.title.trim(),
    genre,
    translated: !!String(rec.original_language).trim(),
  });
}

const authors = [...byAuthor.values()]
  .filter((a) => a.works.length >= MIN_WORKS)
  .sort((a, b) => b.works.length - a.works.length);
console.log(`  ${authors.length} authors with ${MIN_WORKS}+ works`);

/* ------------------------------------------------------------------ */
/* English names                                                       */
/* ------------------------------------------------------------------ */
const qids = [...new Set(authors.map((a) => a.qid).filter(Boolean))];
console.log(`looking up ${qids.length} author names on Wikidata…`);
const enNames = await englishAuthors(qids);
console.log(`  ${enNames.size} resolved`);

/* ------------------------------------------------------------------ */
/* write it out                                                        */
/* ------------------------------------------------------------------ */
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

let bytes = 0;
const index = authors.map((a, i) => {
  const person = enNames.get(a.qid);
  /* Newest-looking first is meaningless here, so order a writer's works the way
     a shelf would: by genre, then alphabetically. */
  const works = a.works
    .slice()
    .sort((x, y) => (x.genre || "").localeCompare(y.genre || "") || x.title.localeCompare(y.title, "he"))
    .slice(0, MAX_WORKS);

  const payload = JSON.stringify({
    i,
    name: a.name,
    nameEn: person?.name || "",
    note: person?.note || "",
    total: a.works.length, /* differs from works.length only under --max-works */
    works,
    src: {
      name: "Project Ben-Yehuda",
      license: "Public domain",
      credit: "Project Ben-Yehuda volunteers",
      url: "https://benyehuda.org/",
    },
  });
  writeFileSync(join(OUT_DIR, `author-${i}.json`), payload);
  bytes += payload.length;

  const genres = [...new Set(works.map((w) => w.genre).filter(Boolean))];
  /* Genres in descending order of how much of the writer's shelf they are, so
     the chips name what they're actually known for first. */
  const weight = new Map();
  for (const w of works) if (w.genre) weight.set(w.genre, (weight.get(w.genre) || 0) + 1);
  genres.sort((x, y) => weight.get(y) - weight.get(x));
  return {
    i,
    name: a.name,
    nameEn: person?.name || "",
    note: person?.note || "",
    works: works.length,
    genres,
  };
});

writeFileSync(join(OUT_DIR, "authors.json"), JSON.stringify({
  version,
  credit: "Project Ben-Yehuda volunteers",
  authors: index,
}));

const idxBytes = readFileSync(join(OUT_DIR, "authors.json")).length;
console.log(`\nwrote ${index.length} authors to public/browse/`);
console.log(`  index ${(idxBytes / 1024).toFixed(0)} KB, per-author files ${(bytes / 1e6).toFixed(2)} MB total`);
console.log(`  named in English: ${index.filter((a) => a.nameEn).length}/${index.length}`);
console.log(`  works listed: ${index.reduce((s, a) => s + a.works, 0)}`);
console.log("files:", readdirSync(OUT_DIR).length);
