/* Automatic sync, without a server.

   The app has nowhere of its own to keep anything, so progress lived on the
   device — which means a phone and a laptop knew nothing about each other, and
   clearing the browser's data threw away months of work. Both are the same
   problem: there is no copy anywhere else.

   The copy goes in a **private GitHub gist**. It is free, it belongs to the
   person using it rather than to this app, it is durable in a way a browser
   cache is not, and it needs no backend to run. The device holds a token with
   nothing but gist access; everything else about the account stays out of
   reach.

   Sync is pull, merge, push — and because `mergeProgress` is order-independent
   and idempotent, two devices that both went offline and both did lessons
   converge on the union of the two rather than one overwriting the other. */

import { collectProgress, applyProgress, mergeDuo, mergeReader, summarise } from "./sync.js";
import { reloadDuo } from "./duo/state.js";

const TOKEN_KEY = "lavan-api-key-github";
const GIST_KEY = "lavan-gist-id";
const SEEN_KEY = "lavan-gist-seen";      /* what we last pushed, to avoid loops */
const FILE = "lavan-progress.json";
const DESCRIPTION = "Duchifat — Hebrew progress (synced by the app; safe to delete)";
const API = "https://api.github.com";

const safeGet = (k) => { try { return window.localStorage.getItem(k); } catch (e) { return null; } };
const safeSet = (k, v) => { try { window.localStorage.setItem(k, v); } catch (e) {} };
const safeDel = (k) => { try { window.localStorage.removeItem(k); } catch (e) {} };

export const getToken = () => safeGet(TOKEN_KEY) || "";
export const getGistId = () => safeGet(GIST_KEY) || "";
export const isConnected = () => !!getToken();

export function disconnect() {
  safeDel(TOKEN_KEY);
  safeDel(GIST_KEY);
  safeDel(SEEN_KEY);
  emit();
}

/* ------------------------------------------------------------------ */
/* Status, for the screen to show                                      */
/* ------------------------------------------------------------------ */
let status = { state: "idle", at: 0, error: "", pushing: false };
const listeners = new Set();
const emit = () => { for (const l of listeners) l(); };

export const cloudStatus = () => status;
export function onCloudChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function setStatus(patch) {
  status = { ...status, ...patch };
  emit();
}

/* ------------------------------------------------------------------ */
/* GitHub                                                              */
/* ------------------------------------------------------------------ */
class CloudError extends Error {}

async function api(path, { method = "GET", body, token = getToken() } = {}) {
  if (!token) throw new CloudError("no GitHub token set");
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new CloudError("couldn't reach GitHub — offline?");
  }
  if (res.status === 401) throw new CloudError("GitHub rejected that token");
  if (res.status === 403) throw new CloudError("that token isn't allowed to use gists");
  if (res.status === 404) throw new CloudError("that gist is gone");
  if (!res.ok) throw new CloudError(`GitHub returned ${res.status}`);
  return res.status === 204 ? null : res.json();
}

/* The gist this app owns: remembered by id, and otherwise found by its
   filename among the account's gists — so a device that has lost its local
   data reconnects to the same one instead of starting a second. */
async function findGist(token) {
  const remembered = getGistId();
  if (remembered) {
    try {
      const g = await api(`/gists/${remembered}`, { token });
      if (g?.files?.[FILE]) return g;
    } catch (e) { /* deleted or not ours any more — look again */ }
  }
  for (let page = 1; page <= 3; page++) {
    const list = await api(`/gists?per_page=100&page=${page}`, { token });
    if (!list?.length) break;
    const found = list.find((g) => g.files?.[FILE]);
    if (found) {
      safeSet(GIST_KEY, found.id);
      return api(`/gists/${found.id}`, { token });
    }
    if (list.length < 100) break;
  }
  return null;
}

async function createGist(blob, token) {
  const g = await api("/gists", {
    method: "POST",
    token,
    body: {
      description: DESCRIPTION,
      public: false,
      files: { [FILE]: { content: JSON.stringify(blob, null, 1) } },
    },
  });
  safeSet(GIST_KEY, g.id);
  return g;
}

const readGist = (g) => {
  const raw = g?.files?.[FILE]?.content;
  if (!raw) return null;
  try {
    const blob = JSON.parse(raw);
    return blob?.app === "lavan" ? blob : null;
  } catch (e) { return null; }
};

/* ------------------------------------------------------------------ */
/* The loop                                                            */
/* ------------------------------------------------------------------ */
let running = null;

/* Merge two collected blobs, whichever way round they arrive. */
function mergeBlobs(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    app: "lavan",
    format: Math.max(a.format || 1, b.format || 1),
    at: new Date().toISOString(),
    duo: mergeDuo(a.duo, b.duo),
    reader: a.reader || b.reader ? mergeReader(a.reader || {}, b.reader || {}) : null,
  };
}

/* A stable fingerprint of what matters, so an unchanged save is not pushed
   every two minutes for no reason. */
const fingerprint = (blob) => {
  const d = blob?.duo || {};
  const r = blob?.reader || {};
  return JSON.stringify([
    d.xp, d.streak, d.lastLesson,
    Object.keys(d.lessons || {}).length, Object.keys(d.words || {}).length,
    Object.values(d.lessons || {}).reduce((x, y) => x + y, 0),
    d.stats?.answered, Object.keys(r.saved || {}).length, Object.keys(r.courseProgress || {}).length,
  ]);
};

/* One round trip. Returns what changed, so the caller can refresh the parts of
   the screen that need it. */
export async function syncNow({ reason = "manual" } = {}) {
  if (!isConnected()) return { skipped: "not connected" };
  if (running) return running;

  running = (async () => {
    setStatus({ state: "syncing", error: "" });
    try {
      const mine = await collectProgress();
      let gist = await findGist();
      if (!gist) {
        await createGist(mine, getToken());
        safeSet(SEEN_KEY, fingerprint(mine));
        setStatus({ state: "ok", at: Date.now() });
        return { created: true, pushed: true, pulled: false, changedLocal: false };
      }

      const theirs = readGist(gist);
      const merged = mergeBlobs(mine, theirs);
      const changedLocal = fingerprint(merged) !== fingerprint(mine);
      const changedRemote = fingerprint(merged) !== fingerprint(theirs);

      if (changedLocal) {
        await applyProgress(merged, { mode: "replace" });
        /* The path keeps its save in memory and writes it back on every
           change, so a pull that only touched storage would be undone by the
           next answered question. Re-read it here, once, for every caller. */
        await reloadDuo();
      }
      if (changedRemote) {
        await api(`/gists/${getGistId()}`, {
          method: "PATCH",
          body: { description: DESCRIPTION, files: { [FILE]: { content: JSON.stringify(merged, null, 1) } } },
        });
      }
      safeSet(SEEN_KEY, fingerprint(merged));
      setStatus({ state: "ok", at: Date.now() });
      return {
        pulled: changedLocal,
        pushed: changedRemote,
        changedLocal,
        summary: summarise(merged),
        reason,
      };
    } catch (e) {
      setStatus({ state: "error", error: e.message || "sync failed" });
      return { error: e.message || "sync failed" };
    } finally {
      running = null;
    }
  })();

  return running;
}

/* Connecting: check the token can actually write a gist before keeping it,
   then take whatever is already up there. */
export async function connect(token) {
  const clean = String(token || "").trim();
  if (!clean) throw new CloudError("paste a token first");
  const me = await api("/user", { token: clean });        /* 401s early on a bad token */
  const existing = await findGist(clean);
  if (!existing) {
    const mine = await collectProgress();
    await createGist(mine, clean);
  }
  safeSet(TOKEN_KEY, clean);
  const result = await syncNow({ reason: "connect" });
  return { login: me?.login || "", ...result };
}

/* ------------------------------------------------------------------ */
/* When to sync                                                        */
/* ------------------------------------------------------------------ */
/* On open, when the tab goes away or comes back, after anything that changed
   progress, and on a slow timer as a backstop. Everything funnels through a
   short debounce so a burst of finished exercises is one push. */
let pending = null;

export function syncSoon({ reason = "change", delay = 4000 } = {}) {
  if (!isConnected()) return;
  clearTimeout(pending);
  pending = setTimeout(() => syncNow({ reason }), delay);
}

export function startAutoSync({ onPulled } = {}) {
  if (!isConnected()) return () => {};

  const run = async (reason) => {
    const r = await syncNow({ reason });
    if (r?.changedLocal) onPulled?.(r);
  };

  run("open");
  const timer = setInterval(() => run("timer"), 5 * 60 * 1000);
  const onVisible = () => {
    if (document.visibilityState === "visible") run("focus");
    else syncNow({ reason: "hide" });      /* leaving: push what this device did */
  };
  const onLeave = () => { syncSoon({ reason: "unload", delay: 0 }); };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("pagehide", onLeave);

  return () => {
    clearInterval(timer);
    clearTimeout(pending);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("pagehide", onLeave);
  };
}

export const gistUrl = () => (getGistId() ? `https://gist.github.com/${getGistId()}` : "");
