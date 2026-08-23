/* build-audio.mjs — record the key phrases with OpenAI's voice.

   Nine in ten of this course has never had a recording. The scrape recovered
   338, all of them guidebook phrases, and the 156 units written for this app
   have none at all — so the path leans on the voice the learner generates in
   their own browser, which is the right default and has two gaps: it needs a
   key, and it needs a network the first time each line is played.

   What it records is decided by what the app actually plays, which is not the
   same as what looks important. Two things:

     the words   — a vocabulary card is a Hebrew word, a speaker under it, and
                   nothing else to go on. 3,977 of them, and short, so they are
                   the cheapest part of this and the part most worth having.
     the phrases — the four or five lines each unit opens with, which the
                   guidebook shows and the sentence exercises draw on.

   The sentences are left out by default: 13,944 of them, five times the
   characters of everything else together, and a third of a gigabyte on disk.
   --sentences records the ones a lesson dictates rather than shows, which are
   the only ones that cannot be answered without hearing them.

   The voice is the same one the app generates at runtime — same model, same
   instructions — so a phrase that was recorded here and a sentence spoken in
   the browser sound like the same teacher.

   In:  public/duo/unit-NNN.json   (the phrases the path teaches)
   Out: public/duo/audio/*.mp3
        public/duo/audio.json      (the Hebrew line → the file that says it)

   Run: OPENAI_API_KEY=sk-... npm run build:audio
        npm run build:audio -- --dry-run          what it would cost, spending nothing
        npm run build:audio -- --limit 50         a few, to hear before committing to all
        npm run build:audio -- --voice nova       any voice the app offers
        npm run build:audio -- --sentences        the dictated sentences too — five times the cost

   Costs money, once. Nothing already in audio.json is asked for again, so a
   second run is free and a interrupted one resumes. */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const DUO = path.join(ROOT, "public", "duo");
const OUT = path.join(DUO, "audio");
const INDEX = path.join(DUO, "audio.json");

/* the same model and the same instructions src/voice.js uses in the browser,
   so the two sound like one voice rather than two */
const MODEL = "gpt-4o-mini-tts";
const INSTRUCTIONS = "Read the Hebrew clearly and slowly, as a language teacher would for a beginner.";
const CONCURRENCY = 4;
const SAVE_EVERY = 25;          /* the index is written as it goes: a long run that dies keeps what it bought */

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(`--${name}`); return i < 0 ? null : argv[i + 1]; };
const LIMIT = Number(flag("limit")) || Infinity;
const VOICE = flag("voice") || "alloy";
const DRY = argv.includes("--dry-run");
const SENTENCES = argv.includes("--sentences");

const KEY = process.env.OPENAI_API_KEY || "";
if (!KEY && !DRY) {
  console.log("build:audio needs a key:\n\n  OPENAI_API_KEY=sk-... npm run build:audio\n");
  console.log("Or ask what it would cost without spending anything:\n\n  npm run build:audio -- --dry-run\n");
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* What to record                                                      */
/* ------------------------------------------------------------------ */
/* A line already carrying a recording is left alone — those 338 are Duolingo's
   own, read by whoever Duolingo hired, and better than anything generated. */
function lines() {
  const seen = new Map();                /* Hebrew → the unit that says it first */
  for (const file of fs.readdirSync(DUO).filter((f) => /^unit-\d+\.json$/.test(f)).sort()) {
    const doc = JSON.parse(fs.readFileSync(path.join(DUO, file), "utf8"));
    const take = (he, audio) => {
      const text = String(he || "").trim();
      if (!text || audio) return;
      if (!seen.has(text)) seen.set(text, doc.unit);
    };
    /* The vocabulary first, because it is what a lesson plays most: a card
       introducing a word speaks it on sight and again on every tap, and the
       multiple-choice questions built from words speak each option. */
    for (const w of doc.words || []) take(w.he, "");
    for (const p of doc.phrases || []) take(p.he, p.audio);
    /* Only the ones a lesson dictates. A translate exercise shows the Hebrew;
       a listening one is unanswerable without a voice, so it is the sentence
       worth the money if any sentence is. */
    if (SENTENCES) for (const s of doc.sentences || []) if (s.t === "l") take(s.he, s.audio);
  }
  return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([he]) => he);
}

const nameFor = (he) => crypto.createHash("sha1").update(he).digest("hex").slice(0, 16);

/* ------------------------------------------------------------------ */
/* OpenAI                                                              */
/* ------------------------------------------------------------------ */
async function speak(text, tries = 4) {
  for (let attempt = 0; attempt < tries; attempt++) {
    let r;
    try {
      r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: MODEL, voice: VOICE, input: text, response_format: "mp3", instructions: INSTRUCTIONS }),
      });
    } catch (e) {
      await wait(1000 * 2 ** attempt);
      continue;
    }
    if (r.ok) return { data: Buffer.from(await r.arrayBuffer()) };
    /* a bad key or a bad request will not get better by asking again */
    if (r.status !== 429 && r.status < 500) {
      return { error: `HTTP ${r.status} ${(await r.text().catch(() => "")).slice(0, 120)}` };
    }
    const retry = Number(r.headers.get("retry-after")) * 1000;
    await wait(retry || 1000 * 2 ** attempt);
  }
  return { error: "gave up after too many retries" };
}

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

/* ------------------------------------------------------------------ */

fs.mkdirSync(OUT, { recursive: true });
const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : {};

const all = lines();
/* what is left to do, and then what this run will actually take on: counted
   separately so that --limit does not report the rest as already done */
const pending = all.filter((he) => !index[he]);
const todo = pending.slice(0, LIMIT);
const chars = todo.reduce((n, he) => n + he.length, 0);

console.log(`${all.length} lines the course has no recording for, ${all.length - pending.length} of them already voiced here`);
console.log(`${todo.length} to record — ${chars.toLocaleString()} characters, billed per character at whatever ${MODEL} costs today`);

if (DRY) {
  console.log("\n--dry-run: nothing was sent and nothing was written.");
  const sample = todo.slice(0, 5).map((s) => `  ${s}`).join("\n");
  if (sample) console.log(`\nthe first few it would record:\n${sample}`);
  process.exit(0);
}

let done = 0, failed = 0;
const problems = [];
const save = () => fs.writeFileSync(INDEX, JSON.stringify(Object.fromEntries(Object.keys(index).sort().map((k) => [k, index[k]]))));

const queue = [...todo];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const he = queue.shift();
    const { data, error } = await speak(he);
    if (error) { failed++; problems.push(`${he}: ${error}`); continue; }
    const name = nameFor(he);
    fs.writeFileSync(path.join(OUT, `${name}.mp3`), data);
    index[he] = name;
    done++;
    if (done % SAVE_EVERY === 0) save();
    process.stdout.write(`  ${done} recorded, ${failed} failed\r`);
  }
}));
save();
console.log();

const bytes = fs.readdirSync(OUT).reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`audio: ${done} new, ${failed} failed, ${Object.keys(index).length} lines recorded, ${(bytes / 1024 / 1024).toFixed(1)} MB on disk`);
if (problems.length) {
  fs.writeFileSync(path.join(ROOT, "scripts", "audio-failed.txt"), problems.join("\n"));
  console.log(`what failed, and why: scripts/audio-failed.txt`);
}
