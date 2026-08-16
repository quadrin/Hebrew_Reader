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
const checkpointRows = readCsv("02_legacy_tree_checkpoints.csv");
const pdfGloss = readCsv("09_vocab_pdf_glosses.csv");
const bank = readCsv("11_sentence_bank.csv");
const tips = readTips();

/* Hebrew, for matching rather than for reading: vowel points come and go
   between the sentence bank, the lexeme list and the community PDF, so every
   lookup is done on the bare consonants. */
const bare = (s) => String(s || "").replace(/[֑-ׇ]/g, "").trim();
const heToken = (w) => bare(String(w || "").replace(/[^֐-׿]/g, ""));
const heWords = (s) => String(s || "").split(/\s+/).map((w) => w.replace(/[^֐-׿]/g, "")).filter(Boolean);

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

/* ------------------------------------------------------------------ */
/* Glossary                                                            */
/* ------------------------------------------------------------------ */
/* Four sources, in order of how much they can be trusted for the sense the
   course is teaching: the guidebook tap-hints (Duolingo's own, in context),
   the word-level `assist` challenges out of the sentence bank (also
   Duolingo's, and always a single sense), the lexeme list, and finally the
   community vocabulary PDF, which is broad but sometimes a whole phrase
   where a word was wanted. */
const gloss = new Map();          /* bare Hebrew -> { en, alt[], tr } */

/* The PDF was typeset as a study list, so its glosses come in Title Case with
   grammatical tags — "I Will Give, Allow (Qal)" — where a hint wants "give".
   Duolingo's own hints are lower case and bare, and a hint bubble that mixes
   the two registers looks like a bug. */
function tidyGloss(s) {
  let t = String(s || "")
    .replace(/\((?:qal|pi'?el|hif'?il|hitpa'?el|nif'?al|pu'?al|huf'?al|paal|pa'al)[^)]*\)/gi, "")
    .replace(/\([0-9]\.[a-z]\.[a-z]\.?\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[,;]\s*$/, "");
  /* Title Case → the register Duolingo's own hints are written in, one word at
     a time so that real names keep their capital. */
  return t.split(/\s+/).map((w) => {
    if (w === "I" || !/^[A-Z]/.test(w)) return w;
    const bareWord = w.replace(/[^A-Za-z'-]/g, "").toLowerCase();
    return properNouns.has(bareWord) ? w : w.toLowerCase();
  }).join(" ");
}

/* Which English words are names. Anything the sentence bank only ever writes
   with a capital, away from the start of a sentence — Israel, Shavuot, Tel
   Aviv — as against the PDF's habit of capitalising every headword. */
const properNouns = new Set();
{
  const lower = new Set(), upper = new Set();
  for (const r of bank) {
    String(r.english || "").split(/\s+/).forEach((w, i) => {
      const t = w.replace(/[^A-Za-z'-]/g, "");
      if (!t || t === "I") return;
      if (/^[A-Z]/.test(t)) { if (i > 0) upper.add(t.toLowerCase()); }
      else lower.add(t.toLowerCase());
    });
  }
  for (const w of upper) if (!lower.has(w)) properNouns.add(w);
}

function learnWord(he, english, { tr = "", weak = false } = {}) {
  const key = bare(he);
  if (!key || !english) return;
  /* the PDF separates senses with semicolons, Duolingo with slashes */
  const senses = glosses(String(english).replace(/;/g, "/")).map(tidyGloss).filter(Boolean);
  if (!senses.length) return;
  const entry = gloss.get(key) || { strong: [], weak: [], tr: "" };
  entry[weak ? "weak" : "strong"].push(...senses);
  if (!entry.tr && tr) entry.tr = tr;
  gloss.set(key, entry);
}

/* Strong senses first — the guidebook and the course's own word challenges —
   then whatever the community list adds, deduplicated case-insensitively. */
function finishGlossary() {
  for (const [key, e] of gloss) {
    const seen = new Set();
    const ordered = [];
    for (const s of [...e.strong, ...e.weak]) {
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      ordered.push(s);
    }
    if (!ordered.length) { gloss.delete(key); continue; }
    gloss.set(key, { en: ordered[0], alt: ordered.slice(1, 6), tr: e.tr });
  }
}

/* The PDF's transliteration column lists every form it printed — "aba avot"
   for אבא — so only the first word belongs to the headword. */
const firstTranslit = (s) => String(s || "").trim().split(/\s+/)[0] || "";

for (const r of pdfGloss) {
  learnWord(r.hebrew, r.english, { tr: firstTranslit(r.transliteration), weak: true });
  if (r.hebrew_alt) learnWord(r.hebrew_alt, r.english, { tr: firstTranslit(r.transliteration), weak: true });
}
for (const v of vocab) {
  learnWord(v.hebrew, v.english_guidebook || v.english_pdf || v.english, { tr: firstTranslit(v.transliteration), weak: !v.english_guidebook });
}
for (const l of lexicon) learnWord(l.hebrew, l.english);
/* `assist` rows are Duolingo asking "which one of these is X" about a single
   word, so they are the cleanest word-level pairs in the whole bundle */
for (const s of bank) {
  if (s.challenge_type === "assist" && heWords(s.hebrew).length === 1) learnWord(s.hebrew, s.english);
}
finishGlossary();

/* ------------------------------------------------------------------ */
/* The sentence bank                                                   */
/* ------------------------------------------------------------------ */
/* 7,723 aligned pairs, 6,731 of which report the unit they were served in.
   The rest came from whole-course practice; they are placed at the unit that
   introduces their hardest word, which is where the course would have taught
   them. */
const skillToUnit = new Map();
for (const u of unitRows) {
  const un = num(u.unit);
  if (un && un <= 84) skillToUnit.set(u.skill_name, un);
}

const introUnit = new Map();      /* bare Hebrew -> unit that first teaches it */
const noteIntro = (he, unit) => {
  const key = bare(he);
  if (!key || !unit) return;
  const prev = introUnit.get(key);
  if (!prev || unit < prev) introUnit.set(key, unit);
};
for (const l of lexicon) noteIntro(l.hebrew, num(l.first_unit));

/* the lexeme list is keyed by skill; skills map onto units one-for-one */
const unitBySkillName = new Map();
for (const u of units) {
  const skill = skillById.get(skillIdByUnit.get(num(u.unit)));
  if (skill) unitBySkillName.set(skill.name, num(u.unit));
  unitBySkillName.set(u.skill_name, num(u.unit));
}
for (const v of vocab) {
  const un = unitBySkillName.get(v.skill) ?? skillToUnit.get(v.skill);
  if (un) noteIntro(v.hebrew, un);
}

/* One row per distinct sentence; a sentence served in several units belongs to
   the earliest, and every English it was ever paired with is accepted. */
const sentences = new Map();
for (const r of bank) {
  const he = String(r.hebrew || "").trim();
  const en = String(r.english || "").replace(/\s+([.,!?])/g, "$1").trim();
  if (!he || !en) continue;
  const unit = num(r.unit) || 0;
  const prev = sentences.get(he);
  if (prev) {
    if (!prev.en.includes(en)) prev.en.push(en);
    prev.types.add(r.challenge_type);
    if (unit && (!prev.unit || unit < prev.unit)) prev.unit = unit;
  } else {
    sentences.set(he, { he, en: [en], types: new Set([r.challenge_type]), unit });
  }
}

let inferred = 0, homeless = 0;
for (const s of sentences.values()) {
  if (s.unit) continue;
  /* the unit that introduces the last word of it you would have met */
  let latest = 0;
  for (const w of heWords(s.he)) {
    const u = introUnit.get(bare(w));
    if (u && u > latest) latest = u;
  }
  if (latest) { s.unit = latest; s.inferred = true; inferred++; }
  else homeless++;
}

const bankByUnit = new Map();
for (const s of sentences.values()) {
  if (!s.unit) continue;
  if (!bankByUnit.has(s.unit)) bankByUnit.set(s.unit, []);
  bankByUnit.get(s.unit).push(s);
}
/* short sentences first: within a unit that is roughly easiest first */
for (const list of bankByUnit.values()) list.sort((a, b) => a.he.length - b.he.length);

fs.mkdirSync(OUT, { recursive: true });

const courseUnits = [];
let totalPhrases = 0, totalWords = 0, totalNodes = 0, totalSentences = 0, totalAudio = 0;

for (const u of units) {
  const unit = num(u.unit);
  const skill = skillById.get(skillIdByUnit.get(unit));
  const skillName = skill?.name || u.skill_name;
  const gb = readGuidebook(unit);

  /* Sentences the unit is responsible for. Where one of them is also a
     guidebook key phrase, it inherits that phrase's recording — those 367 are
     the only audio the scrape could reach. */
  const audioFor = new Map(gb.phrases.filter((p) => p.audio).map((p) => [bare(p.he), p.audio]));
  const unitSentences = (bankByUnit.get(unit) || []).map((s) => {
    const audio = audioFor.get(bare(s.he)) || "";
    return {
      he: s.he,
      en: s.en[0],
      alt: s.en.slice(1),
      t: s.types.has("translate") ? "t" : s.types.has("listenTap") ? "l" : "a",
      ...(audio ? { audio } : {}),
      ...(s.inferred ? { inferred: 1 } : {}),
    };
  });

  /* Words the unit teaches: the glossed lexicon entries that first appear
     here, then the rest of the skill's lexemes, then anything the guidebook
     glossed in passing. */
  const seen = new Set();
  const words = [];
  const add = (he, en, from, tr) => {
    const key = bare(he);
    if (!key || seen.has(key)) return;
    const known = gloss.get(key);
    const gs = pickSense(glosses(en) .length ? glosses(en) : [known?.en, ...(known?.alt || [])].filter(Boolean), he, gb.phrases);
    if (!gs.length) return;
    seen.add(key);
    words.push({ he, en: gs[0], alt: gs.slice(1), from, ...(tr || known?.tr ? { tr: tr || known.tr } : {}) });
  };
  for (const l of lexByUnit.get(unit) || []) add(l.hebrew, l.english, "lexicon");
  for (const v of vocabBySkill.get(skillName) || []) {
    add(v.hebrew, v.english_guidebook || v.english_pdf || v.english, "skill", firstTranslit(v.transliteration));
  }
  for (const p of gb.phrases) for (const t of p.tokens) if (t.h) add(t.w, t.h.join(" / "), "phrase");

  /* The tap-hint table for this unit: every word form that turns up in its
     sentences and has a gloss anywhere in the bundle. This is what lets a
     sentence from the bank be tapped word by word the way a guidebook phrase
     can, even though the bank carries no hints of its own. */
  const hints = {};
  for (const s of unitSentences) {
    for (const w of heWords(s.he)) {
      if (hints[w]) continue;
      const g = gloss.get(bare(w));
      if (g) hints[w] = g.alt.length ? [g.en, ...g.alt.slice(0, 2)].join(" / ") : g.en;
    }
  }

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
    sentences: unitSentences,
    hints,
    words,
    lexemes,
    tips: tipsBody,
  };
  fs.writeFileSync(path.join(OUT, `unit-${String(unit).padStart(3, "0")}.json`), JSON.stringify(unitDoc));

  totalPhrases += gb.phrases.length;
  totalWords += words.length;
  totalSentences += unitSentences.length;
  totalAudio += unitSentences.filter((s) => s.audio).length;

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
    sentences: unitSentences.length,
    words: words.length,
    lexemes: lexemes.length,
    nodes,
  });
}

/* The legacy tree's four checkpoints, translated onto the path.

   They are stated in tree rows, and every unit still carries the skill it came
   from, so the row range becomes a contiguous unit range: 1-9, 10-33, 34-58,
   59-80, with the last four units sitting past the final checkpoint exactly as
   the crowns-era tree had them. A checkpoint is where Duolingo let you take one
   test instead of a dozen lessons, which is what makes it worth keeping. */
const rowByUnit = new Map();
for (const cu of courseUnits) if (cu.row) rowByUnit.set(cu.unit, cu.row);

const checkpoints = [];
for (const c of checkpointRows) {
  const first = num(c.first_row), last = num(c.last_row);
  if (!first || !/^Checkpoint/.test(c.checkpoint)) continue;
  const inside = courseUnits.filter((u) => u.row >= first && u.row <= last).map((u) => u.unit);
  if (!inside.length) continue;
  checkpoints.push({
    n: checkpoints.length + 1,
    first: Math.min(...inside),
    last: Math.max(...inside),
    units: inside.length,
    skills: num(c.skills),
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
  checkpoints,
  units: courseUnits,
  totals: {
    units: courseUnits.length,
    nodes: totalNodes,
    phrases: totalPhrases,
    sentences: totalSentences,
    sentenceAudio: totalAudio,
    words: totalWords,
    lexemes: courseUnits.reduce((a, u) => a + u.lexemes, 0),
    tips: courseUnits.filter((u) => u.tips).length,
    checkpoints: checkpoints.length,
  },
};

fs.writeFileSync(path.join(OUT, "course.json"), JSON.stringify(course));

console.log(
  `duo: ${course.totals.units} units, ${course.totals.nodes} nodes, ` +
  `${course.totals.sentences} sentences (${course.totals.sentenceAudio} with audio, ` +
  `${inferred} placed by inference, ${homeless} unplaced), ` +
  `${course.totals.phrases} key phrases, ${course.totals.words} glossed words, ` +
  `${gloss.size} words in the glossary, ${course.totals.tips} units with notes`
);
