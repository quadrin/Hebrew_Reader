/* Adds English names and titles to the generated course in public/course/.

   The course lists sixty readings by their Hebrew title and author, which is
   no help at all to someone who can't yet read Hebrew — the exact person the
   course is for. Two sources fix that, and this script uses both:

     · authors  — from public/browse/authors.json, which already carries the
                  English name Wikidata gives each writer. Keyless, exact, and
                  it covers most of the course.
     · titles   — from the AI provider, the same way the shelf's titles are
                  translated. Needs a key; without one the titles stay Hebrew
                  and the app translates them in the browser instead.

       npm run build:course:english

   Idempotent: re-running only fills in what's missing, so it is safe to run
   after regenerating the course, and safe to run again once you have a key. */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { resolveProvider, makeAsker, askAll } from "./lib/ask.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const COURSE = join(HERE, "..", "public", "course");
const AUTHORS = join(HERE, "..", "public", "browse", "authors.json");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

if (!existsSync(join(COURSE, "index.json"))) {
  console.error("No course in public/course — run npm run build:course first");
  process.exit(1);
}

const index = JSON.parse(readFileSync(join(COURSE, "index.json"), "utf8"));
const units = index.units.map((u) => u.n);
console.log(`course: ${units.length} units`);

/* ------------------------------------------------------------------ */
/* author names — keyless                                              */
/* ------------------------------------------------------------------ */
const nameEn = new Map();
if (existsSync(AUTHORS)) {
  for (const a of JSON.parse(readFileSync(AUTHORS, "utf8")).authors) {
    if (a.nameEn) nameEn.set(a.name, a.nameEn);
  }
  console.log(`  ${nameEn.size} writers named in English in the directory`);
} else {
  console.log("  no public/browse/authors.json — run npm run build:authors for English names");
}

/* ------------------------------------------------------------------ */
/* titles — needs a key                                                */
/* ------------------------------------------------------------------ */
const SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "The work's title in natural English. Where it is known in English under an "
        + "established title, use that title. Otherwise translate the meaning plainly. Never "
        + "transliterate, never explain, never name the author. Under about eight words.",
    },
  },
  required: ["title"],
  additionalProperties: false,
};

const { provider, key, model } = resolveProvider({
  provider: arg("provider"), apiKey: arg("api-key"), model: arg("model"),
});
const ask = key ? await makeAsker({
  provider, key, model, schema: SCHEMA,
  system: "You give the English titles of public-domain Hebrew literary works for a reading app "
    + "used by learners of Hebrew. The register may be biblical, rabbinic or archaic; render it in "
    + "ordinary modern English.",
}) : null;
if (key) console.log(`English titles: using ${model} (${provider})`);

/* Keyed by the Hebrew title rather than the unit number, so a course rebuild
   that reshuffles which passage lands in which unit still hits the cache. */
const answers = await askAll({
  jobs: [...new Set(index.units.map((u) => u.title).filter(Boolean))].map((t) => {
    const u = index.units.find((x) => x.title === t);
    return { id: t, prompt: `Hebrew title: ${t}\nAuthor: ${u.authorEn || nameEn.get(u.author) || u.author}\nGenre: ${u.genre}` };
  }),
  cachePath: join(HERE, "course-titles.json"),
  ask,
  concurrency: Number(arg("concurrency", 4)),
  maxTokens: 600,
  label: "English titles",
});

const titleEn = new Map();
for (const [he, value] of Object.entries(answers)) {
  const en = value?.title && String(value.title).trim();
  if (en) titleEn.set(he, en);
}

/* ------------------------------------------------------------------ */
/* write it back                                                       */
/* ------------------------------------------------------------------ */
const fill = (obj) => {
  if (obj.author && !obj.authorEn && nameEn.has(obj.author)) obj.authorEn = nameEn.get(obj.author);
  if (obj.title && !obj.titleEn && titleEn.has(obj.title)) obj.titleEn = titleEn.get(obj.title);
  return obj;
};

index.units.forEach(fill);
writeFileSync(join(COURSE, "index.json"), JSON.stringify(index));

for (const n of units) {
  const file = join(COURSE, `unit-${n}.json`);
  const unit = JSON.parse(readFileSync(file, "utf8"));
  if (unit.reading) fill(unit.reading);
  writeFileSync(file, JSON.stringify(unit));
}

const named = index.units.filter((u) => u.authorEn).length;
const titled = index.units.filter((u) => u.titleEn).length;
console.log(`\nwrote ${units.length} units`);
console.log(`  authors in English: ${named}/${units.length}`);
console.log(`  titles in English:  ${titled}/${units.length}`);
