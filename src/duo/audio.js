/* Sound.

   Two jobs. One: the course's own recordings — every key phrase came with a
   CDN URL, and those are real Hebrew voices, so they play first and the
   browser's speech synthesis only covers what has no recording (single words,
   mostly). Two: the interface noises, which are synthesised here rather than
   shipped as files — a correct answer is an arpeggio, a wrong one is a minor
   third, and neither needs a download. */

import { speakOne, stopSpeech } from "../text.js";
import { voiceUrl, canGenerateSpeech } from "../voice.js";
import { fetchSpeech, speechUrl } from "./data.js";

/* The recordings npm run build:audio made, held once it has been asked for.
   Kept as a plain object rather than a promise so that the common case — the
   index has arrived, the line is not in it — costs a property lookup. */
let shipped = null;
fetchSpeech().then((idx) => { shipped = idx; }).catch(() => { shipped = {}; });

/* Is this line one the build recorded? Matched on the text itself, which is
   what the index is keyed by: no hashing here, so there is nothing for the two
   ends to disagree about. */
const shippedUrl = (text) => {
  const file = shipped?.[String(text || "").trim()];
  return file ? speechUrl(file) : null;
};

let ctx = null;
let enabled = true;

export function setSoundEnabled(v) { enabled = !!v; }

function audio() {
  if (!enabled) return null;
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/* A browser will not start audio until the user has touched the page; this is
   called from the first tap so that the first correct answer already sounds. */
export function warmAudio() { audio(); }

function tone(freq, at, dur, { type = "sine", gain = 0.14, slide = 0 } = {}) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const SFX = {
  correct: () => { tone(523.25, 0, 0.13, { type: "triangle" }); tone(659.25, 0.07, 0.13, { type: "triangle" }); tone(783.99, 0.14, 0.22, { type: "triangle", gain: 0.16 }); },
  wrong: () => { tone(196, 0, 0.22, { type: "sawtooth", gain: 0.08 }); tone(185, 0.03, 0.3, { type: "sine", gain: 0.1 }); },
  tap: () => tone(880, 0, 0.045, { type: "sine", gain: 0.06 }),
  untap: () => tone(660, 0, 0.04, { type: "sine", gain: 0.05 }),
  complete: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 0.34, { type: "triangle", gain: 0.15 })),
  levelUp: () => [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.08, 0.4, { type: "square", gain: 0.09 })),
  gem: () => { tone(1318.5, 0, 0.1, { type: "sine", gain: 0.1 }); tone(1760, 0.08, 0.16, { type: "sine", gain: 0.09 }); },
  streak: () => [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => tone(f, i * 0.09, 0.3, { type: "triangle", gain: 0.13 })),
  whoosh: () => tone(320, 0, 0.18, { type: "sine", gain: 0.07, slide: 500 }),
};

export function sfx(name) {
  if (!enabled) return;
  try { SFX[name]?.(); } catch (e) { /* audio is a nicety, never a failure */ }
}

/* ------------------------------------------------------------------ */
/* Hebrew audio                                                        */
/* ------------------------------------------------------------------ */
let current = null;

export function stopAudio() {
  if (current) { try { current.pause(); } catch (e) {} current = null; }
  stopSpeech();
}

/* Three ways to hear a sentence, in order of how good they sound: the course's
   own recording where one exists, a generated one where a voice key is set —
   cached, so it is only generated once — and the browser's Hebrew voice, which
   is usually not installed at all.

   `rate` slows the second listen, as Duolingo's turtle button does. Returns a
   promise so the caller can show that something is being generated; it never
   rejects, because a lesson should not stall on audio. */
export function playPhrase(text, audioUrl, { rate = 1, onState } = {}) {
  stopAudio();
  const play = (src) => new Promise((resolve) => {
    const el = new Audio(src);
    el.playbackRate = rate;
    el.crossOrigin = "anonymous";
    current = el;
    el.onended = () => resolve(true);
    el.onerror = () => resolve(false);
    const p = el.play();
    if (p?.catch) p.catch(() => resolve(false));
  });

  const fallback = () => { if (text) speakOne(text, { rate: rate * 0.85 }); };

  if (audioUrl) {
    return play(audioUrl).then((ok) => { if (!ok) fallback(); });
  }
  /* Then anything the build recorded. It comes before the generated voice
     rather than after it because it is already here: no key, no network, no
     second of silence while a model reads the line back. */
  const ours = shippedUrl(text);
  if (ours) {
    return play(ours).then((ok) => {
      if (ok) return;
      if (text && canGenerateSpeech()) return playGenerated(text, onState);
      fallback();
    });
  }
  if (text && canGenerateSpeech()) return playGenerated(text, onState);
  fallback();
  return Promise.resolve();

  /* `play` closes over the rate, so this only needs the text and the spinner */
  function playGenerated(t, on) {
    on?.("loading");
    return voiceUrl(t)
      .then((url) => (url ? play(url) : false))
      .then((ok) => { if (!ok) fallback(); })
      .catch(() => fallback())
      .finally(() => on?.("idle"));
  }
}

/* True when anything at all can read Hebrew aloud — a generated voice or the
   system's own — which is what decides whether listening drills appear. */
export { canSpeakHebrew as hasHebrewVoice } from "../voice.js";

export function hasSpeechRecognition() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
