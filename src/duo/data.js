/* Course data access.

   course.json is the whole path — sections, 84 units drawn as 108 cards — and is small
   enough to hold. Unit files carry the phrases, hints and grammar notes and are
   fetched the first time a unit is opened, then kept: a session pulls from
   neighbouring units for its distractors, so the cache earns its keep. */

const url = (file) => new URL(`duo/${file}`, document.baseURI).href;

let coursePromise = null;
const units = new Map();
const unitPromises = new Map();

async function getJson(u) {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`couldn't load ${u.split("/").pop()} (${r.status})`);
  return r.json();
}

/* The service worker keeps a unit file for good once the unit has been opened,
   which is right for a book and wrong for a lesson: a fix to the course — a
   word whose meaning came out as a grammar label, a picture that was of the
   wrong thing — would never reach anyone who had already been through that
   unit. The course index is precached, so it always arrives with a new build,
   and it carries a stamp of what the unit files say. When that stamp changes,
   the kept copies go. */
const STAMP = "duo-data-stamp";

async function dropStaleUnits(stamp) {
  if (!stamp) return;
  try {
    if (localStorage.getItem(STAMP) === stamp) return;
    if (typeof caches !== "undefined") await caches.delete("lavan-duo-units");
    units.clear();
    localStorage.setItem(STAMP, stamp);
  } catch {
    /* no cache storage and no localStorage means nothing was kept anyway */
  }
}

export function fetchCourse() {
  if (!coursePromise) {
    coursePromise = getJson(url("course.json"))
      .then(async (course) => {
        await dropStaleUnits(course.data);
        return course;
      })
      .catch((e) => {
        coursePromise = null;
        throw e;
      });
  }
  return coursePromise;
}

/* The reading feed: paragraphs of Hebrew that Hebrew speakers wrote, scored by
   the unit they become readable at and filed one file per twenty units.

   The index is small and says which bands exist; a band is fetched the first
   time somebody at that level asks to read, and kept. Nobody downloads a band
   they cannot read yet, which is the whole reason it is not one file.

   A band can be missing — the feed is thin at the bottom of the course, and
   below unit 20 it is nearly empty — so callers are handed an empty list
   rather than an error, and reach down to the band below for more. */
let feedPromise = null;
const bands = new Map();

/* A band is kept on the phone once it has been read from, and the same
   correction the units need the bands need too — more so, because the feed has
   changed shape as well as content: a band kept from before the feed carried
   its sentences holds paragraphs with nothing under them, which is a page with
   nothing to write and reads as an article already finished. The index is
   precached, so it always arrives with a new build, and it carries a stamp of
   what the band files say. When that stamp changes, the kept copies go. */
const FEED_STAMP = "duo-feed-stamp";

async function dropStaleBands(stamp) {
  if (!stamp) return;
  try {
    if (localStorage.getItem(FEED_STAMP) === stamp) return;
    if (typeof caches !== "undefined") await caches.delete("lavan-duo-feed");
    bands.clear();
    localStorage.setItem(FEED_STAMP, stamp);
  } catch {
    /* no cache storage and no localStorage means nothing was kept anyway */
  }
}

export function fetchFeedIndex() {
  if (!feedPromise) {
    feedPromise = getJson(url("feed/index.json"))
      .then(async (index) => {
        await dropStaleBands(index.data);
        return index;
      })
      .catch((e) => { feedPromise = null; throw e; });
  }
  return feedPromise;
}

export async function fetchFeedBand(from) {
  const key = String(from).padStart(3, "0");
  if (!bands.has(key)) {
    bands.set(key, getJson(url(`feed/${key}.json`)).catch(() => ({ items: [] })));
  }
  return bands.get(key);
}

/* The stamp above is what stops a band outliving the shape it was built in,
   but a delete is best-effort — a browser with no cache storage, or one
   holding the band in a tab that is already open, can still hand a reader an
   item from before the feed carried its sentences. Such an item is taken as
   the one sentence it is, so the page is short rather than empty. */
const asPage = (i) => (Array.isArray(i.text) && i.text.length
  ? i
  : { ...i, text: [{ he: i.he, at: i.at, gloss: i.gloss || [] }] });

/* Everything readable at or below `unit`, nearest first — the band the learner
   is in, then the ones under it, which is the order that puts the hardest
   thing they can actually read at the top. */
export async function fetchFeed(unit) {
  const index = await fetchFeedIndex();
  const size = index.band || 20;
  const have = Object.keys(index.bands || {}).map(Number).sort((a, b) => b - a);
  const wanted = have.filter((f) => f <= Math.floor(unit / size) * size).slice(0, 4);
  const loaded = await Promise.all(wanted.map((f) => fetchFeedBand(f)));
  return {
    index,
    items: loaded.flatMap((b) => b.items || []).filter((i) => i.he && i.at <= unit).map(asPage),
  };
}

/* The picture index: one small file naming a photograph for every word that
   has one. It is fetched once, beside the course, and a lesson that arrives
   before it does simply teaches without pictures. */
let imagesPromise = null;
export function fetchImages() {
  if (!imagesPromise) {
    imagesPromise = getJson(url("images.json")).catch(() => ({}));
  }
  return imagesPromise;
}

export const imageUrl = (file) => url(`img/${file}.webp`);

/* The recordings the build made, if the build was ever run: one small file
   naming an mp3 for every Hebrew line that has one. Same shape and same
   bargain as the picture index — it is fetched once, and a lesson that arrives
   before it does simply generates the voice the way it always has. */
let speechPromise = null;
export function fetchSpeech() {
  if (!speechPromise) {
    speechPromise = getJson(url("audio.json")).catch(() => ({}));
  }
  return speechPromise;
}

/* The index carries the file name, extension and all, because the format is
   not fixed: what the build downloads is mp3 and what survives the shrink is
   m4a, and the player should not have to know which. Entries written before
   the extension was recorded are still bare ids, so those keep the old
   assumption. */
export const speechUrl = (file) =>
  url(`audio/${String(file).includes(".") ? file : `${file}.mp3`}`);

/* The word index: every Hebrew word in the course against the unit it first
   appears in. It is what lets a learner who tested out of forty units count as
   having been taught their vocabulary — without it, a placement leaves the word
   map empty and every lesson afterwards teaches words they already know and
   treats readable sentences as too hard. Fetched once beside the course; a
   lesson that arrives before it does simply falls back to the word map. */
let lexiconPromise = null;
export function fetchLexicon() {
  if (!lexiconPromise) {
    lexiconPromise = getJson(url("lexicon.json")).catch(() => ({}));
  }
  return lexiconPromise;
}

export function fetchUnit(n) {
  if (units.has(n)) return Promise.resolve(units.get(n));
  if (unitPromises.has(n)) return unitPromises.get(n);
  const p = getJson(url(`unit-${String(n).padStart(3, "0")}.json`))
    .then((doc) => {
      units.set(n, doc);
      unitPromises.delete(n);
      return doc;
    })
    .catch((e) => {
      unitPromises.delete(n);
      throw e;
    });
  unitPromises.set(n, p);
  return p;
}

/* Whatever is already in hand — used to widen a word pool without waiting */
export const loadedUnits = () => [...units.values()];
export const peekUnit = (n) => units.get(n) || null;

/* A session wants its own unit plus a few before it, both for review material
   and for distractors that are plausible rather than absurd. */
export async function fetchUnitWindow(n, back = 3) {
  const wanted = [];
  for (let u = Math.max(1, n - back); u <= n; u++) wanted.push(u);
  const docs = await Promise.all(wanted.map((u) => fetchUnit(u).catch(() => null)));
  return docs.filter(Boolean);
}
