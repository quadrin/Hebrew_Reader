/* A feed of real Hebrew, scored by who can read it.

   The path teaches from sentences written to teach. That is the right way to
   start and the wrong way to finish: past the first forty units the course
   knows enough words to read Hebrew that was written for Hebrew speakers, and
   until now it never handed the learner any. The units called "Read: Bialik"
   and "Read: News" contain no Bialik and no news — they contain sentences
   about Bialik and about journalism, which is revision wearing a theme.

   This harvests paragraphs that a learner at a given unit can actually read,
   from Hebrew Wikipedia, and scores every one of them against the course's own
   vocabulary index. Wikipedia is the closest thing Hebrew has to a simple
   encyclopedia: definitional, present tense, and written to be understood by
   someone who does not already know the subject. It is also CC BY-SA, served
   over the same CORS-enabled API the reader already uses for Wikisource, and
   needs no key.

   Two things make the scoring worth anything.

   It scores a sentence at a time, never an article. An article is readable in
   patches: the lead of ⁧חתול⁩ opens on taxonomy and is hopeless, and its third
   sentence is not. Averaged over the article both disappear.

   And it does not pretend a word is known because a related one is. Every
   token goes through the same morphology the session builder weighs sentences
   with, so ⁧ובעירנו⁩ is found under ⁧עיר⁩ — and what is left over after that is
   genuinely new vocabulary, which gets listed rather than hidden. An item
   carries the handful of words the reader will have to be told, because a text
   with nothing unknown in it is a test rather than a read: the research on
   extensive reading puts acquisition at 95–98% known, and the reader already
   glosses a tapped word.

   What comes back is sobering and worth saying plainly: fewer than one
   Wikipedia sentence in ten is built entirely from words this course teaches,
   and most of those only come into reach in the last third of the path.
   Encyclopedic Hebrew leans on vocabulary — ⁧כגון⁩, ⁧מוגדר⁩, ⁧תרכובת⁩, ⁧מעמד⁩ —
   that a 12,000-form course index does not carry. The feed is therefore thin
   early and thick late, and the numbers it prints say where.

   The harvest is not a build dependency: run it by hand and commit what it
   writes, the way build:shelf and fetch-fonts already work.

       npm run build:feed                    # the whole vital-articles list
       npm run build:feed -- --limit 400     # a quick pass while iterating

   Reuse is CC BY-SA 4.0 and each item carries the article it came from and a
   link back, which is what the licence asks for.
*/

import fs from "node:fs";
import path from "node:path";

import { splitSentences } from "../src/text.js";
import {
  clean, weigh, lineFits, freeWords, glossBudget, MAX_LINES,
} from "./lib/feed.mjs";

const HERE = import.meta.dirname;
const OUT = path.resolve(HERE, "..", "public", "duo", "feed");
const LEX = path.resolve(HERE, "..", "public", "duo", "lexicon.json");
const CACHE = path.resolve(HERE, "..", ".cache", "feed");

const UA = "Duchifat Hebrew Reader build script (github.com/quadrin/Hebrew_Reader)";
const WIKI = "he.wikipedia.org";
const LIST = "רשימת הערכים החיוניים";     /* the articles every Wikipedia should have */

/* The list's own subpages, best register first, with an English name for each
   so the reader can offer "everyday life" rather than a Hebrew subpage title.

   An article about breakfast is written in the words people use about
   breakfast; a biography is written in dates and place names, and a
   mathematics article is written in a dialect of its own. The order decides
   what a --limit run reads and which item wins a tie when the shipped set is
   cut, so the feed leans everyday without any topic being ruled out. */
const TOPICS = [
  ["חיי היומיום", "Everyday life"],
  ["גרסת מאה הערכים", "The hundred articles"],
  ["גרסת אלף הערכים", "The thousand articles"],
  ["ישראל", "Israel"],
  ["גאוגרפיה", "Geography"],
  ["ביולוגיה ומדעי הרפואה", "Biology and medicine"],
  ["האמנויות", "The arts"],
  ["אנתרופולוגיה ומדעי החברה", "Society"],
  ["טכנולוגיה", "Technology"],
  ["מדעי הטבע", "Natural science"],
  ["היסטוריה", "History"],
  ["פילוסופיה ודת", "Philosophy and religion"],
  ["אישים", "People"],
  ["מתמטיקה", "Mathematics"],
  ["הערכים החסרים", "Wanted articles"],
];
const ORDER = TOPICS.map(([he]) => he);
const rank = (t) => { const i = ORDER.indexOf(t); return i < 0 ? ORDER.length : i; };

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const LIMIT = Number(arg("limit", 0));            /* 0 = the whole list */
const KEEP = Number(arg("keep", 6000));           /* items to ship, spread over the bands */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* the API                                                             */
/* ------------------------------------------------------------------ */
/* Wikimedia answers a burst with 429s and asks callers to identify themselves,
   so requests go one at a time behind a named agent and back off when told to.
   Same shape as the Wikidata client the shelf build already uses. */
async function api(host, params) {
  const url = `https://${host}/w/api.php?format=json&formatversion=2&` + new URLSearchParams(params);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (r.status === 429 || r.status >= 500) {
        const wait = Number(r.headers.get("retry-after")) * 1000 || 2000 * 2 ** attempt;
        console.log(`  ${r.status} from ${host} — waiting ${Math.round(wait / 1000)}s`);
        await sleep(wait);
        continue;
      }
      if (!r.ok) throw new Error(`${host} ${r.status}`);
      return await r.json();
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(2000 * 2 ** attempt);
    }
  }
  throw new Error(`${host} gave up`);
}

/* Read-through cache, so iterating on the scoring does not re-download the
   encyclopedia. Not committed — it is a download, not a source. */
const cached = async (key, make) => {
  const f = path.join(CACHE, key.replace(/[^\w.-]/g, "_") + ".json");
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  const v = await make();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(f, JSON.stringify(v));
  return v;
};

/* ------------------------------------------------------------------ */
/* 1. what to read                                                     */
/* ------------------------------------------------------------------ */
/* The vital-articles list is the encyclopedia's own answer to "what should a
   general reader know", which is close enough to "what is worth reading in a
   language you are learning". Its subpages double as topics, so the feed can
   be asked for everyday life rather than for mathematics. */
async function seed() {
  return cached("seed", async () => {
    const pages = await api(WIKI, {
      action: "query", list: "allpages", apnamespace: "4", apprefix: LIST, aplimit: "max",
    });
    const lists = (pages.query?.allpages || []).map((p) => p.title);
    const found = new Map();
    for (const page of lists) {
      /* the last path segment names the topic; the bookkeeping subpages
         ("frequently asked questions", "changes to the list") name nothing */
      const topic = page.split("/").filter((s) => !/^ויקיפדיה:/.test(s)).pop() || "";
      if (/שאלות|שינויים|מבוקשים|קילו-בתים|הרשימה המורחבת$/.test(topic)) continue;
      const d = await api(WIKI, { action: "parse", page, prop: "links" });
      for (const l of d.parse?.links || []) {
        if (l.ns === 0 && l.exists && !found.has(l.title)) found.set(l.title, topic);
      }
      await sleep(400);
    }
    return [...found].map(([title, topic]) => ({ title, topic }))
      .sort((a, b) => rank(a.topic) - rank(b.topic));
  });
}

/* ------------------------------------------------------------------ */
/* 2. the leads                                                        */
/* ------------------------------------------------------------------ */
async function leads(titles) {
  const out = [];
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    const d = await cached(`lead-${i}-${batch[0]}`, () => api(WIKI, {
      action: "query", prop: "extracts", exintro: "1", explaintext: "1", exlimit: "20",
      redirects: "1", titles: batch.join("|"),
    }));
    /* A page comes back under its own name, not the one it was asked for —
       ⁧ארוחת בוקר⁩ may be a redirect, and the topic is filed under what was
       asked. Walking the normalisations and redirects backwards recovers it;
       without this a fifth of the feed shipped with no topic at all. */
    const back = new Map();
    for (const r of [...(d.query?.normalized || []), ...(d.query?.redirects || [])]) back.set(r.to, r.from);
    const asked = (t) => { let x = t; for (let n = 0; back.has(x) && n < 4; n++) x = back.get(x); return x; };
    for (const p of d.query?.pages || []) {
      if (p.extract) out.push({ title: p.title, extract: p.extract, asked: asked(p.title) });
    }
    if (i % 400 === 0) process.stdout.write(`\r  fetched ${out.length} leads`);
    await sleep(400);
  }
  process.stdout.write(`\r  fetched ${out.length} leads\n`);
  return out;
}

/* ------------------------------------------------------------------ */
/* 3. scoring                                                          */
/* ------------------------------------------------------------------ */
/* The rules themselves live in lib/feed.mjs, because check:feed re-derives
   every shipped number from them: a feed whose scores no longer follow from
   the committed lexicon is a feed describing a course nobody is taking. */
const lexicon = JSON.parse(fs.readFileSync(LEX, "utf8"));

/* ------------------------------------------------------------------ */
/* run                                                                 */
/* ------------------------------------------------------------------ */
const list = await seed();
console.log(`vital articles: ${list.length}`);
const topics = {};
for (const a of list) topics[a.topic] = (topics[a.topic] || 0) + 1;
console.log(`  by topic: ${Object.entries(topics).map(([t, n]) => `${t} ${n}`).join(", ")}`);

const wanted = LIMIT ? list.slice(0, LIMIT) : list;
const topicOf = new Map(list.map((a) => [a.title, a.topic]));
const pages = await leads(wanted.map((a) => a.title));

/* A page, not a paragraph.

   The learner is going to see this as an article — a Hebrew Wikipedia title
   with the lead under it — so what ships is the article and the longest run of
   its opening sentences that each clear the bar on their own. Contiguous
   rather than picked apart, because the thing a graded reader has to practise
   and a sentence bank cannot is holding on to who "he" is from one line to the
   next, and a page whose second sentence is from somewhere else teaches the
   opposite.

   Every line keeps its own score. The page is offered at the unit where the
   whole of it is in reach, and inside the page each line can say what it costs
   — which is what lets the English side be filled in one sentence at a time by
   somebody who can see how far they have got. */
const items = [];
let sentences = 0;
const seen = new Set();
for (const page of pages) {
  const free = freeWords(page.title, lexicon);
  const pageLines = splitSentences(clean(page.extract));

  /* Grow a run one sentence at a time and stop it where the page would go
     over its own budget, rather than dropping a page that grew too far. Held
     the other way round — build the longest run of fitting lines, then check
     the total — a page that ran one sentence past the limit was thrown away
     whole, and the feed lost a third of itself to sentences it could have
     kept. */
  let best = [], run = [], bestAt = 0, at = 0;
  const flush = () => {
    if (run.length > best.length) { best = run; bestAt = at; }
    run = [];
  };
  for (let i = 0; i < pageLines.length; i++) {
    const line = pageLines[i];
    sentences++;
    const w = weigh(line, free, lexicon);
    if (!lineFits(line, w)) { flush(); continue; }

    const grown = [...run, { he: line, at: w.at, gloss: w.gloss }];
    const total = weigh(grown.map((l) => l.he).join(" "), free, lexicon);
    if (run.length && total.gloss.length > glossBudget(total.n)) {
      /* this sentence is what tips the page over — end the page before it and
         let it open the next one */
      flush();
      at = i;
      run = [{ he: line, at: w.at, gloss: w.gloss }];
      continue;
    }
    if (!run.length) at = i;
    run = grown;
    if (run.length >= MAX_LINES) flush();
  }
  flush();
  /* Two sentences is the least that can be a page. One is a caption, and the
     whole argument for reading a paragraph is the second sentence referring
     back to the first. */
  if (best.length < 2) continue;

  const he = best.map((l) => l.he).join(" ");
  if (seen.has(he)) continue;
  seen.add(he);
  const w = weigh(he, free, lexicon);
  items.push({
    he, at: w.at, n: w.n, lines: best.length, gloss: w.gloss,
    src: page.title, topic: topicOf.get(page.asked) || topicOf.get(page.title) || "",
    /* where in the lead this starts, so a page that opens the article can say
       so and one that does not is not pretending to */
    from: bestAt,
    text: best,
  });
}
console.log(`read ${sentences} sentences over ${pages.length} articles, kept ${items.reduce((a, i) => a + i.lines, 0)} of them on ${items.length} pages`);

/* Spread the cut across the path rather than taking the best few thousand,
   which would all come from the same handful of units. */
items.sort((a, b) => a.at - b.at || a.n - b.n);
const BAND = 20;
const byBand = new Map();
for (const it of items) {
  const b = Math.floor(it.at / BAND);
  if (!byBand.has(b)) byBand.set(b, []);
  byBand.get(b).push(it);
}
const share = Math.ceil(KEEP / byBand.size);
const chosen = [...byBand.entries()].sort((a, b) => a[0] - b[0]).flatMap(([, v]) =>
  /* inside a band the everyday topics go first, then the ones needing no
     gloss, then the longer runs — a paragraph beats a line */
  [...v].sort((a, b) => rank(a.topic) - rank(b.topic) || a.gloss.length - b.gloss.length
    || b.lines - a.lines).slice(0, share));
chosen.sort((a, b) => a.at - b.at || a.n - b.n);

/* Shipped one file per band of twenty units, with a small index in front.

   One file would be a megabyte, and a learner at unit 60 would download the
   whole of unit 200 to read four paragraphs. Bands are what the reader asks
   for anyway — "something I can read now" is a range, not a number. */
const index = {
  source: "Hebrew Wikipedia",
  license: "CC BY-SA 4.0",
  attribution: "Text by Hebrew Wikipedia contributors, reused under CC BY-SA 4.0. "
    + "Each item names the article it came from.",
  article: `https://${WIKI}/wiki/`,
  built: new Date().toISOString().slice(0, 10),
  band: BAND,
  topics: Object.fromEntries(TOPICS),
  bands: {},
};

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));

let bytes = 0;
const shipped = new Map();
for (const it of chosen) {
  const b = Math.floor(it.at / BAND);
  if (!shipped.has(b)) shipped.set(b, []);
  shipped.get(b).push(it);
}
for (const [b, items] of [...shipped.entries()].sort((x, y) => x[0] - y[0])) {
  const from = b * BAND;
  const json = JSON.stringify({ from, to: from + BAND - 1, items });
  fs.writeFileSync(path.join(OUT, `${String(from).padStart(3, "0")}.json`), json);
  index.bands[from] = items.length;
  bytes += json.length;
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index));

const at = (lo, hi) => chosen.filter((i) => i.at >= lo && i.at <= hi).length;
console.log(`\nfeed: ${chosen.length} items over ${Object.keys(index.bands).length} bands, ${(bytes / 1024).toFixed(0)} KB`);
console.log(`  by unit: 1-40 ${at(1, 40)}  41-84 ${at(41, 84)}  85-160 ${at(85, 160)}  161-240 ${at(161, 240)}`);
console.log(`  ${chosen.filter((i) => i.lines > 1).length} run to more than one sentence`);
console.log(`  ${chosen.filter((i) => !i.gloss.length).length} need no gloss at all`);
const tops = {};
for (const i of chosen) tops[i.topic] = (tops[i.topic] || 0) + 1;
console.log(`  by topic: ${Object.entries(tops).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(", ")}`);
