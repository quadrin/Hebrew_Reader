/* shrink-audio.mjs — re-encode the recordings to something worth committing.

   What OpenAI sends back is a 128 kbps mp3 whether the line is one word or
   twenty, which is a bitrate for music. One voice reading slowly does not need
   it: the recordings for the whole course arrive at around 400 MB and go into
   git at that size for good, since a file committed once is in the history
   whatever the working tree says later.

   AAC at 32 kbps is inaudibly different for speech and a quarter of the size.
   The encoder is already on the machine — afconvert ships with macOS — so this
   needs nothing installed. ffmpeg is used instead where it is present, which
   is what a Linux machine will have.

   Nothing is re-encoded twice and nothing is deleted until its replacement is
   on disk and larger than nothing, so an interrupted run leaves a directory
   that still works and a second run finishes the job.

       npm run shrink:audio
       npm run shrink:audio -- --dry-run      what it would do, touching nothing
       npm run shrink:audio -- --bitrate 48000

   In and out: public/duo/audio/*.mp3 → *.m4a, and public/duo/audio.json
   rewritten to name them. */

import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const DIR = path.join(ROOT, "public", "duo", "audio");
const INDEX = path.join(ROOT, "public", "duo", "audio.json");

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i < 0 ? null : argv[i + 1]; };
const BITRATE = Number(flag("bitrate")) || 32000;
const DRY = argv.includes("--dry-run");
const CONCURRENCY = 6;

/* Which encoder this machine has. afconvert is preferred where both exist: it
   is the one the recordings were checked against. */
async function encoder() {
  for (const [cmd, name] of [["afconvert", "afconvert"], ["ffmpeg", "ffmpeg"]]) {
    try { await run("which", [cmd]); return name; } catch { /* keep looking */ }
  }
  return null;
}

const convert = {
  afconvert: (from, to) => run("afconvert", ["-f", "m4af", "-d", "aac", "-b", String(BITRATE), from, to]),
  ffmpeg: (from, to) => run("ffmpeg", ["-i", from, "-c:a", "aac", "-b:a", `${Math.round(BITRATE / 1000)}k`, "-y", to]),
};

const size = (dir) => fs.readdirSync(dir).reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

if (!fs.existsSync(DIR)) {
  console.log("no recordings yet — run npm run build:audio first");
  process.exit(0);
}

const mp3s = fs.readdirSync(DIR).filter((f) => f.endsWith(".mp3"));
const before = size(DIR);
console.log(`${mp3s.length} mp3 files, ${mb(before)}`);
if (!mp3s.length) { console.log("nothing left to shrink."); process.exit(0); }

const tool = await encoder();
if (!tool) {
  console.log("\nno encoder found. afconvert ships with macOS; on Linux install ffmpeg.");
  process.exit(1);
}
console.log(`encoding to AAC at ${BITRATE / 1000} kbps with ${tool}`);

if (DRY) { console.log("\n--dry-run: nothing was converted and nothing was written."); process.exit(0); }

const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : {};
/* the index is keyed by the Hebrew line and holds the file name, so the
   rename is looked up the other way round */
const lineFor = new Map();
for (const [he, file] of Object.entries(index)) {
  lineFor.set(String(file).includes(".") ? file : `${file}.mp3`, he);
}

let done = 0, failed = 0, orphans = 0;
const problems = [];
const save = () => fs.writeFileSync(INDEX, JSON.stringify(Object.fromEntries(Object.keys(index).sort().map((k) => [k, index[k]]))));

const queue = [...mp3s];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const name = queue.shift();
    const from = path.join(DIR, name);
    const to = from.replace(/\.mp3$/, ".m4a");
    try {
      await convert[tool](from, to);
      /* an encoder that wrote nothing has not converted anything, and
         deleting the mp3 on the strength of it would lose the recording */
      if (!fs.existsSync(to) || fs.statSync(to).size < 256) throw new Error("wrote an empty file");
      const he = lineFor.get(name);
      if (he) index[he] = path.basename(to);
      else orphans++;             /* a file the index has never heard of: converted, not indexed */
      fs.unlinkSync(from);
      done++;
      if (done % 100 === 0) { save(); process.stdout.write(`  ${done} converted, ${failed} failed\r`); }
    } catch (e) {
      failed++;
      problems.push(`${name}: ${e.message.split("\n")[0]}`);
      try { if (fs.existsSync(to)) fs.unlinkSync(to); } catch { /* nothing to clean */ }
    }
  }
}));
save();

const after = size(DIR);
console.log(`\naudio: ${done} converted, ${failed} failed — ${mb(before)} → ${mb(after)} (${((1 - after / before) * 100).toFixed(0)}% smaller)`);
if (orphans) console.log(`  ${orphans} files were not in the index and were converted anyway`);
if (problems.length) {
  fs.writeFileSync(path.join(ROOT, "scripts", "audio-failed.txt"), problems.join("\n"));
  console.log(`  what failed, and why: scripts/audio-failed.txt — those files are still mp3 and still indexed`);
}
