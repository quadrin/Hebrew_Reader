/* Hebrew speech, generated.

   The scrape recovered 7,615 sentences and 338 recordings, so nine in ten of
   the course had nothing to listen to. The browser's own speech synthesis is
   the free answer and it is a poor one: most desktops have no Hebrew voice at
   all, and the ones that do read like a station announcement.

   So a sentence with no recording is spoken by whichever model the learner has
   a key for — OpenAI, Gemini, or ElevenLabs — and the result is cached, keyed
   by the text and the voice, so a sentence is paid for once and then works
   offline. Nothing here is required: with no key at all the path falls back to
   the browser voice, and with no voice it stays silent and says so.

   Keys never leave this browser except to the provider they belong to, the
   same way the reader's AI tutor keys work. */

import { storage } from "./storage.js";
import { getKeyFor } from "./ai.js";

const SETTINGS_KEY = "lavan-voice";
const ELEVEN_KEY = "lavan-api-key-elevenlabs";
const INDEX_KEY = "lavan-tts-index";
const CACHE_KEY = (h) => `lavan-tts-${h}`;
const MAX_CACHED = 400;

/* ------------------------------------------------------------------ */
/* Engines                                                             */
/* ------------------------------------------------------------------ */
export const VOICES = {
  openai: {
    label: "OpenAI",
    model: "gpt-4o-mini-tts",
    voices: [
      { id: "alloy", label: "Alloy — neutral" },
      { id: "nova", label: "Nova — bright" },
      { id: "shimmer", label: "Shimmer — warm" },
      { id: "onyx", label: "Onyx — deep" },
      { id: "fable", label: "Fable — expressive" },
    ],
  },
  gemini: {
    label: "Gemini",
    model: "gemini-2.5-flash-preview-tts",
    voices: [
      { id: "Kore", label: "Kore — firm" },
      { id: "Puck", label: "Puck — upbeat" },
      { id: "Charon", label: "Charon — informative" },
      { id: "Aoede", label: "Aoede — breezy" },
    ],
  },
  elevenlabs: {
    label: "ElevenLabs",
    model: "eleven_multilingual_v2",
    voices: [
      { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel — calm" },
      { id: "pNInz6obpgDQGcFmaJgB", label: "Adam — deep" },
      { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella — soft" },
      { id: "ErXwobaYiN019PkySvjV", label: "Antoni — warm" },
    ],
  },
};

const safeGet = (k) => { try { return window.localStorage.getItem(k); } catch (e) { return null; } };
const safeSet = (k, v) => { try { window.localStorage.setItem(k, v); } catch (e) {} };
const safeDel = (k) => { try { window.localStorage.removeItem(k); } catch (e) {} };

export const getElevenKey = () => safeGet(ELEVEN_KEY) || "";
export const setElevenKey = (k) => (k ? safeSet(ELEVEN_KEY, k.trim()) : safeDel(ELEVEN_KEY));

const DEFAULTS = {
  engine: "auto",
  voice: { openai: "alloy", gemini: "Kore", elevenlabs: "21m00Tcm4TlvDq8ikWAM" },
  cache: true,
};

let settings = (() => {
  try {
    const raw = JSON.parse(safeGet(SETTINGS_KEY) || "{}");
    return { ...DEFAULTS, ...raw, voice: { ...DEFAULTS.voice, ...(raw.voice || {}) } };
  } catch (e) { return { ...DEFAULTS }; }
})();

export const voiceSettings = () => settings;

export function setVoiceSettings(patch) {
  settings = { ...settings, ...patch, voice: { ...settings.voice, ...(patch.voice || {}) } };
  safeSet(SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}

export const keyFor = (engine) => (engine === "elevenlabs" ? getElevenKey() : getKeyFor(engine));

/* Which engines this browser could actually use right now. */
export function availableEngines() {
  return Object.keys(VOICES).filter((e) => !!keyFor(e));
}

/* ElevenLabs first — it is the only one of the three built for languages
   other than English — then whichever key exists. */
const PRIORITY = ["elevenlabs", "openai", "gemini"];

export function activeEngine() {
  if (settings.engine === "browser") return "browser";
  if (settings.engine !== "auto" && keyFor(settings.engine)) return settings.engine;
  const found = PRIORITY.find((e) => keyFor(e));
  return found || "browser";
}

export const canGenerateSpeech = () => activeEngine() !== "browser";

/* True when something — a model, a recording, or the system voice — can read
   Hebrew aloud, which is what decides whether listening exercises appear. */
export function canSpeakHebrew() {
  if (canGenerateSpeech()) return true;
  try {
    return (window.speechSynthesis?.getVoices() || []).some((v) => /^he/i.test(v.lang));
  } catch (e) { return false; }
}

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */
const memory = new Map();          /* hash -> object URL */
let index = null;                  /* hash list, oldest first */

async function hash(s) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    /* no subtle crypto (insecure origin) — a plain string hash is plenty */
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }
}

async function loadIndex() {
  if (index) return index;
  try {
    const raw = await storage.get(INDEX_KEY);
    index = raw?.value ? JSON.parse(raw.value) : [];
  } catch (e) { index = []; }
  return index;
}

async function remember(h) {
  const idx = await loadIndex();
  const at = idx.indexOf(h);
  if (at >= 0) idx.splice(at, 1);
  idx.push(h);
  /* oldest out first, so a long session never fills the disk */
  while (idx.length > MAX_CACHED) {
    const gone = idx.shift();
    await storage.delete(CACHE_KEY(gone));
    const url = memory.get(gone);
    if (url) { URL.revokeObjectURL(url); memory.delete(gone); }
  }
  await storage.set(INDEX_KEY, JSON.stringify(idx));
}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

async function cacheGet(h) {
  if (memory.has(h)) return memory.get(h);
  if (!settings.cache) return null;
  try {
    const raw = await storage.get(CACHE_KEY(h));
    if (!raw?.value) return null;
    const res = await fetch(raw.value);
    const url = URL.createObjectURL(await res.blob());
    memory.set(h, url);
    return url;
  } catch (e) { return null; }
}

async function cachePut(h, blob) {
  const url = URL.createObjectURL(blob);
  memory.set(h, url);
  if (!settings.cache) return url;
  try {
    await storage.set(CACHE_KEY(h), await blobToDataUrl(blob));
    await remember(h);
  } catch (e) { /* out of room — the object URL still works this session */ }
  return url;
}

export async function cachedCount() {
  return (await loadIndex()).length;
}

export async function clearVoiceCache() {
  const idx = await loadIndex();
  for (const h of idx) {
    await storage.delete(CACHE_KEY(h));
    const url = memory.get(h);
    if (url) URL.revokeObjectURL(url);
  }
  memory.clear();
  index = [];
  await storage.set(INDEX_KEY, "[]");
}

/* ------------------------------------------------------------------ */
/* Synthesis                                                           */
/* ------------------------------------------------------------------ */
export class VoiceError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function post(url, headers, body) {
  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body });
  } catch (e) {
    throw new VoiceError("couldn't reach the voice service", 0);
  }
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.text()).slice(0, 200); } catch (e) {}
    if (res.status === 401 || res.status === 403) throw new VoiceError("that voice key was rejected", res.status);
    if (res.status === 429) throw new VoiceError("the voice service is rate-limiting — try again shortly", res.status);
    throw new VoiceError(`the voice service returned ${res.status}${detail ? ` — ${detail}` : ""}`, res.status);
  }
  return res;
}

/* Gemini answers with raw 24 kHz signed 16-bit PCM, which no <audio> element
   will play; a 44-byte RIFF header in front of it turns it into a WAV. */
function pcmToWav(bytes, sampleRate = 24000) {
  const buf = new ArrayBuffer(44 + bytes.length);
  const view = new DataView(buf);
  const str = (at, s) => { for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i)); };
  str(0, "RIFF");
  view.setUint32(4, 36 + bytes.length, true);
  str(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          /* PCM */
  view.setUint16(22, 1, true);          /* mono */
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, bytes.length, true);
  new Uint8Array(buf, 44).set(bytes);
  return new Blob([buf], { type: "audio/wav" });
}

const b64ToBytes = (b64) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function synthesize(text, engine, voice, keyOverride) {
  const key = keyOverride || keyFor(engine);
  if (!key) throw new VoiceError("no key for that voice", 0);

  if (engine === "openai") {
    const res = await post(
      "https://api.openai.com/v1/audio/speech",
      { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      JSON.stringify({
        model: VOICES.openai.model,
        voice,
        input: text,
        response_format: "mp3",
        instructions: "Read the Hebrew clearly and slowly, as a language teacher would for a beginner.",
      })
    );
    return res.blob();
  }

  if (engine === "elevenlabs") {
    const res = await post(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
      { "Content-Type": "application/json", "xi-api-key": key },
      JSON.stringify({
        text,
        model_id: VOICES.elevenlabs.model,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 0.9 },
      })
    );
    return res.blob();
  }

  if (engine === "gemini") {
    const res = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${VOICES.gemini.model}:generateContent?key=${encodeURIComponent(key)}`,
      { "Content-Type": "application/json" },
      JSON.stringify({
        contents: [{ parts: [{ text: `Say this Hebrew sentence clearly and slowly, for a beginner learning Hebrew: ${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      })
    );
    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) throw new VoiceError("the voice service returned no audio", 0);
    const rate = Number((part.inlineData.mimeType || "").match(/rate=(\d+)/)?.[1]) || 24000;
    return pcmToWav(b64ToBytes(part.inlineData.data), rate);
  }

  throw new VoiceError("unknown voice engine", 0);
}

/* The object URL for a sentence: from the cache if it is there, otherwise
   generated and then cached. Concurrent callers share one request. */
const inFlight = new Map();

export async function voiceUrl(text, { engine = activeEngine(), voice } = {}) {
  if (engine === "browser") return null;
  const id = voice || settings.voice[engine];
  const h = await hash(`${engine}:${id}:${text}`);
  const hit = await cacheGet(h);
  if (hit) return hit;
  if (inFlight.has(h)) return inFlight.get(h);
  const job = synthesize(text, engine, id)
    .then((blob) => cachePut(h, blob))
    .finally(() => inFlight.delete(h));
  inFlight.set(h, job);
  return job;
}

/* Warm the cache for the sentences a session is about to ask for, a couple at
   a time so the first exercise is not waiting on the twelfth. */
export async function prefetchVoices(texts, { concurrency = 2 } = {}) {
  if (!canGenerateSpeech()) return;
  const queue = [...new Set(texts.filter(Boolean))];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const text = queue.shift();
      try { await voiceUrl(text); } catch (e) { queue.length = 0; /* stop on the first failure */ }
    }
  });
  await Promise.all(workers);
}

/* ------------------------------------------------------------------ */
/* Listening back                                                      */
/* ------------------------------------------------------------------ */
export const canTranscribe = () => !!getKeyFor("openai") || !!getKeyFor("gemini");

/* What the learner actually said, for the speaking exercises. The browser's
   own recogniser mostly does not do Hebrew; Whisper does. */
export async function transcribeHebrew(blob) {
  const openai = getKeyFor("openai");
  if (openai) {
    const form = new FormData();
    form.append("file", blob, "speech.webm");
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("language", "he");
    const res = await post("https://api.openai.com/v1/audio/transcriptions", { Authorization: `Bearer ${openai}` }, form);
    const data = await res.json();
    return String(data.text || "").trim();
  }
  const gemini = getKeyFor("gemini");
  if (gemini) {
    const dataUrl = await blobToDataUrl(blob);
    const res = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(gemini)}`,
      { "Content-Type": "application/json" },
      JSON.stringify({
        contents: [{
          parts: [
            { text: "Transcribe this Hebrew speech. Reply with the Hebrew text only, no punctuation beyond what is spoken, no commentary." },
            { inlineData: { mimeType: blob.type || "audio/webm", data: dataUrl.split(",")[1] } },
          ],
        }],
      })
    );
    const data = await res.json();
    return String(data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "").trim();
  }
  throw new VoiceError("no key that can transcribe speech", 0);
}

/* One tiny request, to check a pasted key before it is saved — the key is
   passed straight to the request rather than stored first, so a bad one never
   lands in the browser. */
export async function testVoiceKey(engine, key) {
  const blob = await synthesize("שלום", engine, settings.voice[engine], key.trim());
  if (!blob || blob.size < 200) throw new VoiceError("that key produced no audio", 0);
  return true;
}
