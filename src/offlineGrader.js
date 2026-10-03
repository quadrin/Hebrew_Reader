import { PACK_CACHE, PACK_VERSION, PREF_KEY, PACK_BYTES, RUNTIME_FILES, packFiles, validGradingInput, GRADING_TIMEOUT_MS, PREPARE_TIMEOUT_MS } from './localGrader/config.js';
import { hasCompletePack, cacheFile } from './localGrader/cache.js';

const readPref = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || 'null'); } catch { return null; } };
let pref = readPref();
let state = { phase: 'idle', enabled: pref?.enabled === true, progress: 0, message: '', installing: false };
const listeners = new Set();
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn()); };
const save = (value) => { pref = value; try { localStorage.setItem(PREF_KEY, JSON.stringify(value)); } catch { /* this tab still works */ } };
export const subscribeOfflineGrader = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getOfflineGraderSnapshot = () => state;
const baseUrl = () => new URL('.', document.baseURI).href;
let initialized;
let run = 0;
let download;
let worker;
let seq = 0;
const pending = new Map();
let grading;
function stopWorker() {
  worker?.terminate(); worker = null;
  for (const { reject } of pending.values()) reject(new Error('Offline check stopped. Use the reference answer.'));
  pending.clear();
}
function request(type, input, timeout) {
  if (!worker) {
    worker = new Worker(new URL('./localGrader/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      if (data.error) job.reject(new Error(data.error)); else job.resolve(data.result);
    };
    worker.onerror = () => stopWorker();
  }
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Offline check took too long. Use the reference answer.')); stopWorker(); }, timeout);
    const finish = (fn) => (result) => { clearTimeout(timer); fn(result); };
    pending.set(id, { resolve: finish(resolve), reject: finish(reject) });
    worker.postMessage({ id, type, input, baseUrl: baseUrl() });
  });
}
async function supported() {
  if (!globalThis.isSecureContext || !globalThis.caches || !globalThis.Worker || !navigator.gpu || !navigator.serviceWorker || !RUNTIME_FILES.length) {
    throw new Error('Offline AI needs a current WebGPU browser and the web app. On iPhone, update iOS if WebGPU is unavailable. The regular offline exercises still work.');
  }
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.active || !navigator.serviceWorker.controller) throw new Error('Open the web app online once, then reload it to finish offline setup.');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter?.features.has('shader-f16')) throw new Error('This device does not provide WebGPU shader-f16. The regular offline exercises still work.');
}
export function initOfflineGrader() {
  if (initialized) return initialized;
  const mine = run;
  initialized = (async () => {
    try { await supported(); } catch (error) {
      if (mine === run) set({ phase: 'unsupported', message: error.message });
      return false;
    }
    if (mine !== run) return false;
    if (pref?.version !== PACK_VERSION) { set({ phase: 'idle', enabled: false }); return false; }
    set({ phase: 'checking' });
    try {
      const complete = await hasCompletePack(await caches.open(PACK_CACHE), packFiles(baseUrl()));
      if (mine !== run) return false;
      set({ phase: complete ? 'ready' : 'error', progress: complete ? 100 : 0, message: complete ? '' : 'Some offline files were removed by the browser. Reconnect and download again.' });
      return complete;
    } catch {
      if (mine === run) set({ phase: 'error', message: 'Offline storage is unavailable. The regular answer checker still works.' });
      return false;
    }
  })();
  return initialized;
}
export async function downloadOfflineGrader() {
  if (download) return;
  const mine = ++run;
  const controller = new AbortController();
  download = controller;
  set({ phase: 'checking', progress: 0, message: '', installing: true });
  try {
    await supported();
    if (navigator.onLine === false) throw new Error('Reconnect to download the offline model.');
    const files = packFiles(baseUrl());
    const cache = await caches.open(PACK_CACHE);
    const estimate = await navigator.storage?.estimate?.();
    let missing = 0;
    for (const f of files) if (!(await hasCompletePack(cache, [f]))) missing += f.size;
    if (estimate?.quota && estimate.quota - (estimate.usage || 0) < missing + 50 * 1024 * 1024) throw new Error('Not enough browser storage. Free some space before downloading the model.');
    await navigator.storage?.persist?.().catch(() => {});
    if (mine !== run) return;
    set({ phase: 'downloading' });
    let complete = 0;
    for (const file of files) {
      if (mine !== run) return;
      await cacheFile(cache, file, { signal: controller.signal, onProgress: (bytes) => {
        if (mine === run) set({ progress: Math.min(99, Math.floor((complete + bytes) / PACK_BYTES * 100)) });
      } });
      complete += file.size;
    }
    if (mine !== run) return;
    if (!(await hasCompletePack(cache, files))) throw new Error('The download is incomplete. Please retry.');
    set({ phase: 'loading', progress: 100, message: 'Testing the model on this device. This may take a minute…' });
    await request('prepare', null, PREPARE_TIMEOUT_MS);
    if (mine !== run) return;
    save({ version: PACK_VERSION, enabled: true });
    initialized = Promise.resolve(true);
    set({ phase: 'ready', enabled: true, message: '' });
  } catch (error) {
    if (mine === run) {
      stopWorker();
      set({ phase: 'error', message: error.name === 'QuotaExceededError' ? 'The browser ran out of storage. Free some space and retry.' : error.message || 'The download could not finish.' });
    }
  } finally { if (download === controller) { download = null; set({ installing: false }); } }
}
export function cancelOfflineGraderDownload() {
  ++run; download?.abort(); download = null; stopWorker(); initialized = null;
  set({ phase: 'idle', progress: 0, installing: false, message: 'Download cancelled. Completed files can be reused when you retry.' });
}
export function setOfflineGraderEnabled(enabled) {
  save({ ...pref, enabled: !!enabled });
  if (!enabled) ++run; // Invalidates an answer already running in the worker.
  set({ enabled: !!enabled, ...(!enabled && ['loading', 'grading'].includes(state.phase) ? { phase: 'ready' } : {}) });
  if (!enabled) stopWorker();
}
export async function removeOfflineGrader() {
  cancelOfflineGraderDownload();
  const mine = ++run;
  save(null); set({ enabled: false, phase: 'checking' });
  try {
    await caches.delete(PACK_CACHE);
    if (mine === run) set({ phase: 'idle', progress: 0, message: '' });
  } catch {
    if (mine === run) set({ phase: 'error', message: 'Offline grading is off, but its files could not be removed. Please retry.' });
  }
}
export async function gradeOfflineAnswer(input) {
  if (!state.enabled || !validGradingInput(input) || input.signal?.aborted) return null;
  if (grading) return null; // No queue of stale mobile GPU work.
  const mine = run;
  grading = (async () => {
    if (!(await initOfflineGrader()) || mine !== run || !state.enabled) return null;
    try {
      if (!(await hasCompletePack(await caches.open(PACK_CACHE), packFiles(baseUrl())))) throw new Error('Offline files are missing. Reconnect and download again.');
      if (mine !== run || !state.enabled || input.signal?.aborted) return null;
      set({ phase: worker ? 'grading' : 'loading', message: '' });
      const abort = () => stopWorker();
      input.signal?.addEventListener('abort', abort, { once: true });
      try {
        const result = await request('grade', { he: input.he, en: input.en, given: input.given, lang: input.lang }, GRADING_TIMEOUT_MS);
        if (mine !== run || !state.enabled || input.signal?.aborted) return null;
        set({ phase: 'ready', message: result ? '' : 'Offline AI was unsure. Use the reference answer or self-check.' });
        return result;
      } finally { input.signal?.removeEventListener('abort', abort); }
    } catch (error) {
      if (mine === run) { stopWorker(); set({ phase: 'error', message: error.message }); }
      return null;
    }
  })();
  try { return await grading; } finally { grading = null; }
}
