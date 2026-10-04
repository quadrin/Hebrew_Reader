/* Session and settings regression tests with deterministic grader responses.
   No browser, GPU, model download, API key, or network request is needed.
   Run: npm run check:offline-session */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import React from "react";
import TestRenderer from "react-test-renderer";

const { act } = TestRenderer;
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "duchifat-session-test-"));
const bundle = join(temporary, "components.mjs");
const previousWindow = globalThis.window;
let renderer;

/* Only the Session's side-effecting dependencies are substituted. Real
   reference matching, exercise rendering and session state transitions run. */
const mocks = {
  "test:state": `
    export const useDuo = () => window.test.duo;
    export const getDuo = () => ({ words: {} });
    export const acceptedFor = () => [];
    export const rememberAccepted = (...x) => window.test.remembered.push(x);
    export const finishSession = x => window.test.finished.push(x);
    export const clearMistakes = (...x) => window.test.cleared.push(x);
    export const addMistake = (...x) => window.test.mistakes.push(x);
    export const chanceOf = () => .5;
    export const recordWord = () => {};
    export const recordSentence = () => {};
    export const touchWords = () => {};
    export const setSetting = () => {};
    export const noteLearner = () => {};
  `,
  "test:audio": `
    export const playPhrase = () => {};
    export const sfx = () => {};
    export const stopAudio = () => {};
    export const hasSpeechRecognition = () => false;
    export const warmAudio = () => {};
  `,
  "test:ai": `
    export const hasApiKey = () => window.test.cloud;
    export const fetchCorrectionNote = input => {
      window.test.explanations.push(input);
      return new Promise(resolve => window.test.explainResolvers.push(resolve));
    };
    export const fetchSentenceNote = input => {
      window.test.sentenceNotes.push(input);
      return new Promise(resolve => window.test.sentenceResolvers.push(resolve));
    };
    export const fetchSpeechRuling = () => {
      window.test.speech++;
      return Promise.resolve({ accept: true });
    };
  `,
  "test:offline": `
    export const subscribeOfflineGrader = () => () => {};
    export const getOfflineGraderSnapshot = () => window.test.offline;
    export const initOfflineGrader = () => { window.test.inits++; return Promise.resolve(); };
    export const downloadOfflineGrader = () => { window.test.downloads++; };
    export const cancelOfflineGraderDownload = () => { window.test.cancels++; };
    export const removeOfflineGrader = () => { window.test.removes++; };
    export const setOfflineGraderEnabled = value => { window.test.toggles.push(value); };
  `,
  "test:ruling": `
    export const canAskTextRuling = () => true;
    export const isCloudGradingAvailable = () => window.test.cloud;
    export const shouldPrefetchTextRuling = () => window.test.cloud;
    export const getTextRulingWaitMs = () => window.test.waitMs;
    export const fetchTextAnswerRuling = input => {
      window.test.requests.push(input);
      return new Promise(resolve => window.test.resolvers.push(resolve));
    };
  `,
  "test:dialog": `export const useLayer = () => {}; export const useDialog = () => null;`,
  "test:entry": `
    export { default as Session } from ${JSON.stringify(join(root, "src/duo/Session.jsx"))};
    export { default as Offline } from ${JSON.stringify(join(root, "src/OfflineGraderSection.jsx"))};
  `,
};

try {
  await build({
    entryPoints: ["test:entry"], outfile: bundle, bundle: true, format: "esm", platform: "node", jsx: "automatic",
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    plugins: [{
      name: "session-test-dependencies",
      setup(builder) {
        /* Share the renderer's React instance even though the bundle lives
           in a temporary directory outside this checkout. */
        builder.onResolve({ filter: /^react(?:\/.*)?$/ }, ({ path }) => ({ path: require.resolve(path), external: true }));
        builder.onResolve({ filter: /^test:/ }, ({ path }) => ({ path, namespace: "mock" }));
        builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: mocks[path], loader: "js", resolveDir: root }));
        builder.onLoad({ filter: /[/\\](Session|OfflineGraderSection)\.jsx$/ }, async ({ path }) => {
          let code = await readFile(path, "utf8");
          if (path.endsWith("Session.jsx")) {
            code = code.replace('"./state.js"', '"test:state"')
              .replace('"./audio.js"', '"test:audio"')
              .replace('"../ai.js"', '"test:ai"')
              .replace('"../answerRuling.js"', '"test:ruling"')
              .replace('"../offlineGrader.js"', '"test:offline"')
              .replace('"../useDialog.js"', '"test:dialog"');
          } else code = code.replace('"./offlineGrader.js"', '"test:offline"');
          return { contents: code, loader: "jsx" };
        });
      },
    }],
  });

  globalThis.window = { matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} };
  const { Session, Offline } = await import(pathToFileURL(bundle).href);
  const item = {
    key: "one", type: "type", lang: "en", promptLang: "he", prompt: "אני שותה מים",
    display: "I drink water", accepted: ["I drink water"], words: [], instruction: "Translate this sentence",
  };
  const init = () => {
    window.test = {
      duo: { settings: { aiGrading: true, wordBank: false, passages: false } },
      offline: { phase: "ready", enabled: true, progress: 100, message: "" },
      cloud: false, requests: [], resolvers: [], remembered: [], finished: [], cleared: [], mistakes: [],
      explanations: [], explainResolvers: [], sentenceNotes: [], sentenceResolvers: [], speech: 0, inits: 0, downloads: 0, cancels: 0, removes: 0,
      toggles: [], waitMs: 1000,
    };
  };
  const unmount = async () => { if (renderer) await act(async () => renderer.unmount()); };
  const boot = async (items = [item], meta = {}, settings = {}) => {
    await unmount();
    init();
    Object.assign(window.test, settings);
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(Session, {
        items, meta: { kind: "lesson", unit: 1, noRequeue: true, ...meta },
        onExit: () => renderer.unmount(), onFinish: () => {},
      }));
    });
  };
  const mountSettings = async (snapshot) => {
    await unmount();
    init();
    if (snapshot) window.test.offline = snapshot;
    await act(async () => { renderer = TestRenderer.create(React.createElement(Offline)); });
  };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = ms => act(async () => delay(ms));
  const words = node => typeof node === "string" || typeof node === "number" ? String(node)
    : Array.isArray(node) ? node.map(words).join("") : node?.children ? words(node.children) : "";
  const text = () => words(renderer.toJSON());
  const buttons = name => renderer.root.findAllByType("button")
    .filter(button => words(button.children).trim() === name || button.props["aria-label"] === name);
  const click = async name => {
    const button = buttons(name)[0];
    assert.ok(button, `Missing button ${name}: ${text()}`);
    /* Do not await an event's returned grading promise: tests resolve it
       separately to exercise pending, late and interrupted states. */
    await act(async () => { button.props.onClick(); });
  };
  const fill = value => act(async () => renderer.root.findByType("textarea").props.onChange({ target: { value } }));
  const resolve = (source = "local", accept = true) => act(async () => {
    window.test.resolvers.shift()({ accept, why: "Equivalent meaning.", source, persist: source === "cloud" });
    await delay(2);
  });
  const passed = title => console.log(`PASS ${title}`);

  await boot();
  await fill("I drink coffee");
  await wait(650);
  assert.equal(window.test.requests.length, 0);
  const check = buttons("Check")[0].props.onClick;
  await act(async () => { check(); check(); });
  assert.equal(window.test.requests.length, 1);
  await resolve();
  assert.match(text(), /Experimental offline check/);
  assert.equal(window.test.remembered.length, 0);
  passed("local inference starts only on Check; duplicate taps blocked; approval never persisted");

  await boot();
  await fill("I drink water");
  await click("Check");
  assert.equal(window.test.requests.length, 0);
  assert.match(text(), /Nicely done/);
  passed("deterministic acceptance runs first");

  const dictation = {
    ...item, key: "dictation", type: "listen", lang: "he", prompt: "", promptLang: "",
    text: "אני שותה מים", display: "אני שותה מים", solutionEn: "", accepted: ["אני שותה מים"], tiles: [],
  };
  await boot([dictation]);
  await fill("אני שותה קפה");
  await click("Check");
  assert.equal(window.test.requests.length, 0);
  passed("no-reference Wikipedia dictation never invokes the model");

  await boot([item], {}, { cloud: true });
  await fill("I drink coffee");
  await wait(550);
  assert.equal(window.test.requests.length, 1);
  assert.equal(window.test.requests[0].allowLocal, false);
  await click("Check");
  await resolve("cloud");
  assert.equal(window.test.remembered.length, 1);
  passed("cloud debounce and accepted-answer persistence are preserved");

  await boot([item, { ...item, key: "two", prompt: "אני אוכל לחם", display: "I eat bread", accepted: ["I eat bread"] }], {}, { waitMs: 25 });
  await fill("I drink coffee");
  await click("Check");
  await wait(35);
  await click("Continue");
  await resolve();
  assert.equal(window.test.cleared.length, 0);
  assert.equal(window.test.remembered.length, 0);
  assert.doesNotMatch(text(), /Experimental offline check/);
  passed("late result cannot change the next question");

  await boot([item], {}, { waitMs: 25 });
  await fill("I drink coffee");
  await click("Check");
  await wait(35);
  await click("Explain");
  assert.equal(window.test.requests.length, 1);
  await resolve();
  assert.equal(window.test.cleared.length, 1);
  assert.equal(window.test.remembered.length, 0);
  await click("Continue");
  assert.equal(window.test.finished[0].correct, 1);
  passed("late result plus Explain corrects the tally once and never persists local approval");

  await boot();
  await fill("I drink coffee");
  await click("Check");
  await unmount();
  await resolve();
  assert.equal(window.test.remembered.length, 0);
  assert.equal(window.test.mistakes.length, 0);
  passed("grading callback is ignored after unmount");

  await boot([item], {}, { cloud: true, waitMs: 25 });
  await fill("I drink coffee");
  await click("Check");
  await resolve("cloud", false);
  await click("Explain");
  assert.equal(window.test.explanations.length, 1);
  await click("Continue");
  await act(async () => window.test.explainResolvers.shift()("STALE EXPLANATION"));
  assert.doesNotMatch(text(), /STALE EXPLANATION/);
  passed("explanation callback is ignored after session completion");

  await mountSettings();
  assert.equal(window.test.downloads, 0);
  await act(async () => renderer.root.findByType("input").props.onChange({ target: { checked: false } }));
  assert.deepEqual(window.test.toggles, [false]);
  await click("Remove offline grader");
  assert.equal(window.test.removes, 1);
  passed("settings never auto-download and expose toggle/remove actions");

  await boot([item], {}, { cloud: true });
  await fill("I drink coffee");
  await wait(550);
  await click("Check");
  await act(async () => { window.test.cloud = false; window.test.resolvers.shift()(null); await delay(2); });
  assert.equal(window.test.requests.length, 2);
  assert.equal(window.test.requests[1].allowLocal, true);
  await resolve();
  assert.equal(window.test.remembered.length, 0);
  passed("failed cloud prefetch falls back locally only after an explicit Check");

  await boot([item, { ...item, key: "two", display: "I drink tea", accepted: ["I drink tea"] }]);
  await fill("I drink coffee");
  await click("Check");
  await resolve();
  await click("Continue");
  await fill("I drink coffee");
  await click("Check");
  assert.equal(window.test.requests.length, 2);
  await resolve();
  passed("ruling cache distinguishes different reference translations");

  await boot([{ ...dictation, solutionEn: "I drink water" }]);
  await fill("אני שותה קפה");
  await click("Check");
  assert.equal(window.test.requests[0].en, "I drink water");
  await resolve();
  passed("reference-backed dictation supplies its English translation");

  for (const phase of ["checking", "downloading", "loading"]) {
    await mountSettings({ phase, enabled: true, progress: 50, message: "", installing: true });
    assert.equal(buttons("Cancel").length, 1);
    assert.equal(buttons("Remove offline grader").length, 0);
    const inputs = renderer.root.findAllByType("input");
    if (inputs.length) assert.equal(inputs[0].props.disabled, true);
    await click("Cancel");
    assert.equal(window.test.cancels, 1);
  }
  await mountSettings({
    phase: "idle", enabled: false, progress: 0, installing: false,
    message: "Download cancelled. Completed files can be reused when you retry.",
  });
  assert.equal(buttons("Remove offline grader").length, 1);
  assert.equal(buttons("Download offline grader (about 1.5 GB)").length, 1);
  passed("cancel covers preparation/download/warmup, and partial downloads remain removable");

  await boot([item], {}, { duo: { settings: { aiGrading: false, wordBank: false } } });
  await fill("I drink coffee");
  await click("Check");
  assert.equal(window.test.requests.length, 0);
  await click("Explain");
  assert.equal(window.test.requests.length, 1);
  await resolve();
  assert.equal(window.test.remembered.length, 0);
  passed("automatic-grading preference is respected while explicit reconsideration remains available");

  await boot();
  await fill("I drink coffee");
  await click("Check");
  await resolve("local", false);
  await click("Explain");
  assert.equal(window.test.explanations.length, 0);
  assert.match(text(), /Detailed explanations need/);
  passed("offline Explain never calls the cloud explanation API");

  await boot([item, { ...item, key: "same-pair" }]);
  await fill("I drink coffee");
  await click("Check");
  await resolve();
  await click("Continue");
  window.test.cloud = true;
  await fill("I drink coffee");
  await click("Check");
  assert.equal(window.test.requests.length, 2);
  await resolve("cloud");
  assert.equal(window.test.remembered.length, 1);
  passed("local cache entries cannot masquerade as cloud rulings after reconnecting");

  await boot([item], {}, { cloud: true });
  await act(async () => renderer.root.findByProps({ className: "d-dunno" }).props.onClick());
  assert.match(text(), /Correct solution/);
  assert.equal(buttons("Explain").length, 1, "I don't know offers Explain");
  await click("Explain");
  assert.equal(window.test.requests.length, 0, "Nothing was answered, so nothing is put to the grader");
  assert.equal(window.test.explanations.length, 0);
  assert.deepEqual(window.test.sentenceNotes, [{ he: "אני שותה מים", en: "I drink water", why: "gaveUp" }]);
  assert.match(text(), /looking at the sentence/);
  await act(async () => window.test.sentenceResolvers.shift()("- שותה (\"drink\"): one form for I, you and he."));
  assert.match(text(), /one form for I, you and he/);
  assert.equal(buttons("Explain").length, 0, "Once explained, the button goes");
  passed("I don't know can be explained, as a walk through the sentence");

  await boot([item], {}, { cloud: true });
  await fill("I drink water");
  await click("Check");
  assert.match(text(), /Nicely done/);
  await click("Explain");
  assert.deepEqual(window.test.sentenceNotes, [{ he: "אני שותה מים", en: "I drink water", why: "correct" }]);
  await act(async () => window.test.sentenceResolvers.shift()("- מים (\"water\") is always plural."));
  assert.match(text(), /always plural/);
  await click("Continue");
  assert.equal(window.test.finished[0].correct, 1, "Explaining a right answer changes no mark");
  passed("a correct answer can be explained too");

  await boot([item, { ...item, key: "two", prompt: "אני אוכל לחם", display: "I eat bread", accepted: ["I eat bread"] }], {}, { cloud: true, duo: { settings: { aiGrading: false, wordBank: false } } });
  await fill("I drink coffee");
  await click("Check");
  assert.match(text(), /Correct solution/);
  await click("Continue");
  await fill("I eat bread");
  await click("Check");
  await click("Explain");
  assert.deepEqual(window.test.sentenceNotes.map((n) => n.why), ["correct"], "A wrong answer before does not block it");
  assert.equal(window.test.explanations.length, 0);
  passed("Explain on a right answer works after a wrong one");

  await boot([item]);
  await act(async () => renderer.root.findByProps({ className: "d-dunno" }).props.onClick());
  await click("Explain");
  assert.equal(window.test.sentenceNotes.length, 0);
  assert.match(text(), /Detailed explanations need/);
  passed("without a tutor, Explain after I don't know says why instead of calling");

  await boot([item, { ...item, key: "two", prompt: "אני אוכל לחם", display: "I eat bread", accepted: ["I eat bread"] }], {}, { cloud: true });
  await act(async () => renderer.root.findByProps({ className: "d-dunno" }).props.onClick());
  await click("Explain");
  await click("Continue");
  await act(async () => window.test.sentenceResolvers.shift()("STALE SENTENCE NOTE"));
  assert.doesNotMatch(text(), /STALE SENTENCE NOTE/);
  passed("a sentence note that lands after moving on is dropped");

  await boot([{ ...item, type: "speak", prompt: "אני שותה מים", translation: "I drink water" }]);
  const speak = renderer.root.find(node => typeof node.type === "function" && node.type.name === "Speak");
  assert.equal(speak.props.judge, false);
  assert.equal(window.test.requests.length, 0);
  passed("speech has no local grading route");

  console.log("check:offline-session — all Session and settings regressions passed");
} finally {
  if (renderer) await act(async () => renderer.unmount());
  if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  await rm(temporary, { recursive: true, force: true });
}
