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
import crypto from "node:crypto";

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
/* What a unit looks like on the path                                  */
/* ------------------------------------------------------------------ */
/* Duolingo's tree hung four to seven levels off a skill and asked for four to
   seven sessions of each, so one card on the path ran fifteen to thirty-three
   lessons deep. "Lesson 3 of 15" is not an invitation; it is a warning, and
   the unit it belonged to was never going to be finished.

   A card here is at most five lessons, counting everything it asks you to tap.
   A unit with more to teach than five lessons hold is split into two cards —
   p1 and p2 — rather than made deeper, which is also how the path stops being
   a wall of identical circles: the split units are the big ones, and you can
   see which they are.

   How much a unit has to teach is its vocabulary: one lesson for every nine
   words it introduces, never fewer than two, never more than eight. Eight is
   what two cards hold once each has spent one of its five on the thing that
   closes it — a chest at the halfway point of a split unit, the unit review
   at the end. */
const LESSON_CAP = 5;                   /* lessons on one card, everything counted */
const WORDS_PER_LESSON = 9;
const MAX_TEACHING = (LESSON_CAP - 1) * 2;

function planCards(wordCount) {
  const teach = Math.max(2, Math.min(MAX_TEACHING, Math.ceil(wordCount / WORDS_PER_LESSON)));
  const split = teach + 1 > LESSON_CAP;
  const per = split ? [Math.ceil(teach / 2), Math.floor(teach / 2)] : [teach];

  const cards = [];
  let i = 0, lesson = 0;
  per.forEach((count, p) => {
    const nodes = [];
    /* the teaching lessons, each one session and each teaching its own words:
       the lesson number carries on across the split, so p2 does not start over
       on the words p1 has already introduced */
    for (let k = 0; k < count; k++) {
      nodes.push({ i: i++, type: "skill", sub: "regular", sessions: 1, lesson: lesson++ });
    }
    nodes.push(p === per.length - 1
      ? { i: i++, type: "unit_review", sub: "unit_review", sessions: 1 }
      : { i: i++, type: "chest", sub: "chest", sessions: 1 });
    cards.push({ part: split ? p + 1 : 0, parts: per.length, nodes });
  });
  return cards;
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
/* Some of Duolingo's own vocabulary tables put the conjugation in the column
   the meaning belongs in, so שׁוֹאֶלֶת arrives glossed "F.S - Pres." — feminine
   singular, present — which is a label for a form rather than what the word
   means. Matched against Hebrew on a card it teaches nothing, and there is no
   meaning anywhere else in the bundle to put in its place: the whole of that
   table reads the same way. A gloss like "Hot, Warm (m.s)" is a different
   thing and stays, tag and all — it says what the word means first. */
const GRAMMAR_LABEL = /^[\s(]*\d?\.?[mf]\.?\s?[sp]\b[^a-z]*(pres|past|fut|imp)?\.?[^a-z]*$/i;

function glosses(raw) {
  return String(raw || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((g) => !GRAMMAR_LABEL.test(g))
    .slice(0, 8);
}

/* Which sense to show. The scrape sorted the senses alphabetically, so the
   first one is arbitrary — את comes out as "it" when the unit plainly teaches
   "you". Prefer a sense that actually turns up in the English of a phrase this
   unit teaches the word in; that is the sense the course means. */
/* Which of a word's senses to teach it under.

   Duolingo's hint tables are written for the sentence in front of you, so a
   word collects the meanings of the phrases it has stood in: שלה is filed as
   "her / her boys / her children / hers / its" because it turned up in "her
   boys" and "her children", and שמש as "sun / sunglasses" because it turned
   up in משקפי שמש. Asked cold — "what does שלה mean?" — the answer is "her".

   So a sense is preferred for saying the least: fewest English words first,
   then shortest. Context only breaks a tie between senses of the same size,
   which is where it is worth something — telling apart two readings of one
   word rather than promoting the phrase it was harvested from. A Hebrew
   compound is a different matter: it really does mean a phrase, so its senses
   are ranked by context the way they always were. */
function pickSense(list, he, phrases) {
  if (list.length < 2) return list;
  const context = phrases
    .filter((p) => p.tokens.some((t) => t.w === he))
    .map((p) => ` ${p.en.toLowerCase().replace(/[^a-z' ]/g, " ")} `)
    .join(" ");
  const inContext = (g) => (context ? context.includes(` ${g.toLowerCase()} `) : false);

  if (he.trim().split(/\s+/).length > 1) {
    const hit = list.filter(inContext).sort((a, b) => b.length - a.length)[0];
    if (hit) return [hit, ...list.filter((g) => g !== hit)];
    const shortest = [...list].sort((a, b) => a.length - b.length)[0];
    return [shortest, ...list.filter((g) => g !== shortest)];
  }

  const size = (g) => g.trim().split(/\s+/).length;
  const best = [...list].sort((a, b) =>
    size(a) - size(b) || (inContext(b) ? 1 : 0) - (inContext(a) ? 1 : 0) || a.length - b.length)[0];
  return [best, ...list.filter((g) => g !== best)];
}

/* 1-3 are Duolingo's own names for the sections the scrape covers. 4 onwards
   are ours, because the units in them are ours — see data/extended-units/. */
const SECTION_NAMES = {
  1: "Rookie",
  2: "Explorer",
  3: "Traveler",
  4: "Navigator",
  5: "Storyteller",
  6: "Reader",
  7: "Local",
  8: "Citizen",
  9: "Native Ear",
  10: "Fluent",
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

  /* The tap-hint trick leaves its mark on the other half of a compound: שמש comes
     glossed "sun / sunglasses" because the phrase it was harvested from is
     about sunglasses, and the sense picked from a phrase's English then reads
     as the word's own meaning. Where two entries end up claiming one gloss,
     the compound keeps it and the single word falls back to its next sense —
     so משקפי שמש stays "sunglasses" and שמש goes back to meaning sun. */
  const claimed = new Map();
  const wordiest = [...words].sort((a, b) => b.he.split(/\s+/).length - a.he.split(/\s+/).length);
  for (const w of wordiest) {
    const g = w.en.toLowerCase().trim();
    if (!claimed.has(g)) { claimed.set(g, w.he); continue; }
    const next = (w.alt || []).find((x) => !claimed.has(x.toLowerCase().trim()));
    if (!next) continue;
    w.alt = [w.en, ...w.alt.filter((x) => x !== next)];
    w.en = next;
    claimed.set(next.toLowerCase().trim(), w.he);
  }

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

  const cards = planCards(words.length);
  totalNodes += cards.reduce((a, c) => a + c.nodes.length, 0);

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

  for (const card of cards) {
    courseUnits.push({
      unit,
      part: card.part,                  /* 0 when the unit is one card, else 1 or 2 */
      parts: card.parts,
      section: num(u.section),
      cefr: u.cefr,
      objective: u.teaching_objective || gb.heading || "",
      skill: skillName,
      short: u.skill_name,
      lessons: card.nodes.filter((n) => n.type === "skill").length,
      srcRow: skill ? num(skill.row) : 0,
      row: 0,                           /* filled in once every card exists */
      icon: skill ? num(skill.icon_id) : 0,
      tips: !!tipsBody,
      phrases: gb.phrases.length,
      sentences: unitSentences.length,
      words: words.length,
      lexemes: lexemes.length,
      nodes: card.nodes,
    });
  }
}

/* one card per unit, for the things that are true of a unit rather than of a
   card on the path. Taken here, before the extended units are added, because
   the pass below is about a pathology of the scrape and has no business
   re-glossing a word somebody wrote by hand. */
const firstCards = courseUnits.filter((u) => u.part <= 1);
let halfWords = "none";

/* ------------------------------------------------------------------ */
/* Words that are half of something                                    */
/* ------------------------------------------------------------------ */
/* Duolingo's tap-hints gloss a word with what the phrase around it means, so
   the lexicon carries pieces of compounds under the compound's meaning:
   משקפי — "glasses-of", which cannot stand alone — filed as "sunglasses"
   because the phrase it opens is משקפי שמש, and ארוחת filed as "lunch".
   Matched against its English on a card, such a word is cut in half.

   Where the course teaches the whole thing anywhere in it, the piece goes.
   That has to be asked across the whole course rather than inside one unit,
   because the piece and the phrase are often units apart — ארוחת is taught in
   unit 11 and ארוחת צהריים in unit 8. */
{
  const forms = new Map();                 /* gloss → every Hebrew form under it */
  const docs = new Map();                  /* unit → its file and contents */
  for (const cu of firstCards) {
    const file = path.join(OUT, `unit-${String(cu.unit).padStart(3, "0")}.json`);
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    docs.set(cu.unit, { file, doc });
    for (const w of doc.words) {
      const g = w.en.toLowerCase().trim();
      if (!forms.has(g)) forms.set(g, new Set());
      forms.get(g).add(w.he);
    }
  }

  /* every sense a Hebrew compound already carries */
  const phraseGlosses = new Set();
  for (const [gloss, set] of forms) {
    for (const he of set) if (he.trim().split(/\s+/).length > 1) phraseGlosses.add(gloss);
  }

  const halves = new Set();                /* "gloss\u0000form" of every piece */
  const inside = (whole, part) => whole !== part && ` ${whole} `.includes(` ${part} `);
  for (const [gloss, set] of forms) {
    for (const a of set) for (const b of set) if (inside(b, a)) halves.add(`${gloss}\u0000${a}`);
  }

  /* The same thing happens a word off: מכונת is filed as "laundry machine"
     where מכונת כביסה is "washing machine", so the glosses never match
     exactly. Two senses of the same length naming the same thing — the same
     head noun at the end of both — are the same claim, and the piece is still
     a piece.

     Both conditions are load-bearing, and a looser pair of them is what this
     was on the first attempt: any shared word let "the house" and "the school"
     agree on "the", which threw away בית. The head has to be the shared word,
     and the lengths have to match, or ילד goes with "a good boy". */
  const shape = (g) => g.toLowerCase().split(/\s+/).filter(Boolean);
  const entries = [...forms].flatMap(([gloss, set]) => [...set].map((he) => ({ gloss, he })));
  for (const a of entries) {
    for (const b of entries) {
      if (!inside(b.he, a.he)) continue;
      const [ga, gb] = [shape(a.gloss), shape(b.gloss)];
      if (ga.length < 2 || ga.length !== gb.length) continue;
      if (ga[ga.length - 1] !== gb[gb.length - 1]) continue;
      halves.add(`${a.gloss}\u0000${a.he}`);
    }
  }

  /* A piece is only a piece under that gloss. יד is filed as "(wrist) watch"
     because of שעון יד, but it also means hand, and it is the only place the
     course has to teach that — so a word with another sense keeps it and is
     re-glossed rather than thrown out. The fewest-word sense wins, for the
     reason pickSense uses: the shorter one is the word, the longer one is the
     phrase it was harvested from. Only a word with nothing else to mean goes. */
  const size = (g) => g.trim().split(/\s+/).length;
  let dropped = 0, demoted = 0;
  for (const [unit, { file, doc }] of docs) {
    const kept = [];
    for (const w of doc.words) {
      if (!halves.has(`${w.en.toLowerCase().trim()}\u0000${w.he}`)) { kept.push(w); continue; }
      const next = [...(w.alt || [])]
        .filter((g) => !halves.has(`${g.toLowerCase().trim()}\u0000${w.he}`))
        /* and not a sense that belongs to a phrase either: מכונת's alternates
           include "washing machine", which is what מכונת כביסה means */
        .filter((g) => !phraseGlosses.has(g.toLowerCase().trim()))
        .sort((a, b) => size(a) - size(b) || a.length - b.length)[0];
      if (!next) { dropped++; continue; }
      w.alt = [w.en, ...w.alt.filter((g) => g !== next)];
      w.en = next;
      demoted++;
      kept.push(w);
    }
    if (kept.length !== doc.words.length || demoted) {
      doc.words = kept;
      fs.writeFileSync(file, JSON.stringify(doc));
      for (const cu of courseUnits) if (cu.unit === unit) cu.words = kept.length;
    }
  }
  halfWords = `${dropped} dropped, ${demoted} re-glossed`;
  totalWords -= dropped;
  if (process.env.SHOW_HALVES) console.log([...halves].map((k) => k.split("\u0000").reverse().join(" = ")).sort().join("\n"));
}

/* ------------------------------------------------------------------ */
/* The units the scrape could not supply                               */
/* ------------------------------------------------------------------ */
/* Duolingo's Hebrew tree ends at unit 84 and at A1, which is a fine place to
   stop being a beginner and a poor place to stop reading. Units 85-160 are
   written for this app rather than scraped, and live in data/extended-units/
   because a directory that gets deleted and rebuilt is no place to keep the
   only copy of something.

   They are copied out unchanged and planned onto the path by the same
   planCards the scraped units use, so a card is a card wherever it came from:
   the same split rule, the same chest between two halves of one unit, the same
   node shape the session builder reads. Nothing downstream needs to know which
   units these are. */
const EXTRA = path.join(ROOT, "data", "extended-units");
let extended = 0;
if (fs.existsSync(EXTRA)) {
  const scraped = new Set(courseUnits.map((u) => u.unit));

  /* Which units stand side by side. The legacy tree put one to three related
     skills in a centred row, which is what makes the path read as a tree
     rather than a column, and the scraped cards inherit that grouping from the
     tree itself. There is no tree behind these units, so the grouping is
     written down in rows.json — the past-tense binyanim abreast, the two
     passives abreast, the three units that read Bialik, Brenner and Agnon
     abreast, a review standing alone.

     Checked rather than trusted: the layout pass below walks the cards in
     order and starts a row when the number changes, so a group that is not a
     run of consecutive units would quietly come out as several rows, and a
     group of four would quietly lose its last card to the next row. */
  const rowFile = path.join(EXTRA, "rows.json");
  const grouped = new Map();
  if (fs.existsSync(rowFile)) {
    const groups = JSON.parse(fs.readFileSync(rowFile, "utf8"));
    let key = 0;
    for (const g of groups) {
      if (!g.length || g.length > 3) throw new Error(`rows.json: a row holds one to three units, not ${g.length}`);
      if (g.some((u, i) => i && u !== g[i - 1] + 1)) throw new Error(`rows.json: [${g}] is not a run of consecutive units`);
      key++;
      for (const u of g) {
        if (grouped.has(u)) throw new Error(`rows.json: unit ${u} is in two rows`);
        grouped.set(u, key);
      }
    }
  }

  /* A unit rows.json has never heard of stands on its own, which is the right
     way to be wrong: it shows up on the path rather than displacing something. */
  let srcRow = Math.max(0, ...courseUnits.map((u) => u.srcRow));
  const base = srcRow;
  for (const f of fs.readdirSync(EXTRA).filter((x) => /^unit-\d+\.json$/.test(x)).sort()) {
    const doc = JSON.parse(fs.readFileSync(path.join(EXTRA, f), "utf8"));
    const unit = num(doc.unit);
    if (!unit) throw new Error(`${f}: no unit number`);
    if (scraped.has(unit)) throw new Error(`${f}: unit ${unit} is already in the scraped tree`);
    if (unit !== num(f.match(/\d+/)[0])) throw new Error(`${f}: says it is unit ${unit}`);
    scraped.add(unit);

    fs.writeFileSync(path.join(OUT, `unit-${String(unit).padStart(3, "0")}.json`), JSON.stringify(doc));

    const cards = planCards(doc.words.length);
    totalNodes += cards.reduce((a, c) => a + c.nodes.length, 0);
    totalPhrases += doc.phrases.length;
    totalWords += doc.words.length;
    totalSentences += doc.sentences.length;
    totalAudio += doc.sentences.filter((x) => x.audio).length;
    srcRow = grouped.has(unit) ? base + grouped.get(unit) : ++srcRow;
    extended++;

    for (const card of cards) {
      courseUnits.push({
        unit,
        part: card.part,
        parts: card.parts,
        section: num(doc.section),
        cefr: doc.cefr,
        objective: doc.objective || doc.heading || "",
        skill: doc.skill,
        short: doc.skill,
        lessons: card.nodes.filter((n) => n.type === "skill").length,
        srcRow,
        row: 0,
        /* the scraped cards take an icon from the tree; these walk the sheet,
           so a section is not the same eight pictures over and over */
        icon: ((unit - 1) % 57) + 1,
        tips: !!doc.tips,
        phrases: doc.phrases.length,
        sentences: doc.sentences.length,
        words: doc.words.length,
        lexemes: doc.lexemes.length,
        nodes: card.nodes,
      });
    }
  }
}

/* The legacy tree's four checkpoints, translated onto the path.

   They are stated in tree rows, and every unit still carries the skill it came
   from, so the row range becomes a contiguous unit range: 1-9, 10-33, 34-58,
   59-80, with the last four units sitting past the final checkpoint exactly as
   the crowns-era tree had them. A checkpoint is where Duolingo let you take one
   test instead of a dozen lessons, which is what makes it worth keeping. */
const checkpoints = [];
for (const c of checkpointRows) {
  const first = num(c.first_row), last = num(c.last_row);
  if (!first || !/^Checkpoint/.test(c.checkpoint)) continue;
  /* stated in the tree's own rows, which the cards still carry as srcRow */
  const inside = [...new Set(courseUnits
    .filter((u) => u.srcRow >= first && u.srcRow <= last)
    .map((u) => u.unit))];
  if (!inside.length) continue;
  checkpoints.push({
    n: checkpoints.length + 1,
    first: Math.min(...inside),
    last: Math.max(...inside),
    units: inside.length,
    skills: num(c.skills),
  });
}

/* The extended sections get one apiece, at the end. Duolingo's checkpoints
   came from the tree; these are where a section ends, which is the same offer
   made for the same reason — a test instead of a dozen lessons. */
for (const n of [...new Set(courseUnits.map((u) => u.section))].sort((a, b) => a - b)) {
  if (n <= 3) continue;
  const inside = [...new Set(courseUnits.filter((u) => u.section === n).map((u) => u.unit))];
  if (!inside.length) continue;
  checkpoints.push({
    n: checkpoints.length + 1,
    first: Math.min(...inside),
    last: Math.max(...inside),
    units: inside.length,
    skills: inside.length,
  });
}

/* The tree stood one to three skills to a row, and cards inherit the row their
   unit stood in — so a row that held three units, two of which split, would now
   hold five. Rows are laid out again from the front: same order, same grouping
   where it fits, broken into another row as soon as a fourth card lands in one.
   p1 and p2 end up side by side unless their row was already full. */
{
  let row = 0, held = 0, from = null;
  for (const cu of courseUnits) {
    if (cu.srcRow !== from || held === 3) { row++; held = 0; from = cu.srcRow; }
    cu.row = row;
    held++;
  }
  for (const cu of courseUnits) delete cu.srcRow;
}

/* the same one card per unit, now that the extended units are on the path too */
const everyFirstCard = courseUnits.filter((u) => u.part <= 1);

/* Sections carry the CEFR band and the colour the path is painted in. */
const sections = [];
for (const cu of courseUnits) {
  let s = sections.find((x) => x.n === cu.section);
  if (!s) {
    s = { n: cu.section, name: SECTION_NAMES[cu.section] || `Section ${cu.section}`, cefr: cu.cefr, bands: [], units: [], first: cu.unit, last: cu.unit };
    sections.push(s);
  }
  s.units.push(cu.unit);
  s.last = cu.unit;
  s.bands.push(cu.cefr);
}
/* The band a section is labelled with is the one most of it is at, not the one
   its first card happens to carry. Duolingo's three sections are each of a
   single band and read the same either way; the extended sections cross a
   boundary partway through — Storyteller opens on four A2 units and spends the
   other twenty-four at B1, and calling the whole of it A2 would be a header
   that lies about most of what is under it. */
for (const s of sections) {
  const count = new Map();
  for (const b of s.bands) if (b) count.set(b, (count.get(b) || 0) + 1);
  s.cefr = [...count].sort((a, b) => b[1] - a[1] || 0)[0]?.[0] || "";
}

const course = {
  id: "DUOLINGO_HE_EN",
  language: "Hebrew",
  from: "English",
  version: "1.4",
  built: new Date().toISOString().slice(0, 10),
  /* the count is units, not cards, because the header beside it reads
     "units 1-16" */
  sections: sections.map((s) => ({ n: s.n, name: s.name, cefr: s.cefr, first: s.first, last: s.last, units: new Set(s.units).size })),
  checkpoints,
  units: courseUnits,
  /* A split unit is two cards of one unit, so anything counted per unit is
     counted off the first card of each and anything counted per card is
     counted off all of them. */
  totals: {
    units: new Set(courseUnits.map((u) => u.unit)).size,
    cards: courseUnits.length,
    nodes: totalNodes,
    lessons: courseUnits.reduce((a, u) => a + u.nodes.reduce((b, n) => b + n.sessions, 0), 0),
    phrases: totalPhrases,
    sentences: totalSentences,
    sentenceAudio: totalAudio,
    words: totalWords,
    lexemes: everyFirstCard.reduce((a, u) => a + u.lexemes, 0),
    tips: everyFirstCard.filter((u) => u.tips).length,
    checkpoints: checkpoints.length,
  },
};

/* What the units actually say, in twelve characters.

   The service worker keeps a unit file from the moment the unit is first
   opened — right for a book, wrong for a lesson, because a correction to the
   course would then never reach a phone that had already been through it. The
   course index is precached and so always arrives with a new build; it carries
   this, and the app throws away the unit files it is holding when it changes. */
const stamp = crypto.createHash("sha1");
for (const f of fs.readdirSync(OUT).filter((f) => /^unit-\d+\.json$/.test(f)).sort()) {
  stamp.update(fs.readFileSync(path.join(OUT, f)));
}
course.data = stamp.digest("hex").slice(0, 12);

fs.writeFileSync(path.join(OUT, "course.json"), JSON.stringify(course));

console.log(
  `duo: ${course.totals.units} units in ${course.totals.cards} cards, ` +
  `${course.totals.nodes} nodes, ${course.totals.lessons} lessons, ` +
  `${course.totals.sentences} sentences (${course.totals.sentenceAudio} with audio, ` +
  `${inferred} placed by inference, ${homeless} unplaced), ` +
  `${course.totals.phrases} key phrases, ${course.totals.words} glossed words, ` +
  `${gloss.size} words in the glossary, half-words: ${halfWords}, ` +
  `${course.totals.tips} units with notes, ` +
  `${extended} units written rather than scraped`
);
