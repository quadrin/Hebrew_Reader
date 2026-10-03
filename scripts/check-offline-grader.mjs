/* Deterministic contract tests: no API key, model download, or real inference.
   Run: node scripts/check-offline-grader.mjs
   Worker inference and browser capability/storage are deliberately mocked.
   These checks establish routing and lifecycle behavior, not model accuracy. */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
async function until(predicate) {
  for (let i = 0; i < 100 && !predicate(); ++i) await tick();
  assert(predicate(), 'Mock operation did not reach its expected checkpoint');
}

// A tiny runtime fixture makes capability and lifecycle tests independent of
// Vite's build-time manifest. Model entries below use metadata-only fixtures.
globalThis.__OFFLINE_AI_RUNTIME_FILES__ = [{ path: 'offline-ai/test.wasm', size: 4 }];
const config = await import('../src/localGrader/config.js');
const { validGradingInput, rulingFromMargin, ACCEPT_MARGIN, packFiles, PACK_CACHE, PACK_VERSION, PREF_KEY, MODEL_ID, MODEL_REVISION, MODEL_DTYPE } = config;
const { cacheFile, hasCompletePack } = await import('../src/localGrader/cache.js');
const { createTextRulingRouter } = await import('../src/answerRuling.js');
const network = await import('../src/connectivity.js');
const input = { he: 'אני כאן', en: 'I am here', given: 'I am over here', lang: 'en' };
const localResult = { accept: true, why: 'Same meaning.', source: 'local', persist: false };
const fixtureBase = 'https://test.invalid/duchifat/';
const files = packFiles(fixtureBase);

class MemoryCache {
  entries = new Map();
  async match(url) { return this.entries.get(String(url))?.clone(); }
  async put(url, response) {
    // Cache.put is atomic: a failed response stream must never be committed.
    const body = await response.arrayBuffer();
    this.entries.set(String(url), new Response(body, { status: response.status, headers: response.headers }));
  }
  async delete(url) { return this.entries.delete(String(url)); }
}
const cached = (file) => new Response('fixture', { headers: { 'x-duchifat-bytes': String(file.size) } });
const completeCache = () => { const cache = new MemoryCache(); files.forEach((file) => cache.entries.set(file.url, cached(file))); return cache; };
function routing(overrides = {}) {
  const calls = [];
  const hooks = {
    offline: () => false, hasKey: () => true,
    cloud: async (value) => { calls.push(['cloud', value]); return { accept: true, why: 'Cloud result' }; },
    local: async (value) => { calls.push(['local', value]); return localResult; },
    failed: () => calls.push(['failed']), succeeded: () => calls.push(['succeeded']),
    ...overrides,
  };
  return { calls, hooks, route: createTextRulingRouter(hooks) };
}

test('online routing preserves cloud payload and marks cloud alternatives persistable', async () => {
  const { route, calls } = routing();
  assert.deepEqual(await route(input), { accept: true, why: 'Cloud result', source: 'cloud', persist: true });
  assert.deepEqual(calls.map(([kind]) => kind), ['cloud', 'succeeded']);
  assert.equal(calls[0][1], input);
});
test('known offline goes straight to local, with no key or cloud probe', async () => {
  const { route, calls } = routing({ offline: () => true, hasKey: () => { throw new Error('Must not inspect cloud key'); } });
  assert.equal(await route(input), localResult);
  assert.deepEqual(calls.map(([kind]) => kind), ['local']);
});
test('online without a key does not silently switch to local', async () => {
  const { route, calls } = routing({ hasKey: () => false });
  assert.equal(await route(input), null);
  assert.deepEqual(calls, []);
});
for (const name of ['TypeError', 'TimeoutError']) test(`${name} transport failure falls back locally once`, async () => {
  const err = Object.assign(new Error('transport unavailable'), { name });
  const { route, calls } = routing({ cloud: async () => { calls.push(['cloud']); throw err; } });
  assert.equal(await route(input), localResult);
  assert.deepEqual(calls.map(([kind]) => kind), ['cloud', 'failed', 'local']);
});
test('typing/prefetch allowLocal:false never starts local after failure or while offline', async () => {
  for (const offline of [false, true]) {
    const { route, calls } = routing({ offline: () => offline, cloud: async () => { throw new TypeError('network'); } });
    assert.equal(await route({ ...input, allowLocal: false }), null);
    assert(!calls.some(([kind]) => kind === 'local'));
  }
});
for (const status of [401, 403, 429, 500]) test(`HTTP ${status} is not treated as offline`, async () => {
  const error = Object.assign(new Error('API error'), { status });
  const { route, calls } = routing({ cloud: async () => { throw error; } });
  await assert.rejects(route(input), (value) => value === error);
  assert.deepEqual(calls, []);
});
test('aborted requests neither start work nor turn a cancellation into local inference', async () => {
  const controller = new AbortController(); controller.abort();
  const first = routing();
  assert.equal(await first.route({ ...input, signal: controller.signal }), null);
  assert.deepEqual(first.calls, []);
  const during = new AbortController();
  const later = routing({ cloud: async () => { during.abort(); throw new TypeError('cancelled'); } });
  await assert.rejects(later.route({ ...input, signal: during.signal }), /cancelled/);
  assert.deepEqual(later.calls, []);
});
test('network failure cooldown suppresses repeated cloud calls, online success clears it', async () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  network.noteGradingNetworkSuccess();
  assert.equal(network.isGradingOffline(), false);
  network.noteGradingNetworkFailure();
  assert.equal(network.isGradingOffline(), true);
  assert.equal(network.isGradingOffline(Date.now() + 30001), false);
  network.noteGradingNetworkSuccess();
  assert.equal(network.isGradingOffline(), false);
  let cloudCalls = 0; let localCalls = 0;
  const route = createTextRulingRouter({ offline: network.isGradingOffline, hasKey: () => true,
    cloud: async () => { cloudCalls++; throw new TypeError('network unavailable'); },
    local: async () => { localCalls++; return localResult; },
    failed: network.noteGradingNetworkFailure, succeeded: network.noteGradingNetworkSuccess,
  });
  await route(input); await route(input);
  assert.equal(cloudCalls, 1, 'The second answer must not repeat a known-failing cloud transport');
  assert.equal(localCalls, 2);
  network.noteGradingNetworkSuccess();
  navigator.onLine = false;
  assert.equal(network.isGradingOffline(), true);
  assert.equal(network.isTransportFailure(Object.assign(new Error(), { name: 'AbortError' })), false);
});
test('local validation abstains on missing references, unsupported or Hebrew-answer direction, and long/control text', async () => {
  assert.equal(validGradingInput(input), true);
  const bad = [undefined, {}, { ...input, he: '' }, { ...input, en: '  ' }, { ...input, given: '' },
    { ...input, lang: 'speech' }, { ...input, en: 'x'.repeat(401) }, { ...input, given: 'x\u0000y' },
    { ...input, given: 'אני פה', lang: 'he' }];
  for (const value of bad) assert.equal(validGradingInput(value), false);
  for (const value of bad.filter(Boolean)) {
    const { route, calls } = routing({ offline: () => true });
    assert.equal(await route(value), null);
    assert.deepEqual(calls, []);
  }
});
test('score rule accepts only above the calibrated cut, abstains between, and never persists', () => {
  assert.deepEqual(Object.keys(ACCEPT_MARGIN), ['en'], 'Hebrew answers are not offered to the local model');
  assert.equal(rulingFromMargin(100, 'he'), null);
  for (const lang of Object.keys(ACCEPT_MARGIN)) {
    const cut = ACCEPT_MARGIN[lang];
    assert(Number.isFinite(cut) && cut > 0, `A positive cut-off is set for ${lang}`);
    const yes = rulingFromMargin(cut, lang);
    assert.equal(yes.accept, true); assert.equal(yes.source, 'local'); assert.equal(yes.persist, false);
    assert.equal(rulingFromMargin(cut - 0.01, lang), null, 'A YES below the cut must abstain');
    assert.equal(rulingFromMargin(0, lang), null);
    const no = rulingFromMargin(-0.01, lang);
    assert.equal(no.accept, false); assert.equal(no.persist, false);
  }
  for (const value of [NaN, Infinity, -Infinity, undefined, null, '20']) assert.equal(rulingFromMargin(value, 'en'), null);
  assert.equal(rulingFromMargin(100, 'speech'), null);
});

test('completed cache streams commit atomically and report monotonic byte progress', async () => {
  const cache = new MemoryCache(); const file = { url: 'https://test.invalid/a', size: 4 }; const progress = [];
  let downloads = 0;
  const fetcher = async (url, options) => {
    downloads++; assert.equal(url, file.url); assert.equal(options.credentials, 'omit');
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2])); controller.enqueue(new Uint8Array([3, 4])); controller.close(); } }));
  };
  await cacheFile(cache, file, { fetcher, onProgress: (n) => progress.push(n) });
  assert.deepEqual(progress, [2, 4]); assert.equal(await hasCompletePack(cache, [file]), true);
  await cacheFile(cache, file, { fetcher }); assert.equal(downloads, 1);
});
test('truncated and oversized downloads never become complete cache entries', async () => {
  for (const bytes of [2, 6]) {
    const cache = new MemoryCache(); const file = { url: 'https://test.invalid/b', size: 4 };
    await assert.rejects(cacheFile(cache, file, { fetcher: async () => new Response(new Uint8Array(bytes)) }), /Incomplete model file/);
    assert.equal(await hasCompletePack(cache, [file]), false); assert.equal(cache.entries.size, 0);
  }
});
test('cancelled stream retains previously completed files and does not commit partial file', async () => {
  const cache = new MemoryCache(); const good = { url: 'https://test.invalid/first', size: 2 }; const bad = { url: 'https://test.invalid/second', size: 4 };
  await cacheFile(cache, good, { fetcher: async () => new Response(new Uint8Array(2)) });
  const controller = new AbortController();
  await assert.rejects(cacheFile(cache, bad, { signal: controller.signal,
    fetcher: async () => new Response(new ReadableStream({ start(stream) { stream.enqueue(new Uint8Array(2)); stream.enqueue(new Uint8Array(2)); stream.close(); } })),
    onProgress: () => controller.abort(),
  }), (error) => error.name === 'AbortError');
  assert.equal(await hasCompletePack(cache, [good]), true);
  assert.equal(await hasCompletePack(cache, [good, bad]), false);
});
test('cache completion rejects missing, evicted, wrong-sized, and error responses', async () => {
  const cache = new MemoryCache(); const file = { url: 'https://test.invalid/c', size: 4 };
  assert.equal(await hasCompletePack(cache, []), false);
  assert.equal(await hasCompletePack(cache, [file]), false);
  cache.entries.set(file.url, new Response('body'));
  assert.equal(await hasCompletePack(cache, [file]), false);
  cache.entries.set(file.url, new Response('body', { headers: { 'x-duchifat-bytes': '3' } }));
  assert.equal(await hasCompletePack(cache, [file]), false);
  cache.entries.set(file.url, new Response('body', { status: 500, headers: { 'x-duchifat-bytes': '4' } }));
  assert.equal(await hasCompletePack(cache, [file]), false);
  cache.entries.set(file.url, cached(file)); assert.equal(await hasCompletePack(cache, [file]), true);
  await cache.delete(file.url); assert.equal(await hasCompletePack(cache, [file]), false);
});

let freshId = 0;
async function clientFixture({ pref = { version: PACK_VERSION, enabled: true }, cache = completeCache(), capability = true, persist = async () => false, estimate = async () => ({ quota: 2 ** 31, usage: 0 }), reply = (job) => job.type === 'prepare' ? true : localResult } = {}) {
  const storage = new Map(); if (pref) storage.set(PREF_KEY, JSON.stringify(pref));
  const workers = []; const jobs = []; const fetched = [];
  globalThis.document = { baseURI: fixtureBase };
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
  globalThis.isSecureContext = true;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    onLine: true, gpu: capability ? { requestAdapter: async () => ({ features: new Set(['shader-f16']) }) } : undefined,
    serviceWorker: { controller: {}, getRegistration: async () => ({ active: {} }) }, storage: { estimate, persist },
  } });
  globalThis.caches = { open: async () => cache, delete: async () => { cache.entries.clear(); return true; } };
  globalThis.fetch = async (url) => { fetched.push(String(url)); return new Response(new Uint8Array(4)); };
  globalThis.Worker = class {
    constructor() { workers.push(this); }
    postMessage(job) {
      jobs.push(job);
      if (reply) Promise.resolve(reply(job)).then((result) => { if (!this.terminated) this.onmessage?.({ data: { id: job.id, result } }); });
    }
    terminate() { this.terminated = true; }
  };
  const client = await import(`../src/offlineGrader.js?check=${++freshId}`);
  return { client, cache, storage, workers, jobs, fetched };
}
test('saved pack becomes ready without network and detects eviction before inference', async () => {
  const { client, cache, fetched, jobs } = await clientFixture();
  assert.equal(await client.initOfflineGrader(), true); assert.equal(client.getOfflineGraderSnapshot().phase, 'ready');
  assert.deepEqual(fetched, []);
  await cache.delete(files[0].url);
  assert.equal(await client.gradeOfflineAnswer(input), null);
  assert.equal(client.getOfflineGraderSnapshot().phase, 'error'); assert.match(client.getOfflineGraderSnapshot().message, /missing/);
  assert.deepEqual(jobs, []);
});
test('missing WebGPU and obsolete preference remain disabled/unavailable', async () => {
  let fixture = await clientFixture({ capability: false });
  assert.equal(await fixture.client.initOfflineGrader(), false); assert.equal(fixture.client.getOfflineGraderSnapshot().phase, 'unsupported');
  fixture = await clientFixture({ pref: { version: 'obsolete', enabled: true } });
  assert.equal(await fixture.client.initOfflineGrader(), false); assert.equal(fixture.client.getOfflineGraderSnapshot().enabled, false);
});
test('download reuses complete files, tolerates persist:false, validates worker before enabling', async () => {
  const cache = completeCache(); cache.entries.delete(files.at(-1).url);
  const fixture = await clientFixture({ pref: null, cache });
  await fixture.client.downloadOfflineGrader();
  assert.deepEqual(fixture.fetched, [files.at(-1).url]);
  assert.deepEqual(fixture.jobs.map((job) => job.type), ['prepare']);
  assert.equal(fixture.client.getOfflineGraderSnapshot().phase, 'ready');
  assert.equal(fixture.client.getOfflineGraderSnapshot().enabled, true);
  assert.equal(fixture.client.getOfflineGraderSnapshot().installing, false);
  assert.deepEqual(JSON.parse(fixture.storage.get(PREF_KEY)), { version: PACK_VERSION, enabled: true });
});
test('low storage fails before downloading or starting a worker', async () => {
  const fixture = await clientFixture({ pref: null, cache: new MemoryCache(), estimate: async () => ({ quota: 100, usage: 90 }) });
  await fixture.client.downloadOfflineGrader();
  assert.equal(fixture.client.getOfflineGraderSnapshot().phase, 'error');
  assert.match(fixture.client.getOfflineGraderSnapshot().message, /storage/);
  assert.deepEqual(fixture.jobs, []); assert.deepEqual(fixture.fetched, []);
});
test('cancel during capability/storage setup prevents stale download completion', async () => {
  const gate = deferred(); const fixture = await clientFixture({ pref: null, estimate: () => gate.promise });
  const job = fixture.client.downloadOfflineGrader();
  await tick(); fixture.client.cancelOfflineGraderDownload(); gate.resolve({ quota: 2 ** 31, usage: 0 }); await job;
  assert.equal(fixture.client.getOfflineGraderSnapshot().phase, 'idle');
  assert.equal(fixture.client.getOfflineGraderSnapshot().enabled, false);
  assert.deepEqual(fixture.jobs, []); assert.deepEqual(fixture.fetched, []);
});
test('duplicate download and cancel during warmup cannot enable the cancelled pack', async () => {
  const fixture = await clientFixture({ pref: null, reply: null });
  const first = fixture.client.downloadOfflineGrader(); const second = fixture.client.downloadOfflineGrader();
  await until(() => fixture.jobs.length === 1); await second;
  assert.equal(fixture.jobs[0].type, 'prepare');
  assert.equal(fixture.client.getOfflineGraderSnapshot().installing, true);
  fixture.client.cancelOfflineGraderDownload(); await first;
  // A worker which reports after termination must not resurrect its job.
  fixture.workers[0].onmessage({ data: { id: fixture.jobs[0].id, result: true } });
  assert.equal(fixture.client.getOfflineGraderSnapshot().phase, 'idle');
  assert.equal(fixture.client.getOfflineGraderSnapshot().enabled, false);
  assert.equal(fixture.storage.has(PREF_KEY), false);
});
test('one explicit local inference at a time and local results remain nonpersistent', async () => {
  const fixture = await clientFixture({ reply: null });
  const first = fixture.client.gradeOfflineAnswer(input);
  const second = fixture.client.gradeOfflineAnswer(input);
  assert.equal(await second, null);
  await until(() => fixture.jobs.length === 1);
  fixture.workers[0].onmessage({ data: { id: fixture.jobs[0].id, result: localResult } });
  assert.deepEqual(await first, localResult);
  assert.equal(fixture.jobs.length, 1); assert.equal(fixture.client.getOfflineGraderSnapshot().phase, 'ready');
  assert.equal(fixture.storage.size, 1, 'No accepted answer was written to browser storage');
});
test('abort and disabling terminate inference, return unknown, and ignore stale replies', async () => {
  for (const mode of ['abort', 'disable']) {
    const fixture = await clientFixture({ reply: null }); const controller = new AbortController();
    const result = fixture.client.gradeOfflineAnswer({ ...input, signal: controller.signal });
    await until(() => fixture.jobs.length === 1);
    if (mode === 'abort') controller.abort(); else fixture.client.setOfflineGraderEnabled(false);
    assert.equal(await result, null); assert.equal(fixture.workers[0].terminated, true);
    const stopped = fixture.client.getOfflineGraderSnapshot();
    fixture.workers[0].onmessage({ data: { id: fixture.jobs[0].id, result: localResult } });
    assert.equal(fixture.client.getOfflineGraderSnapshot(), stopped);
    if (mode === 'disable') assert.equal(stopped.enabled, false);
  }
});
test('worker errors return unknown and release the running job', async () => {
  const fixture = await clientFixture({ reply: null });
  const first = fixture.client.gradeOfflineAnswer(input);
  await until(() => fixture.jobs.length === 1);
  fixture.workers[0].onerror(new Error('GPU device lost'));
  assert.equal(await first, null);
  assert.equal(fixture.workers[0].terminated, true);
  assert.equal(fixture.client.getOfflineGraderSnapshot().phase, 'error');
  const retry = fixture.client.gradeOfflineAnswer(input);
  await until(() => fixture.jobs.length === 2);
  fixture.workers[1].onmessage({ data: { id: fixture.jobs[1].id, result: localResult } });
  assert.equal(await retry, localResult);
});
test('local timeout terminates the worker and late completion cannot change the result', async () => {
  const nativeSet = globalThis.setTimeout; const nativeClear = globalThis.clearTimeout;
  const timers = new Map(); let id = 0;
  globalThis.setTimeout = (fn, ms) => { const key = ++id; timers.set(key, { fn, ms }); return key; };
  globalThis.clearTimeout = (key) => timers.delete(key);
  try {
    const fixture = await clientFixture({ reply: null });
    const result = fixture.client.gradeOfflineAnswer(input);
    await until(() => fixture.jobs.length === 1);
    assert.equal(timers.size, 1);
    const timer = [...timers.values()][0]; assert.equal(timer.ms, config.GRADING_TIMEOUT_MS);
    timer.fn(); assert.equal(await result, null);
    assert.equal(fixture.workers[0].terminated, true);
    assert.match(fixture.client.getOfflineGraderSnapshot().message, /too long/);
    const stopped = fixture.client.getOfflineGraderSnapshot();
    fixture.workers[0].onmessage({ data: { id: fixture.jobs[0].id, result: localResult } });
    assert.equal(fixture.client.getOfflineGraderSnapshot(), stopped);
  } finally { globalThis.setTimeout = nativeSet; globalThis.clearTimeout = nativeClear; }
});
test('failed model warmup never writes an enabled preference', async () => {
  const fixture = await clientFixture({ pref: null, reply: null });
  const download = fixture.client.downloadOfflineGrader();
  await until(() => fixture.jobs.length === 1);
  fixture.workers[0].onmessage({ data: { id: fixture.jobs[0].id, error: 'GPU ran out of memory' } });
  await download;
  assert.equal(fixture.client.getOfflineGraderSnapshot().phase, 'error');
  assert.equal(fixture.client.getOfflineGraderSnapshot().enabled, false);
  assert.equal(fixture.storage.has(PREF_KEY), false);
});
test('removal clears only the grader pack and preference', async () => {
  const fixture = await clientFixture(); fixture.storage.set('unrelated', 'retained');
  await fixture.client.removeOfflineGrader();
  assert.equal(fixture.cache.entries.size, 0); assert.equal(JSON.parse(fixture.storage.get(PREF_KEY)), null);
  assert.equal(fixture.storage.get('unrelated'), 'retained');
  assert.equal(fixture.client.getOfflineGraderSnapshot().enabled, false);
});
test('failed cache deletion reports retained files instead of claiming successful removal', async () => {
  const fixture = await clientFixture();
  globalThis.caches.delete = async () => { throw new Error('Storage temporarily unavailable'); };
  await fixture.client.removeOfflineGrader();
  assert.equal(fixture.client.getOfflineGraderSnapshot().enabled, false);
  assert.equal(fixture.client.getOfflineGraderSnapshot().phase, 'error');
  assert.match(fixture.client.getOfflineGraderSnapshot().message, /could not be removed/);
  assert.equal(fixture.cache.entries.size, files.length);
});
test('real cloud checker preserves all three provider endpoints, request text, and verdicts', async () => {
  const { fetchAnswerRuling } = await import('../src/ai.js');
  for (const provider of ['anthropic', 'openai', 'gemini']) {
    const fixture = await clientFixture();
    fixture.storage.set('lavan-ai-provider', provider);
    fixture.storage.set(`lavan-api-key-${provider}`, 'not-a-real-key-test-only');
    globalThis.window = { localStorage };
    let request;
    globalThis.fetch = async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      const text = 'YES - Natural wording';
      return new Response(JSON.stringify(provider === 'anthropic' ? { content: [{ type: 'text', text }] }
        : provider === 'openai' ? { choices: [{ message: { content: text } }] }
        : { candidates: [{ content: { parts: [{ text }] } }] }));
    };
    assert.deepEqual(await fetchAnswerRuling(input), { accept: true, why: 'Natural wording' });
    const expectedHost = { anthropic: 'api.anthropic.com', openai: 'api.openai.com', gemini: 'generativelanguage.googleapis.com' }[provider];
    assert.equal(new URL(request.url).hostname, expectedHost);
    assert.equal(request.options.method, 'POST'); assert(request.options.signal instanceof AbortSignal);
    const prompt = request.body.messages?.[0].content || request.body.contents[0].parts[0].text;
    for (const part of [input.he, input.en, input.given]) assert(prompt.includes(part));
  }
});
test('cloud timeout remains a transport error even when fetch reports Safari-style AbortError', async () => {
  const { fetchAnswerRuling } = await import('../src/ai.js');
  const fixture = await clientFixture(); fixture.storage.set('lavan-api-key-anthropic', 'not-a-real-key-test-only');
  globalThis.window = { localStorage };
  const nativeSet = globalThis.setTimeout; const nativeClear = globalThis.clearTimeout;
  let fire; let cleared = false;
  globalThis.setTimeout = (fn, ms) => { assert.equal(ms, 5000); fire = fn; return 1; };
  globalThis.clearTimeout = () => { cleared = true; };
  globalThis.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  try {
    const request = fetchAnswerRuling(input); const rejected = assert.rejects(request, (error) => error.name === 'TimeoutError');
    fire(); await rejected; assert.equal(cleared, true);
  } finally { globalThis.setTimeout = nativeSet; globalThis.clearTimeout = nativeClear; }
});

test('worker uses cache-only pinned resources and one scoring pass of YES against NO', async () => {
  const cache = completeCache(); const messages = []; const generated = []; const loadCalls = []; const tokenCalls = [];
  const YES = 9; const NO = 4; const vocab = 12;
  let length = 7; let margin = ACCEPT_MARGIN.en + 1; let hold; let tokens = { YES: [YES], NO: [NO] };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: { requestAdapter: async () => ({ features: new Set(['shader-f16']) }) } } });
  globalThis.caches = { open: async (name) => { assert.equal(name, PACK_CACHE); return cache; } };
  globalThis.self = { postMessage: (message) => messages.push(message) };
  const tokenizer = {
    apply_chat_template: (text, options) => { tokenCalls.push({ text, options }); return { input_ids: { dims: [1, length] } }; },
    encode: (word, options) => { assert.equal(options.add_special_tokens, false); return tokens[word]; },
  };
  const logits = () => { const data = new Float32Array(vocab * 2); data[vocab + YES] = margin; data[vocab + NO] = 0; return { data, dims: [1, vocab] }; };
  const model = { generate: async (options) => {
    generated.push(options); if (hold) await hold.promise;
    options.logits_processor._call([[42]], logits());
    return {};
  } };
  class LogitsProcessor {}
  class LogitsProcessorList { processors = []; push(p) { this.processors.push(p); } _call(ids, l) { for (const p of this.processors) l = p._call(ids, l); return l; } }
  const env = { backends: { onnx: { wasm: { wasmPaths: { wasm: 'https://cdn.invalid/ort.wasm', mjs: 'https://cdn.invalid/ort.mjs' } } } } };
  globalThis.__offlineTransformerMock = {
    env, LogitsProcessor, LogitsProcessorList,
    AutoTokenizer: { from_pretrained: async (...args) => { loadCalls.push(args); return tokenizer; } },
    AutoModelForCausalLM: { from_pretrained: async (...args) => { loadCalls.push(args); return model; } },
  };
  // Preserve the production worker body and replace only its external model
  // dependency; a real model load is intentionally outside this test's scope.
  let source = await readFile(new URL('../src/localGrader/worker.js', import.meta.url), 'utf8');
  const imported = "import { AutoTokenizer, AutoModelForCausalLM, LogitsProcessor, LogitsProcessorList, env } from '@huggingface/transformers';";
  assert(source.includes(imported), 'Worker import line changed; update this test');
  source = source.replace(imported, 'const { AutoTokenizer, AutoModelForCausalLM, LogitsProcessor, LogitsProcessorList, env } = globalThis.__offlineTransformerMock;')
    .replace("from './config.js'", `from '${new URL('../src/localGrader/config.js', import.meta.url).href}'`);
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const send = (id, value = input, type = 'grade') => self.onmessage({ data: { id, type, input: value, baseUrl: fixtureBase } });
  await send(1);
  assert.deepEqual(messages.pop(), { id: 1, result: localResult });
  assert.equal(loadCalls.length, 2);
  for (const [id, options] of loadCalls) { assert.equal(id, MODEL_ID); assert.equal(options.revision, MODEL_REVISION); assert.equal(options.local_files_only, true); }
  assert.equal(loadCalls[1][1].device, 'webgpu');
  assert.deepEqual(loadCalls[1][1].dtype, MODEL_DTYPE);
  assert.equal(env.allowRemoteModels, false); assert.equal(env.useBrowserCache, false); assert.equal(env.useFSCache, false);
  assert.equal(env.backends.onnx.wasm.numThreads, 1); assert.equal(env.backends.onnx.wasm.proxy, false);
  assert.equal(env.backends.onnx.wasm.wasmPaths.wasm, fixtureBase + 'offline-ai/ort-wasm-simd-threaded.asyncify.wasm');
  assert.equal((await env.fetch('https://untrusted.invalid/missing')).status, 404);
  assert.equal((await env.fetch(`https://huggingface.co/${MODEL_ID}/resolve/main/tokenizer_config.json`)).status, 200);
  await assert.rejects(env.customCache.put(), /read-only/);
  assert.equal(generated[0].max_new_tokens, 1, 'Only the first token is scored');
  assert.equal(generated[0].do_sample, false); assert.equal(generated[0].num_beams, 1);
  assert.equal(tokenCalls[0].options.enable_thinking, false);
  assert.equal(tokenCalls[0].text.at(-1).role, 'user');
  assert.deepEqual(JSON.parse(tokenCalls[0].text.at(-1).content), { direction: 'Hebrew to English', hebrew: input.he, referenceEnglish: input.en, answer: input.given });
  length = config.MAX_INPUT_TOKENS + 1; await send(2);
  assert.deepEqual(messages.pop(), { id: 2, result: null }); assert.equal(generated.length, 1);
  length = 7; margin = ACCEPT_MARGIN.en - 1; await send(3);
  assert.deepEqual(messages.pop(), { id: 3, result: null }, 'A YES below the cut abstains');
  margin = -1; await send(4); assert.equal(messages.pop().result.accept, false);
  margin = ACCEPT_MARGIN.en + 100; await send(5, { ...input, given: 'אני פה', lang: 'he' });
  assert.deepEqual(messages.pop(), { id: 5, result: null }, 'A Hebrew answer never reaches the model');
  assert.equal(generated.length, 3);
  margin = ACCEPT_MARGIN.en + 1; hold = deferred(); const running = send(6); await until(() => generated.length === 4);
  await send(7); assert.deepEqual(messages.pop(), { id: 7, result: null }, 'A second job while busy abstains');
  hold.resolve(); await running; hold = null;
  await send(8, input, 'prepare'); assert.equal(generated.at(-1).max_new_tokens, 1);
  assert.deepEqual(messages.pop(), { id: 8, result: true });
  margin = NaN; await send(9, input, 'prepare');
  assert.match(messages.pop().error, /could not run/, 'A warm-up without a usable score must fail');
});

test('settings controls render honest idle, download, warmup, ready, disabled, unsupported, and error states', async () => {
  const { transform } = await import('esbuild');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const React = await import('react');
  const mock = 'data:text/javascript;base64,' + Buffer.from(`
    export const subscribeOfflineGrader = () => () => {};
    export const getOfflineGraderSnapshot = () => globalThis.__offlineControlState;
    export const initOfflineGrader = async () => {};
    export const downloadOfflineGrader = async () => {};
    export const cancelOfflineGraderDownload = () => {};
    export const setOfflineGraderEnabled = () => {};
    export const removeOfflineGrader = async () => {};
  `).toString('base64');
  const jsx = await readFile(new URL('../src/OfflineGraderSection.jsx', import.meta.url), 'utf8');
  let { code } = await transform(jsx, { loader: 'jsx', jsx: 'automatic', format: 'esm' });
  for (const specifier of ['react', 'react/jsx-runtime', 'lucide-react']) code = code.replaceAll(`from "${specifier}"`, `from "${import.meta.resolve(specifier)}"`);
  code = code.replace('from "./offlineGrader.js"', `from "${mock}"`);
  const { default: Section } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  const render = (state) => {
    globalThis.__offlineControlState = { phase: 'idle', enabled: false, progress: 0, message: '', installing: false, ...state };
    return renderToStaticMarkup(React.createElement(Section, { course: true }));
  };
  const idle = render({});
  assert.match(idle, /Experimental/); assert.match(idle, /1\.5 GB/); assert.match(idle, /Download offline grader/);
  assert.match(idle, /never saved for future answers/); assert.match(idle, /on this device/);
  const downloading = render({ phase: 'downloading', installing: true, progress: 53 });
  assert.match(downloading, /role="progressbar"/); assert.match(downloading, /aria-valuenow="53"/); assert.match(downloading, />Cancel</);
  const warmup = render({ phase: 'loading', installing: true });
  assert.match(warmup, /Loading the local model/); assert.match(warmup, />Cancel</);
  const ready = render({ phase: 'ready', enabled: true });
  assert.match(ready, /Ready for offline text checks/); assert.match(ready, /checked=""/); assert.match(ready, /Remove offline grader/);
  const disabled = render({ phase: 'ready', enabled: false });
  assert.match(disabled, /offline grading is off/); assert(!disabled.includes('checked=""'));
  const unsupported = render({ phase: 'unsupported', message: 'WebGPU is unavailable' });
  assert.match(unsupported, /WebGPU is unavailable/); assert(!unsupported.includes('Download offline grader'));
  const error = render({ phase: 'error', message: 'Some offline files were removed' });
  assert.match(error, /role="alert"/); assert.match(error, /Retry download/); assert.match(error, /Some offline files were removed/);
});

const buildRoot = new URL('../dist/', import.meta.url);
let builtSw;
try { builtSw = await readFile(new URL('sw.js', buildRoot), 'utf8'); } catch { /* Build checks are optional before npm run build. */ }
if (builtSw) test('production service worker precaches its worker bundle but excludes optional runtime and model bytes', async () => {
  const assets = await readdir(new URL('assets/', buildRoot));
  const workers = assets.filter((file) => /^worker-.*\.js$/.test(file));
  assert.equal(workers.length, 1);
  assert(builtSw.includes(`assets/${workers[0]}`), 'Offline model worker must be part of the app shell');
  assert(!builtSw.includes('offline-ai/'), 'Optional runtime must not silently download with the app shell');
  assert(!builtSw.includes('huggingface.co'), 'Model data must not silently download with the app shell');
  assert(!/url:["'][^"']+\.(?:wasm|onnx|onnx_data)["']/.test(builtSw));
  const runtimes = await readdir(new URL('offline-ai/', buildRoot));
  for (const suffix of ['.asyncify.mjs', '.asyncify.wasm']) assert(runtimes.includes('ort-wasm-simd-threaded' + suffix));
});

let failures = 0;
for (const [name, fn] of tests) {
  try { await fn(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); }
}
console.log(`\n${tests.length - failures}/${tests.length} offline-grader contract tests passed (mock inference only).`);
if (failures) process.exitCode = 1;
