/* build-duo.mjs — turn the scraped Duolingo Hebrew bundle into the data the
   path runs on.

   In:  data/duolingo-hebrew-tree/  (CSVs + Tips & Notes + 84 unit guidebooks)
   Out: public/duo/course.json      (sections, units, every node on the path)
        public/duo/unit-NNN.json    (phrases with word-level hints, vocabulary,
                                     the unit's grammar notes)

   The guidebooks are the valuable part: each key phrase carries the Hebrew, the
   English, a CDN audio URL, and a hint table for every word in it. That hint
   table is what makes real exercises possible — it is where the word banks,
   the distractors and the tap-hints all come from.

   Run: npm run build:duo
*/

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data", "duolingo-hebrew-tree");
const OUT = path.join(ROOT, "public", "duo");

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */
function readCsv(file) {
  const text = fs.readFileSync(path.join(DATA, file), "utf8").replace(/^﻿/, "");
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    if (c === "\r") continue;
    field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const num = (v) => (v === "" || v == null ? 0 : Number(v));
const bool = (v) => String(v).toLowerCase() === "true";

/* ------------------------------------------------------------------ */
/* Tips & Notes                                                        */
/* ------------------------------------------------------------------ */
/* One markdown file holds 66 skills as "## 12. Skill Name" sections. Duolingo's
   own inline styling survived the scrape as {@style=...} tags; strip those and
   the dead imgur images, keep the tables — the conjugation tables are the whole
   reason these notes are worth having. */
function readTips() {
  const md = fs.readFileSync(path.join(DATA, "08_tips_and_notes.md"), "utf8");
  const out = new Map();
  const parts = md.split(/\n## /).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const heading = part.slice(0, nl).trim();
    /* headings are "12. Skill Name"; the number is the skill index, which is
       how these get back onto the path — unit rows carry short names
       ("Adj. Intro"), the notes carry long ones ("Introduction to adjectives"),
       and only the index joins them reliably */
    const index = Number((heading.match(/^(\d+)\./) || [])[1] || 0);
    let body = part.slice(nl + 1);
    body = body.split(/\n---+\s*\n\s*$/)[0];
    body = body
      .replace(/\{@style=[^}]*\}/g, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    /* the trailing rule that separates skills */
    body = body.replace(/\n-{3,}\s*$/, "").trim();
    /* the "*Row 3 · 4 lessons · 6 crown levels*" line is path metadata the
       screen already shows */
    body = body.replace(/^\*Row [^\n]*\*\s*\n?/, "").trim();
    if (body && index) out.set(index, body);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Guidebooks                                                          */
/* ------------------------------------------------------------------ */
const PUNCT = /^[\s.,!?;:'"״׳()\-–—]+$/;

function readGuidebook(unit) {
  const file = path.join(DATA, "guidebooks", `unit${String(unit - 1).padStart(3, "0")}.json`);
  if (!fs.existsSync(file)) return { heading: "", phrases: [] };
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const phrases = [];
  let heading = "";
  for (const el of doc.elements || []) {
    if (el.type === "text") {
      const t = el.element?.styledString?.text || "";
      if (t && t !== "KEY PHRASES" && !heading) heading = t;
      continue;
    }
    if (el.type !== "dialogue") continue;
    for (const p of el.element?.phrases || []) {
      const he = p.text?.styledString?.text?.trim();
      const en = p.subtext?.styledString?.text?.trim();
      if (!he || !en) continue;
      const tokens = [];
      for (const b of p.text?.blockHints || []) {
        const w = (b.value || "").trim();
        if (!w || PUNCT.test(w)) continue;
        const hints = (b.hintTable?.rows || [])
          .map((r) => r.map((c) => c.hint).join(" ").trim())
          .filter(Boolean);
        tokens.push(hints.length ? { w, h: hints } : { w });
      }
      phrases.push({ he, en, audio: p.ttsURL || "", tokens });
    }
  }
  return { heading, phrases };
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */
const skills = readCsv("01_legacy_tree_skills.csv");
const unitRows = readCsv("03_path_units.csv");
const levelRows = readCsv("04_path_levels.csv");
const lexicon = readCsv("06_lexicon_glossed.csv");
const vocab = readCsv("07_vocabulary_by_skill.csv");
const tips = readTips();

/* Row 85 is the Daily Refresh node, not a unit. */
const units = unitRows.filter((r) => num(r.unit) <= 84);

const skillById = new Map(skills.map((s) => [s.skill_id, s]));
const levelsByUnit = new Map();
const skillIdByUnit = new Map();
for (const l of levelRows) {
  const u = num(l.unit);
  if (u > 84) continue;
  if (!levelsByUnit.has(u)) levelsByUnit.set(u, []);
  levelsByUnit.get(u).push(l);
  if (l.skill_id && !skillIdByUnit.has(u)) skillIdByUnit.set(u, l.skill_id);
}

const vocabBySkill = new Map();
for (const v of vocab) {
  if (!vocabBySkill.has(v.skill)) vocabBySkill.set(v.skill, []);
  vocabBySkill.get(v.skill).push(v);
}
const lexByUnit = new Map();
for (const l of lexicon) {
  const u = num(l.first_unit);
  if (!u) continue;
  if (!lexByUnit.has(u)) lexByUnit.set(u, []);
  lexByUnit.get(u).push(l);
}

/* A gloss list like "eating / is eating / are eating" is a bank of accepted
   answers. Trim the runaway ones — some lexemes carry a dozen senses and a tile
   that reads like a dictionary entry is not a tile anyone can tap. */
function glosses(raw) {
  return String(raw || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

/* Which sense to show. The scrape sorted the senses alphabetically, so the
   first one is arbitrary — את comes out as "it" when the unit plainly teaches
   "you". Prefer a sense that actually turns up in the English of a phrase this
   unit teaches the word in; that is the sense the course means. */
function pickSense(list, he, phrases) {
  if (list.length < 2) return list;
  const context = phrases
    .filter((p) => p.tokens.some((t) => t.w === he))
    .map((p) => ` ${p.en.toLowerCase().replace(/[^a-z' ]/g, " ")} `)
    .join(" ");
  if (context) {
    const hit = list
      .filter((g) => context.includes(` ${g.toLowerCase()} `))
      .sort((a, b) => b.length - a.length)[0];
    if (hit) return [hit, ...list.filter((g) => g !== hit)];
  }
  /* otherwise the shortest sense — the headword rather than a paraphrase */
  const shortest = [...list].sort((a, b) => a.length - b.length)[0];
  return [shortest, ...list.filter((g) => g !== shortest)];
}

const SECTION_NAMES = {
  1: "Rookie",
  2: "Explorer",
  3: "Traveler",
  4: "Trailblazer",
};

fs.mkdirSync(OUT, { recursive: true });

const courseUnits = [];
let totalPhrases = 0, totalWords = 0, totalNodes = 0;

for (const u of units) {
  const unit = num(u.unit);
  const skill = skillById.get(skillIdByUnit.get(unit));
  const skillName = skill?.name || u.skill_name;
  const gb = readGuidebook(unit);

  /* Words the unit teaches: the glossed lexicon entries that first appear here,
     then anything else from the unit's skill that came with a gloss, then the
     hint tables of its own phrases. Duolingo's word list is 2,939 lexemes but
     only 393 of them survived with English attached, so the phrases have to
     make up the difference. */
  const seen = new Set();
  const words = [];
  const add = (he, en, from) => {
    const key = he;
    if (!he || seen.has(key)) return;
    const gs = pickSense(glosses(en), he, gb.phrases);
    if (!gs.length) return;
    seen.add(key);
    words.push({ he, en: gs[0], alt: gs.slice(1), from });
  };
  for (const l of lexByUnit.get(unit) || []) add(l.hebrew, l.english, "lexicon");
  for (const v of vocabBySkill.get(skillName) || []) add(v.hebrew, v.english_hint, "skill");
  for (const p of gb.phrases) for (const t of p.tokens) if (t.h) add(t.w, t.h.join(" / "), "phrase");

  /* Every lexeme the skill introduces, gloss or not — the word count Duolingo
     shows, and the pool the alphabet drills read from. */
  const lexemes = (vocabBySkill.get(skillName) || []).map((v) => v.hebrew);

  const nodes = (levelsByUnit.get(unit) || []).map((l, i) => ({
    i,
    type: l.type,                       /* skill | practice | chest | unit_review */
    sub: l.subtype || "",
    sessions: num(l.sessions),
    crown: num(l.crown_level),
    review: bool(l.has_level_review),
  }));
  totalNodes += nodes.length;

  const tipsBody = tips.get(num(skill?.skill_index)) || "";

  const unitDoc = {
    unit,
    section: num(u.section),
    cefr: u.cefr,
    objective: u.teaching_objective || gb.heading || "",
    skill: skillName,
    heading: gb.heading,
    phrases: gb.phrases,
    words,
    lexemes,
    tips: tipsBody,
  };
  fs.writeFileSync(path.join(OUT, `unit-${String(unit).padStart(3, "0")}.json`), JSON.stringify(unitDoc));

  totalPhrases += gb.phrases.length;
  totalWords += words.length;

  courseUnits.push({
    unit,
    section: num(u.section),
    cefr: u.cefr,
    objective: u.teaching_objective || gb.heading || "",
    skill: skillName,
    short: u.skill_name,
    lessons: skill ? num(skill.lessons) : 0,
    crowns: skill ? num(skill.crown_levels) : 5,
    row: skill ? num(skill.row) : 0,
    icon: skill ? num(skill.icon_id) : 0,
    tips: !!tipsBody,
    phrases: gb.phrases.length,
    words: words.length,
    lexemes: lexemes.length,
    nodes,
  });
}

/* Sections carry the CEFR band and the colour the path is painted in. */
const sections = [];
for (const cu of courseUnits) {
  let s = sections.find((x) => x.n === cu.section);
  if (!s) {
    s = { n: cu.section, name: SECTION_NAMES[cu.section] || `Section ${cu.section}`, cefr: cu.cefr, units: [], first: cu.unit, last: cu.unit };
    sections.push(s);
  }
  s.units.push(cu.unit);
  s.last = cu.unit;
  if (cu.cefr && !s.cefr) s.cefr = cu.cefr;
}

const course = {
  id: "DUOLINGO_HE_EN",
  language: "Hebrew",
  from: "English",
  version: "1.4",
  built: new Date().toISOString().slice(0, 10),
  sections: sections.map((s) => ({ n: s.n, name: s.name, cefr: s.cefr, first: s.first, last: s.last, units: s.units.length })),
  units: courseUnits,
  totals: {
    units: courseUnits.length,
    nodes: totalNodes,
    phrases: totalPhrases,
    words: totalWords,
    lexemes: courseUnits.reduce((a, u) => a + u.lexemes, 0),
    tips: courseUnits.filter((u) => u.tips).length,
  },
};

fs.writeFileSync(path.join(OUT, "course.json"), JSON.stringify(course));

console.log(
  `duo: ${course.totals.units} units, ${course.totals.nodes} nodes, ` +
  `${course.totals.phrases} phrases, ${course.totals.words} glossed words, ` +
  `${course.totals.lexemes} lexemes, ${course.totals.tips} units with notes`
);
