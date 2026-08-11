/* Persistent storage adapter.

   Books are the big things this app keeps, and localStorage's ~5 MB ceiling
   filled up after a handful of them — past that, imports fell back to
   "this session only". So the store is IndexedDB now, which browsers grant
   orders of magnitude more room, with localStorage kept as a fallback and an
   in-memory map as the last resort (private mode, sandboxed iframe).

   The API is unchanged and still async: get() resolves to {value} or null.

   Anything already in localStorage is moved across on first run. The API
   keys stay put: ai.js and library.js read them synchronously at import
   time, so they must remain where those modules look for them. */

const DB_NAME = "lavan";
const STORE = "kv";
const MIGRATED_FLAG = "lavan-idb-migrated";

/* App data this module owns and will move into IndexedDB */
const OWNED = /^lavan-(hebrew-reader-v1$|book-|nikkud-|simple-)/;

const mem = new Map();

let ls = null;
try {
  ls = window.localStorage;
  const probe = "__lavan_probe__";
  ls.setItem(probe, "1");
  ls.removeItem(probe);
} catch (e) {
  ls = null;
}

/* Updated once the backend is known; App reads it to decide whether an
   imported book can be kept past this session. */
export let storageAvailable = !!ls;

const req = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

function openDb() {
  return new Promise((resolve, reject) => {
    let open;
    try { open = window.indexedDB.open(DB_NAME, 1); } catch (e) { return reject(e); }
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE);
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error("indexeddb blocked"));
  });
}

const idb = {
  db: null,
  async get(key) {
    const tx = this.db.transaction(STORE, "readonly");
    const v = await req(tx.objectStore(STORE).get(key));
    return v === undefined ? null : { value: v };
  },
  async set(key, value) {
    const tx = this.db.transaction(STORE, "readwrite");
    await req(tx.objectStore(STORE).put(value, key));
  },
  async delete(key) {
    const tx = this.db.transaction(STORE, "readwrite");
    await req(tx.objectStore(STORE).delete(key));
  },
};

const local = {
  async get(key) { const v = ls.getItem(key); return v == null ? null : { value: v }; },
  async set(key, value) { ls.setItem(key, value); /* may throw QuotaExceededError — callers handle */ },
  async delete(key) { ls.removeItem(key); },
};

const memory = {
  async get(key) { return mem.has(key) ? { value: mem.get(key) } : null; },
  async set(key, value) { mem.set(key, value); },
  async delete(key) { mem.delete(key); },
};

/* Copy this module's keys out of localStorage, then reclaim the space — but
   only after each value has been read back intact, so a failure part-way
   through leaves the originals untouched. */
async function migrate() {
  if (!ls || ls.getItem(MIGRATED_FLAG)) return;
  const keys = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && OWNED.test(k)) keys.push(k);
  }
  const moved = [];
  for (const k of keys) {
    const value = ls.getItem(k);
    if (value == null) continue;
    try {
      await idb.set(k, value);
      const back = await idb.get(k);
      if (back?.value === value) moved.push(k);
    } catch (e) {
      /* out of room or a bad record — leave this one in localStorage */
    }
  }
  try {
    ls.setItem(MIGRATED_FLAG, String(moved.length));
    for (const k of moved) ls.removeItem(k);
  } catch (e) {}
}

let backend = null;
let initPromise = null;

async function init() {
  try {
    idb.db = await openDb();
    await migrate();
    storageAvailable = true;
    return idb;
  } catch (e) {
    storageAvailable = !!ls;
    return ls ? local : memory;
  }
}

function ready() {
  if (backend) return Promise.resolve(backend);
  if (!initPromise) initPromise = init().then((b) => (backend = b));
  return initPromise;
}

/* A write that outgrows IndexedDB's quota shouldn't lose what the user
   already had — surface it the way the old localStorage path did. */
export const storage = {
  async get(key) {
    const b = await ready();
    try { return await b.get(key); } catch (e) { return null; }
  },
  async set(key, value) {
    const b = await ready();
    return b.set(key, value);
  },
  async delete(key) {
    const b = await ready();
    try { return await b.delete(key); } catch (e) {}
  },
  ready,
};
