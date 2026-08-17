/* fetch-images.mjs — find a photograph for each word the course teaches.

   Duolingo used to introduce a word with a picture of the thing, which is the
   one moment in a lesson where a picture does the teaching rather than
   decorating it: a photograph of bread says what לֶחֶם means faster and more
   memorably than the word "bread" does.

   The pictures are scraped, not drawn. Every one is a real photograph from
   Wikimedia Commons, reached through the article the word names on the English
   Wikipedia — the lead image of an article is the picture editors chose as the
   thing itself, which is exactly the picture a vocabulary card wants.

   What gets one is decided by the gate below, and most of the course does not
   pass it: a word has to name something a photograph can show. That is the
   point rather than a shortfall — "because" gets no picture, and neither does
   a word whose article turns out to be about an album.

   In:  public/duo/unit-NNN.json  (the vocabulary the path teaches)
   Out: public/duo/img/*.webp     (256px square, ~6 KB each)
        public/duo/images.json    (gloss → file, with the credit it carries)

   Run: npm run build:images [-- --limit 40] [-- --only bread,apple] [-- --force]
   Set CHROME_PATH to use a Chromium that Playwright did not install. */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

import { glossKey } from "../src/duo/images.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const DUO = path.join(ROOT, "public", "duo");
const IMG = path.join(DUO, "img");
const INDEX = path.join(DUO, "images.json");

const UA = "DuchifatHebrewReader/1.0 (https://github.com/quadrin/Hebrew_Reader; vocabulary pictures)";
const SIZE = 256;                        /* the card is square, so the file is */
const QUALITY = 0.72;
const CONCURRENCY = 3;                   /* polite: Wikimedia asks for serial-ish traffic */

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(`--${name}`); return i < 0 ? null : argv[i + 1]; };
const LIMIT = Number(flag("limit")) || Infinity;
const ONLY = (flag("only") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const FORCE = argv.includes("--force");

/* ------------------------------------------------------------------ */
/* Which words are worth a picture                                     */
/* ------------------------------------------------------------------ */
/* Function words, pronouns, numbers and the rest of the grammar: a picture of
   "because" is a picture of nothing. */
const STOP = new Set(`
a an the this that these those there here i you he she it we they me him her us them
my your his its our their mine yours hers ours theirs who whom whose which what where when why how
and or but so if then than as of to from for with without at in on by about into over under
is am are was were be been being do does did done have has had having will would can could
not no yes maybe very too also only just even still yet already always never sometimes often
more most less least much many few some any all both each every other another same
one two three four five six seven eight nine ten eleven twelve twenty thirty forty fifty hundred thousand million
first second third fourth fifth last next please thanks hello hi goodbye bye ok okay well
am pm etc mr mrs ms dr st
`.trim().split(/\s+/));

/* Articles whose short description says the page is not the thing itself. */
const NOT_THE_THING = /\b(album|song|single|band|film|movie|series|video game|novel|book by|magazine|newspaper|company|corporation|brand|surname|given name|name|municipality|commune|prefecture|province|district|county|village|town|city|capital|river|mountain|island|footballer|player|singer|actor|actress|politician|writer|author|painter|rapper|manga|anime|episode|software|programming language|operating system|deity|goddess|god of|character)\b/i;

/* A lead image that is a diagram, a map, a coat of arms or a logo teaches
   nothing about the word. Wikimedia renders those from SVG, so the giveaway is
   in the file name. */
const NOT_A_PHOTO = /\.svg\.png$|\.(svg|gif)$|logo|icon|map|diagram|chart|graph|flag|coat[_ ]of[_ ]arms|seal|emblem|symbol|scheme|schematic|plot|formula|structure|molecul|periodic|blank/i;

/* Licences a picture may carry. Everything here is either free of conditions
   or satisfied by the credit written into images.json, which the app shows. */
const OK_LICENCE = /^(cc0|public domain|pd|cc[- ]by([- ]sa)?([- ][0-9.]+)?)/i;

const clean = glossKey;

/* A gloss is often several: "answer / reply", "apartment, flat". Each side of
   it is a word worth a picture, and the app looks a word up under any of its
   glosses, so all of them are worth asking about. */
const glossesOf = (word) => [word.en, ...(word.alt || []).slice(0, 2)]
  .flatMap((g) => String(g || "").split(/[/,;]/))
  .map(clean)
  .filter(Boolean);

const slug = (s) => s.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function candidates() {
  const seen = new Map();                /* cleaned gloss → the units that teach it */
  for (const file of fs.readdirSync(DUO).filter((f) => /^unit-\d+\.json$/.test(f)).sort()) {
    const doc = JSON.parse(fs.readFileSync(path.join(DUO, file), "utf8"));
    for (const w of doc.words || []) {
      for (const g of glossesOf(w)) {
        if (g.split(" ").length > 2) continue;          /* "what time is it" is not a picture */
        if (g.split(" ").every((part) => STOP.has(part))) continue;
        if (g.length < 2) continue;
        if (ONLY.length && !ONLY.includes(g)) continue;
        if (!seen.has(g)) seen.set(g, doc.unit);
      }
    }
  }
  /* earliest units first: if a run is cut short, it is cut short at the end of
     the course rather than in the middle of the alphabet */
  return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([g]) => g);
}

/* ------------------------------------------------------------------ */
/* Wikipedia and Commons                                               */
/* ------------------------------------------------------------------ */
/* Both are asked fifty words at a time. Asking one word at a time is what a
   scraper does to get itself rate-limited, and it did: the first run of this
   put 1,280 requests through in a couple of minutes, collected a wall of 429s,
   and reported them as "no article". Fifty to a request turns the whole course
   into about thirty calls. */
const BATCH = 50;

async function getJson(url, tries = 4) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const r = await fetch(url, { headers: { "User-Agent": UA, accept: "application/json" } });
    if (r.ok) return { data: await r.json().catch(() => null) };
    if (r.status !== 429 && r.status < 500) return { error: `HTTP ${r.status}` };
    const wait = Number(r.headers.get("retry-after")) * 1000 || 1000 * 2 ** attempt;
    await new Promise((res) => setTimeout(res, wait));
  }
  return { error: "gave up after too many retries" };
}

/* Wikimedia serves the pictures themselves from a different tier with a
   different temper, so a download gets the same backoff the API calls get. */
async function getBytes(url, tries = 4) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.ok) return { data: await r.arrayBuffer() };
    if (r.status !== 429 && r.status < 500) return { error: `HTTP ${r.status}` };
    const wait = Number(r.headers.get("retry-after")) * 1000 || 1000 * 2 ** attempt;
    await new Promise((res) => setTimeout(res, wait));
  }
  return { error: "download gave up after too many retries" };
}

/* The lead image of the article each word names. A word is looked up as a
   title, redirects followed, so "mom" arrives at Mother. */
async function leadImages(words) {
  const out = new Map();
  const q = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", redirects: "1",
    prop: "pageimages|pageprops|description", piprop: "original|thumbnail",
    pithumbsize: String(SIZE * 2), titles: words.join("|"),
  });
  const { data, error } = await getJson(`https://en.wikipedia.org/w/api.php?${q}`);
  if (error) {
    for (const w of words) out.set(w, { skip: error });
    return out;
  }
  /* the API answers in the titles it normalised and redirected to, so the way
     back to the word asked about is through those two tables */
  const back = new Map();
  const trace = (list, from = "from", to = "to") => {
    for (const row of list || []) back.set(row[to], back.get(row[from]) || row[from]);
  };
  trace(data?.query?.normalized);
  trace(data?.query?.redirects);
  const asked = new Map(words.map((w) => [w.toLowerCase(), w]));
  const wordFor = (title) => {
    let t = title;
    for (let i = 0; i < 4 && back.has(t); i++) t = back.get(t);
    return asked.get(String(t).toLowerCase());
  };

  for (const page of data?.query?.pages || []) {
    const word = wordFor(page.title);
    if (!word) continue;
    if (page.missing) { out.set(word, { skip: "no article" }); continue; }
    if (page.pageprops && "disambiguation" in page.pageprops) { out.set(word, { skip: "disambiguation" }); continue; }
    if (NOT_THE_THING.test(page.description || "")) { out.set(word, { skip: `about ${page.description}` }); continue; }
    const src = page.original?.source || page.thumbnail?.source;
    if (!src) { out.set(word, { skip: "no picture" }); continue; }
    const name = fileNameOf(src);
    if (NOT_A_PHOTO.test(name)) { out.set(word, { skip: `not a photograph (${name.slice(0, 40)})` }); continue; }
    out.set(word, { file: name, page: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}` });
  }
  for (const w of words) if (!out.has(w)) out.set(w, { skip: "no article" });
  return out;
}

/* Commons stores the original under .../commons/a/ab/Name.jpg and thumbnails
   under .../commons/thumb/a/ab/Name.jpg/330px-Name.jpg — either way the file
   name is what the licence is filed under. */
function fileNameOf(url) {
  /* the API hangs a utm_ query on the picture it hands back, and a file name
     with a query string on the end is a file Commons has not heard of */
  const parts = url.split(/[?#]/)[0].split("/");
  const i = parts.indexOf("thumb");
  /* and a title says "Korb mit Brötchen.JPG" where a URL says Korb_mit_ */
  return decodeURIComponent(i > -1 ? parts[i + 3] : parts[parts.length - 1]).replace(/_/g, " ");
}

/* The credit each picture travels with, and a thumbnail at the size wanted. */
async function commonsFiles(names) {
  const out = new Map();
  const q = new URLSearchParams({
    action: "query", format: "json", formatversion: "2",
    titles: names.map((n) => `File:${n}`).join("|"),
    prop: "imageinfo", iiprop: "url|mime|extmetadata", iiurlwidth: String(SIZE * 2),
  });
  const { data, error } = await getJson(`https://commons.wikimedia.org/w/api.php?${q}`);
  if (error) return out;
  const strip = (html) => String(html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  for (const page of data?.query?.pages || []) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata || {};
    out.set(page.title.replace(/^File:/, ""), {
      url: info.thumburl || info.url,
      mime: info.mime,
      licence: strip(meta.LicenseShortName?.value) || strip(meta.License?.value),
      by: strip(meta.Artist?.value).slice(0, 80),
      page: info.descriptionurl,
    });
  }
  return out;
}

const chunks = (list, size) => Array.from(
  { length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size)
);

/* ------------------------------------------------------------------ */
/* Square it off                                                       */
/* ------------------------------------------------------------------ */
/* No image library here, and none worth adding: Chromium is already a dev
   dependency, and it crops and re-encodes exactly the way the browser that
   will show the picture would. */
/* A photograph of a thing is not a diagram of it, and the difference is
   visible in the pixels: a chart, a map or a molecule is mostly white paper in
   a handful of flat colours, where a photograph is neither. This is the last
   gate, and it is the one that catches the lead images whose file names give
   nothing away — "argument" illustrated with a logic diagram, "millimetre"
   with a drawing of a ruler. */
/* Calibrated against photographs that had already passed: a photograph runs
   from about 55 colours (a sun on a black sky) to 360, and next to none of it
   is white. A studio shot on a white backdrop is mostly white but still full
   of colour, and is the best kind of picture for a vocabulary card, so it
   takes both signs together to condemn one. */
const FLAT = { white: 0.45, colours: 120, plain: 20 };

async function squareWebp(page, bytes, mime) {
  const data = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  const out = await page.evaluate(async ({ data, size, quality }) => {
    const img = new Image();
    img.src = data;
    try { await img.decode(); } catch (e) { return null; }
    if (!img.naturalWidth || !img.naturalHeight) return null;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    /* centre crop: the subject of a photograph is in the middle of it */
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);

    /* how much of it is paper, and how many colours it is drawn in */
    const px = ctx.getImageData(0, 0, size, size).data;
    const seen = new Set();
    let white = 0;
    for (let i = 0; i < px.length; i += 4 * 7) {
      const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
      if (r > 238 && g > 238 && b > 238) white++;
      seen.add((r >> 4 << 8) | (g >> 4 << 4) | (b >> 4));
    }
    const sampled = Math.ceil(px.length / (4 * 7));
    return { data: canvas.toDataURL("image/webp", quality), white: white / sampled, colours: seen.size };
  }, { data, size: SIZE, quality: QUALITY });
  if (!out?.data?.startsWith("data:image/webp")) return null;
  if ((out.white > FLAT.white && out.colours < FLAT.colours) || out.colours < FLAT.plain) {
    return { flat: `${Math.round(out.white * 100)}% blank in ${out.colours} colours` };
  }
  return { webp: Buffer.from(out.data.split(",")[1], "base64") };
}

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */
fs.mkdirSync(IMG, { recursive: true });
const index = FORCE || !fs.existsSync(INDEX) ? {} : JSON.parse(fs.readFileSync(INDEX, "utf8"));

const words = candidates().filter((w) => FORCE || !index[w]).slice(0, LIMIT);
console.log(`${words.length} words to look up`);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage();
await page.setContent("<body></body>");

let kept = 0, skipped = 0;
const skips = [];
const note = (word, why) => { skipped++; skips.push(`${word}: ${why}`); };

for (const batch of chunks(words, BATCH)) {
  const leads = await leadImages(batch);
  const wanted = [...leads.entries()].filter(([, l]) => l.file);
  for (const [word, l] of leads) if (l.skip) note(word, l.skip);
  if (!wanted.length) continue;

  const files = await commonsFiles([...new Set(wanted.map(([, l]) => l.file))]);

  /* the pictures themselves, a few at a time */
  const queue = [...wanted];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const [word, lead] = queue.shift();
      try {
        const file = files.get(lead.file);
        if (!file) { note(word, "not on Commons"); continue; }
        if (!OK_LICENCE.test(file.licence || "")) { note(word, file.licence || "unlicensed"); continue; }
        if (!/^image\/(jpeg|png|webp)$/.test(file.mime || "")) { note(word, file.mime || "not an image"); continue; }

        const bytes = await getBytes(file.url);
        if (bytes.error) { note(word, bytes.error); continue; }
        const picture = await squareWebp(page, bytes.data, file.mime);
        if (!picture) { note(word, "could not be re-encoded"); continue; }
        if (picture.flat) { note(word, `looks like a diagram: ${picture.flat}`); continue; }

        const name = slug(word);
        fs.writeFileSync(path.join(IMG, `${name}.webp`), picture.webp);
        index[word] = { f: name, by: file.by || "", lic: file.licence, src: file.page || lead.page };
        kept++;
      } catch (e) {
        note(word, e.message);
      }
    }
  }));
  process.stdout.write(`  ${kept} pictures, ${skipped} words without one\r`);
}
console.log();

await browser.close();

const sorted = Object.fromEntries(Object.keys(index).sort().map((k) => [k, index[k]]));
fs.writeFileSync(INDEX, JSON.stringify(sorted));

const bytes = Object.values(sorted).reduce((a, e) => a + fs.statSync(path.join(IMG, `${e.f}.webp`)).size, 0);
console.log(
  `\nimages: ${kept} new, ${skipped} without a picture worth showing, ` +
  `${Object.keys(sorted).length} in the index, ${(bytes / 1024 / 1024).toFixed(1)} MB on disk`
);
if (skips.length) {
  fs.writeFileSync(path.join(ROOT, "scripts", "images-skipped.txt"), skips.sort().join("\n") + "\n");
  console.log(`what was skipped, and why: scripts/images-skipped.txt`);
}
