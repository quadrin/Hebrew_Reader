/* Persistent storage adapter.
   The original artifact used window.storage (Claude runtime); on the open web
   we back the same async API with localStorage, falling back to in-memory
   storage when localStorage is unavailable (private mode, sandboxed iframe). */

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

export const storageAvailable = !!ls;

export const storage = {
  async get(key) {
    const v = ls ? ls.getItem(key) : mem.has(key) ? mem.get(key) : null;
    return v == null ? null : { value: v };
  },
  async set(key, value) {
    if (ls) ls.setItem(key, value); /* may throw QuotaExceededError — callers handle */
    else mem.set(key, value);
  },
  async delete(key) {
    if (ls) ls.removeItem(key);
    else mem.delete(key);
  },
};
