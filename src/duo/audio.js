/* Sound.

   Two jobs. One: the course's own recordings — every key phrase came with a
   CDN URL, and those are real Hebrew voices, so they play first and the
   browser's speech synthesis only covers what has no recording (single words,
   mostly). Two: the interface noises, which are synthesised here rather than
   shipped as files — a correct answer is an arpeggio, a wrong one is a minor
   third, and neither needs a download. */

import { speakOne, stopSpeech } from "../text.js";

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
  heart: () => { tone(392, 0, 0.18, { type: "sine", gain: 0.12, slide: -140 }); },
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

/* Plays the recording if the phrase has one, and falls back to the system
   Hebrew voice — which may not exist, in which case the exercise still works,
   it just goes quiet. `rate` slows the second listen, as Duolingo's turtle
   button does. */
export function playPhrase(text, audioUrl, { rate = 1 } = {}) {
  stopAudio();
  if (audioUrl) {
    const el = new Audio(audioUrl);
    el.playbackRate = rate;
    el.crossOrigin = "anonymous";
    current = el;
    const p = el.play();
    if (p?.catch) p.catch(() => { if (text) speakOne(text, { rate: rate * 0.85 }); });
    return;
  }
  if (text) speakOne(text, { rate: rate * 0.85 });
}

/* True when the browser has a Hebrew voice, so the UI can hide speaking and
   listening drills it cannot actually run. */
export function hasHebrewVoice() {
  try {
    return (window.speechSynthesis?.getVoices() || []).some((v) => /^he/i.test(v.lang));
  } catch (e) { return false; }
}

export function hasSpeechRecognition() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
