/* Download for offline — the rest of the course, kept on the device.

   The service worker precaches the app, the curriculum and every index, so
   the reader opens on a plane. What it does not precache is what is too big
   to push at every first visit: the 240 unit files, the reading feed, 1,700
   pictures, the shelf's books and — biggest of all — the recordings. Those are
   cached one at a time as they come up, which is right for someone online and
   leaves someone offline with a path whose next lesson will not open.

   This is the learner's way to ask for all of it at once. The files are put
   straight into the same caches the service worker's runtime routes read
   from (see vite.config.js — the names must match), so a file downloaded
   here is served exactly as if it had been fetched in a lesson. Putting them
   in directly, rather than fetching through the worker, means the count is
   true the moment a file lands and nothing waits for the worker to take
   control of the page.

   Once asked for, the download is kept topped up: a new build can drop the
   unit and feed caches (data.js does, when the course has changed under
   them), and the next launch with a connection quietly fetches what is
   missing. */

import { useSyncExternalStore } from "react";
import { fetchCourse, fetchFeedIndex, fetchImages, fetchSpeech, imageUrl, speechUrl } from "./duo/data.js";
import { fetchShelfIndex } from "./library.js";
import { PDFJS_URL, PDFJS_WORKER } from "./pdf.js";

const PREF = "duchifat-offline";
const WORKERS = 6;

/* What vite.config.js computed from public/ at build time; absent in the
   single-file build, which has no service worker to serve a download from. */
export const OFFLINE_SIZES =
  typeof __OFFLINE_SIZES__ !== "undefined" ? __OFFLINE_SIZES__ : { core: 0, audio: 0 };

const local = (path) => new URL(path, document.baseURI).href;

/* Which runtime cache a file belongs in — the same routes vite.config.js
   gives the service worker. */
function cacheFor(url) {
  const { pathname, origin } = new URL(url);
  if (origin !== location.origin) return "lavan-pdfjs";
  if (/\/duo\/unit-\d+\.json$/.test(pathname)) return "lavan-duo-units";
  if (/\/duo\/feed\/\d+\.json$/.test(pathname)) return "lavan-duo-feed";
  if (/\/duo\/img\/[^/]+\.webp$/.test(pathname)) return "lavan-duo-pictures";
  if (/\/duo\/audio\/[^/]+\.(mp3|m4a)$/.test(pathname)) return "lavan-duo-audio";
  if (/\/shelf\/\d+\.json$/.test(pathname)) return "lavan-shelf-books";
  return null;
}

const CACHES = [
  "lavan-duo-units", "lavan-duo-feed", "lavan-duo-pictures",
  "lavan-duo-audio", "lavan-shelf-books", "lavan-pdfjs",
];

/* ---------- the learner's choice ---------- */

export function offlinePref() {
  try {
    return JSON.parse(localStorage.getItem(PREF) || "null");
  } catch {
    return null;
  }
}

function setPref(v) {
  try {
    if (v) localStorage.setItem(PREF, JSON.stringify(v));
    else localStorage.removeItem(PREF);
  } catch {
    /* without localStorage the download still happens; it just isn't topped up */
  }
}

/* ---------- state the settings sheet watches ---------- */

let state = { phase: "idle", done: 0, total: 0, failed: 0, msg: "" };
const listeners = new Set();
const set = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const useOffline = () => useSyncExternalStore(subscribe, () => state, () => state);

/* Only where a service worker is actually running this page — not in the
   dev server, and not in the single-file build opened from disk. */
export async function offlineSupported() {
  try {
    if (typeof caches === "undefined" || !navigator.serviceWorker) return false;
    return !!(await navigator.serviceWorker.getRegistration());
  } catch {
    return false;
  }
}

/* ---------- what the download is ---------- */

async function packList(audio) {
  const [course, feed, images, speech, shelf] = await Promise.all([
    fetchCourse(),
    fetchFeedIndex(),
    fetchImages(),
    audio ? fetchSpeech() : {},
    fetchShelfIndex().catch(() => null),
  ]);
  /* fetchImages and fetchSpeech answer {} rather than fail; an empty index
     here means the connection dropped, not that there is nothing to get */
  if (!Object.keys(images).length || (audio && !Object.keys(speech).length)) {
    throw new Error("couldn't reach the course — check your connection");
  }
  const urls = new Set();
  for (const u of course.units || []) urls.add(local(`duo/unit-${String(u.unit).padStart(3, "0")}.json`));
  for (const from of Object.keys(feed.bands || {})) urls.add(local(`duo/feed/${from.padStart(3, "0")}.json`));
  for (const e of Object.values(images)) if (e?.f) urls.add(imageUrl(e.f));
  for (const f of Object.values(speech)) if (f) urls.add(speechUrl(f));
  for (const b of shelf?.books || []) urls.add(local(`shelf/${b.id}.json`));
  urls.add(PDFJS_URL);
  urls.add(PDFJS_WORKER);
  return [...urls];
}

async function alreadyKept() {
  const have = new Set();
  for (const name of CACHES) {
    if (!(await caches.has(name))) continue;
    const cache = await caches.open(name);
    for (const req of await cache.keys()) have.add(req.url);
  }
  return have;
}

async function keep(url) {
  const cache = await caches.open(cacheFor(url));
  if (new URL(url).origin === location.origin) {
    await cache.add(url);
  } else {
    /* pdf.js is loaded by a <script> tag, which asks for it without CORS;
       the copy kept has to be the same opaque kind or it won't match */
    await cache.put(url, await fetch(url, { mode: "no-cors" }));
  }
}

/* ---------- doing it ---------- */

let run = 0;

async function download({ audio, quiet }) {
  const mine = ++run;
  set({ phase: "checking", done: 0, total: 0, failed: 0, msg: "" });
  try {
    /* ask the browser not to clear this under storage pressure — a
       download that vanishes the week before a flight is worse than none */
    await navigator.storage?.persist?.().catch(() => {});
    const urls = await packList(audio);
    const have = await alreadyKept();
    const missing = urls.filter((u) => !have.has(u));
    const total = urls.length;
    let done = total - missing.length;
    let failed = 0;
    if (mine !== run) return;
    set({ phase: missing.length ? "downloading" : "done", done, total });

    let next = 0;
    const worker = async () => {
      while (mine === run && next < missing.length) {
        const url = missing[next++];
        try {
          await keep(url);
          done++;
        } catch (e) {
          failed++;
          if (e?.name === "QuotaExceededError") {
            run++; /* stops every worker */
            throw e;
          }
        }
        set({ done, failed });
      }
    };
    await Promise.all(Array.from({ length: WORKERS }, worker));
    if (mine !== run) return;
    set({
      phase: failed ? "partial" : "done",
      msg: failed
        ? `${failed.toLocaleString()} file${failed === 1 ? "" : "s"} didn't come through — try again on a steadier connection.`
        : "",
    });
  } catch (e) {
    if (quiet) {
      set({ phase: "idle" });
      return;
    }
    set({
      phase: "error",
      msg: e?.name === "QuotaExceededError"
        ? "This device ran out of room for the download. Free some space, or download without the recordings."
        : e?.message || "the download stopped",
    });
  }
}

export function startOfflineDownload(audio) {
  setPref({ audio: !!audio });
  return download({ audio: !!audio });
}

export function cancelOfflineDownload() {
  run++;
  setPref(null);
  set({ phase: "idle", msg: "" });
}

/* Throws away what the download kept — and what lessons had cached on their
   own, which is the same files. They come back as they are used. */
export async function removeOfflineDownload() {
  run++;
  setPref(null);
  await Promise.all(CACHES.map((name) => caches.delete(name)));
  set({ phase: "idle", done: 0, total: 0, failed: 0, msg: "" });
}

/* How much of the download is on the device now — for the settings sheet to
   show on opening, without starting anything. */
export async function checkOfflineDownload() {
  const pref = offlinePref();
  if (!pref || state.phase === "downloading" || state.phase === "checking") return;
  try {
    const urls = await packList(pref.audio);
    const have = await alreadyKept();
    const done = urls.filter((u) => have.has(u)).length;
    set({ phase: done === urls.length ? "done" : "partial", done, total: urls.length, failed: 0 });
  } catch {
    /* offline: say nothing rather than guess */
  }
}

/* On launch, with a connection: fetch whatever a new build has dropped or
   added since the download, so it stays whole without being asked again. */
export async function resumeOfflineDownload() {
  const pref = offlinePref();
  if (!pref || !navigator.onLine || !(await offlineSupported())) return;
  return download({ audio: !!pref.audio, quiet: true });
}
