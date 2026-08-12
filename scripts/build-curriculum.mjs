/* Builds public/curriculum/ from the hand-authored syllabus.

   The syllabus holds the teaching — what each lesson explains, in what order,
   with which words. This turns that into something you can practise: every
   table becomes questions, every vocabulary list becomes four kinds of drill,
   every verb table becomes a conjugation quiz. Authoring stays small and
   checkable; the exercise count stays high.

       npm run build:curriculum

   No API key, no dump, no network — the syllabus is the only input, so the
   output is reproducible and the diff is readable. */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { LETTERS, FINALS, VOWELS, VAV_VOWELS, DAGESH, SIN_SHIN } from "./curriculum/alphabet.mjs";
import { BINYANIM, PASSIVES, WEAK_ROOTS, PERSONS, PRESENT_FORMS } from "./curriculum/verbs.mjs";
import L1 from "./curriculum/lessons-1.mjs";
import L2 from "./curriculum/lessons-2.mjs";
import L3 from "./curriculum/lessons-3.mjs";
import L4 from "./curriculum/lessons-4.mjs";
import L5 from "./curriculum/lessons-5.mjs";
import L6 from "./curriculum/lessons-6.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "curriculum");
const COURSE = join(HERE, "..", "public", "course", "index.json");

const LEVELS = [L1, L2, L3, L4, L5, L6];

/* Seeded so a rebuild produces the same file: an exercise order that churns on
   every build makes the diff useless and the cache miss. */
let seed = 20260812;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const shuffle = (a) => {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const sample = (a, n) => shuffle(a).slice(0, n);

/* Builds a multiple-choice item and reports which slot the answer landed in */
function choice(q, answer, wrong, extra = {}) {
  const opts = shuffle([answer, ...wrong.slice(0, 3)]);
  return { type: "choice", q, options: opts, correct: opts.indexOf(answer), ...extra };
}

const byId = (id) => LETTERS.find((x) => x.l === id);

/* ------------------------------------------------------------------ */
/* drill generators                                                    */
/* ------------------------------------------------------------------ */

/* Letters: name it, and pick it out of the letters it's confused with */
function lettersDrill(ids) {
  const set = ids.map(byId).filter(Boolean);
  const out = [];
  for (const x of set) {
    out.push(choice(`Which letter is ${x.en}?`, x.l,
      sample(LETTERS.filter((y) => y.l !== x.l).map((y) => y.l), 3),
      { he: true }));
    out.push(choice(`What is this letter called?`, x.en,
      sample(LETTERS.filter((y) => y.l !== x.l).map((y) => y.en), 3),
      { prompt: x.l }));
  }
  return out;
}

/* The pairs a beginner actually loses time on */
function confuseDrill(pairs) {
  return pairs.map(([a, b]) => {
    const A = byId(a), B = byId(b);
    return choice(`Which one is ${A.en}?`, A.l, [B.l], { he: true, why: `${A.l} is ${A.en}; ${B.l} is ${B.en}.` });
  });
}

function finalsDrill() {
  return FINALS.map((f) =>
    choice(`${f.final} at the end of a word is which letter?`, f.l,
      FINALS.filter((g) => g.l !== f.l).map((g) => g.l), { he: true }));
}

function vowelsDrill(ids) {
  const set = VOWELS.filter((v) => ids.includes(v.sign));
  return set.flatMap((v) => [
    choice("What sound does this vowel make?", v.sound,
      VOWELS.filter((w) => w.sound !== v.sound).map((w) => w.sound), { prompt: v.on }),
    choice(`Which mark is ${v.en}?`, v.on,
      VOWELS.filter((w) => w.en !== v.en).map((w) => w.on), { he: true }),
  ]);
}

function dageshDrill() {
  return DAGESH.map((d) =>
    choice(`${d.hard} — with the dot — sounds like?`, d.sound.split(" becomes ")[1],
      DAGESH.filter((e) => e !== d).map((e) => e.sound.split(" becomes ")[1]).concat(["ch as in Bach"]),
      { prompt: d.hard }))
    .concat(SIN_SHIN.map((s) =>
      choice(`Where is the dot in ${s.en}?`, s.sound.split(" — ")[1],
        SIN_SHIN.filter((t) => t !== s).map((t) => t.sound.split(" — ")[1]).concat(["under the letter", "there is no dot"]),
        { prompt: s.l })));
}

/* Vocabulary: recognise it, produce it, hear it, and match a set at once */
function vocabDrills(vocab, all) {
  const pool = all.filter((w) => !vocab.includes(w));
  const wrongEn = (w) => sample(vocab.concat(pool).filter((x) => x.en !== w.en).map((x) => x.en), 3);
  const wrongHe = (w) => sample(vocab.concat(pool).filter((x) => x.he !== w.he).map((x) => x.he), 3);
  const out = [];
  for (const w of vocab) {
    out.push(choice(`What does this mean?`, w.en, wrongEn(w), { prompt: w.he, translit: w.translit }));
  }
  for (const w of sample(vocab, Math.min(4, vocab.length))) {
    out.push(choice(`How do you say “${w.en}”?`, w.he, wrongHe(w), { he: true }));
  }
  if (vocab.length >= 4) {
    out.push({ type: "match", pairs: sample(vocab, Math.min(5, vocab.length)).map((w) => [w.he, w.en]) });
  }
  return out;
}

function listenDrills(vocab) {
  return sample(vocab, Math.min(3, vocab.length)).map((w) =>
    choice("Which word did you hear?", w.he,
      sample(vocab.filter((x) => x.he !== w.he).map((x) => x.he), 3),
      { type: "listen", say: w.he, he: true }))
    .map((x) => ({ ...x, type: "listen", say: x.say }));
}

/* Sounding out: shown vocalized, self-checked against the transliteration */
function readDrills(vocab) {
  return sample(vocab.filter((w) => w.translit), Math.min(4, vocab.length))
    .map((w) => ({ type: "read", he: w.he, translit: w.translit, en: w.en }));
}

function typeDrills(vocab) {
  return sample(vocab, Math.min(2, vocab.length))
    .map((w) => ({ type: "type", q: `Write “${w.en}” in Hebrew`, answer: w.he, hint: w.translit }));
}

/* Any table in the lesson becomes questions: given the left cell, pick the
   right one. Cells written "Hebrew — gloss" are split so the question shows
   the gloss and the options stay Hebrew. */
const cellHe = (s) => String(s).split(" — ")[0].trim();
const cellEn = (s) => (String(s).split(" — ")[1] || "").trim();

function tableDrills(sections, limit = 4) {
  const out = [];
  for (const s of sections) {
    if (s.type !== "table" || !s.rows?.length || s.head.length < 2) continue;
    const col = s.head.length - 1;      /* quiz the last column against the first */
    const rows = s.rows.filter((r) => cellHe(r[col]) && cellHe(r[0]));
    if (rows.length < 3) continue;
    for (const r of sample(rows, Math.min(limit, rows.length))) {
      const answer = cellHe(r[col]);
      const wrong = rows.filter((x) => cellHe(x[col]) !== answer).map((x) => cellHe(x[col]));
      const asked = cellEn(r[0]) || cellHe(r[0]);
      out.push(choice(
        s.head[0] ? `${s.caption || "Which form"} — ${asked}?` : `${asked}?`,
        answer, wrong, { he: /[֐-׿]/.test(answer) },
      ));
    }
  }
  return out;
}

/* Verb tables: every cell is a question and the neighbouring cells are
   distractors that are wrong in an instructive way. */
function conjugateDrills(spec) {
  const [, id, tense] = spec.split(":");
  const b = BINYANIM.find((x) => x.id === id);
  if (!b || !b[tense]) return [];
  const table = b[tense];
  const keys = Object.keys(table);
  const label = (k) => (tense === "present"
    ? PRESENT_FORMS.find((p) => p.id === k)?.en
    : PERSONS.find((p) => p.id === k)?.en);
  return sample(keys, Math.min(5, keys.length)).map((k) =>
    choice(`${b.verb.en.replace(/^to /, "")} — ${label(k)}, ${tense}`,
      table[k],
      keys.filter((j) => table[j] !== table[k]).map((j) => table[j]),
      { he: true, why: `${b.he}, ${tense}: ${label(k)} is ${table[k]}.` }));
}

/* Which pattern is this verb in? The shapes are the whole point of the
   binyan system, so the question is asked from the shape alone. */
function binyanIdDrill() {
  const all = BINYANIM.map((b) => ({ he: b.present.ms, id: b.he, en: b.en }));
  return sample(all, 4).map((v) =>
    choice("Which binyan is this verb in?", v.id,
      all.filter((x) => x.id !== v.id).map((x) => x.id),
      { prompt: v.he }));
}

/* Tap the words into order. Hebrew reads right to left, so the player lays
   the tray out that way too. */
function buildDrills(sections) {
  const ex = sections.filter((s) => s.type === "examples").flatMap((s) => s.items);
  return sample(ex.filter((e) => e.he.split(/\s+/).length >= 3 && e.he.split(/\s+/).length <= 7), 2)
    .map((e) => ({ type: "build", tokens: shuffle(e.he.replace(/[.?!]$/, "").split(/\s+/)), answer: e.he.replace(/[.?!]$/, "").split(/\s+/), en: e.en }));
}

function genderDrill(vocab) {
  const withG = vocab.filter((w) => w.g);
  return withG.map((w) => choice(`Is ${w.en} masculine or feminine?`,
    w.g === "m" ? "masculine" : "feminine", [w.g === "m" ? "feminine" : "masculine"],
    { prompt: w.he }));
}

function weakDrill() {
  return WEAK_ROOTS.flatMap((r) =>
    sample(r.forms, 2).map((f) =>
      choice(`${r.verb.en.replace(/^to /, "")} (${r.he}) — ${f.label}`, f.he,
        WEAK_ROOTS.flatMap((q) => q.forms).filter((g) => g.he !== f.he).map((g) => g.he),
        { he: true, why: r.why })));
}

/* ------------------------------------------------------------------ */
/* assemble                                                            */
/* ------------------------------------------------------------------ */

/* Sections that only name a data set are expanded here, so the player never
   has to know what a binyan or a vowel is — it just renders what it's given. */
function expandSections(sections) {
  return sections.map((s) => {
    if (s.type === "letters") return { ...s, items: s.ids.map(byId).filter(Boolean) };
    if (s.type === "vowels") return { ...s, items: VOWELS.filter((v) => s.ids.includes(v.sign)) };
    if (s.type === "vavvowels") return { ...s, items: VAV_VOWELS };
    if (s.type === "finals") return { ...s, items: FINALS };
    if (s.type === "dagesh") return { ...s, items: DAGESH };
    if (s.type === "sinshin") return { ...s, items: SIN_SHIN };
    if (s.type === "confuse") return { ...s, items: s.pairs.map(([a, b]) => [byId(a), byId(b)]) };
    if (s.type === "passives") return { ...s, items: PASSIVES };
    if (s.type === "weak") return { ...s, item: WEAK_ROOTS.find((w) => w.id === s.id) };
    if (s.type === "binyan") {
      const b = BINYANIM.find((x) => x.id === s.id);
      const labels = s.tense === "present" ? PRESENT_FORMS : PERSONS;
      return {
        type: "binyan", he: b.he, en: b.en, note: b.note, verb: b.verb, tense: s.tense,
        rows: labels.filter((p) => b[s.tense]?.[p.id])
          .map((p) => ({ label: p.en, he: p.he || "", form: b[s.tense][p.id] })),
      };
    }
    return s;
  });
}

function buildExercises(lesson, allVocab) {
  const out = [];
  const v = lesson.vocab || [];
  for (const d of lesson.drills || []) {
    if (d === "letters") out.push(...lettersDrill(lesson.sections.find((s) => s.type === "letters")?.ids || []));
    else if (d === "confuse") out.push(...confuseDrill(lesson.sections.find((s) => s.type === "confuse")?.pairs || []));
    else if (d === "finals") out.push(...finalsDrill());
    else if (d === "vowels") out.push(...vowelsDrill(lesson.sections.find((s) => s.type === "vowels")?.ids || []));
    else if (d === "dagesh") out.push(...dageshDrill());
    else if (d === "vocab") out.push(...vocabDrills(v, allVocab));
    else if (d === "listen") out.push(...listenDrills(v));
    else if (d === "read") out.push(...readDrills(v));
    else if (d === "type") out.push(...typeDrills(v));
    else if (d === "gender") out.push(...genderDrill(v));
    else if (d === "build") out.push(...buildDrills(lesson.sections));
    else if (d === "binyan-id") out.push(...binyanIdDrill());
    else if (d === "weak") out.push(...weakDrill());
    else if (d.startsWith("conjugate:")) out.push(...conjugateDrills(d));
    else out.push(...tableDrills(lesson.sections));  /* plural, agree, et, register … */
  }
  out.push(...(lesson.extra || []).map((e) => ({ ...e })));

  /* Every lesson with words gets at least one of each of the harder kinds:
     hearing it, sounding it out, and producing it from nothing. Multiple
     choice alone lets you pass a lesson by elimination. */
  const has = (t) => out.some((e) => e.type === t);
  if (v.length) {
    if (!has("listen")) out.push(...listenDrills(v).slice(0, 1));
    if (!has("read")) out.push(...readDrills(v).slice(0, 1));
    if (!has("type")) out.push(...typeDrills(v).slice(0, 1));
  }

  /* Recognition first so a word is seen before it's tested in context, the
     rest in a fixed shuffle, and the productive ones last. */
  const first = out.filter((e) => e.prompt && e.type === "choice");
  const last = out.filter((e) => e.type === "type" || e.type === "build");
  const rest = out.filter((e) => !first.includes(e) && !last.includes(e));
  return [...first.slice(0, 7), ...shuffle(rest), ...last].slice(0, 16);
}

/* Readings from the app's own graded shelf: at the end of a level, something
   real to read at roughly the right difficulty. */
function readingsFor(level) {
  if (!existsSync(COURSE)) return [];
  const band = { 2: 1, 3: 1, 4: 2, 5: 3, 6: 4 }[level];
  if (!band) return [];
  const units = JSON.parse(readFileSync(COURSE, "utf8")).units.filter((u) => u.level === band);
  return sample(units, Math.min(3, units.length)).map((u) => ({
    n: u.n, title: u.title, titleEn: u.titleEn || "", author: u.author, authorEn: u.authorEn || "",
    coverage: u.coverage, minutes: u.minutes,
  }));
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });

const allVocab = LEVELS.flatMap((l) => l.lessons.flatMap((x) => x.vocab || []));
const index = { version: 1, levels: [] };
let exCount = 0, vocabCount = 0;

for (const lv of LEVELS) {
  const lessons = lv.lessons.map((lesson, i) => {
    const sections = expandSections(lesson.sections || []);
    const exercises = buildExercises({ ...lesson, sections: lesson.sections }, allVocab);
    exCount += exercises.length;
    vocabCount += (lesson.vocab || []).length;
    writeFileSync(join(OUT, `lesson-${lesson.id}.json`), JSON.stringify({
      id: lesson.id, level: lv.level, levelName: lv.name,
      n: i + 1, of: lv.lessons.length,
      title: lesson.title, titleHe: lesson.titleHe, goal: lesson.goal,
      sections, vocab: lesson.vocab || [], exercises,
    }));
    return {
      id: lesson.id, n: i + 1, title: lesson.title, titleHe: lesson.titleHe, goal: lesson.goal,
      words: (lesson.vocab || []).length, exercises: exercises.length,
      minutes: Math.max(3, Math.round(((lesson.vocab || []).length * 0.4 + exercises.length * 0.35))),
    };
  });
  index.levels.push({
    level: lv.level, name: lv.name, nameHe: lv.nameHe, blurb: lv.blurb,
    lessons, readings: readingsFor(lv.level),
  });
}

writeFileSync(join(OUT, "index.json"), JSON.stringify(index));

const lessonCount = index.levels.reduce((s, l) => s + l.lessons.length, 0);
console.log(`wrote ${lessonCount} lessons across ${index.levels.length} levels to public/curriculum/`);
console.log(`  ${vocabCount} vocabulary items, ${exCount} exercises`);
console.log(`  files: ${readdirSync(OUT).length}, ${(readdirSync(OUT).reduce((s, f) => s + readFileSync(join(OUT, f)).length, 0) / 1024).toFixed(0)} KB`);
for (const l of index.levels) {
  console.log(`  ${l.level}. ${l.name}: ${l.lessons.length} lessons, ${l.lessons.reduce((s, x) => s + x.exercises, 0)} exercises`);
}
