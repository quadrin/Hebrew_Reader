/* Claude API — the tutor behind glosses, translations, and page quizzes.
   Calls go directly from the browser to the Anthropic API using a key the
   reader supplies in Settings. The key lives only in this browser's
   localStorage and is sent to nobody but api.anthropic.com. */

const KEY_STORAGE = "lavan-api-key";
const MODEL_STORAGE = "lavan-api-model";

export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const MODELS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — balanced (recommended)" },
  { id: "claude-opus-5", label: "Claude Opus 5 — most capable" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — fastest & cheapest" },
];

const safeGet = (k) => { try { return window.localStorage.getItem(k); } catch (e) { return null; } };
const safeSet = (k, v) => { try { window.localStorage.setItem(k, v); } catch (e) {} };
const safeDel = (k) => { try { window.localStorage.removeItem(k); } catch (e) {} };

export const getApiKey = () => safeGet(KEY_STORAGE) || "";
export const setApiKey = (key) => (key ? safeSet(KEY_STORAGE, key.trim()) : safeDel(KEY_STORAGE));
export const clearApiKey = () => safeDel(KEY_STORAGE);
export const hasApiKey = () => !!getApiKey();
export const getModel = () => safeGet(MODEL_STORAGE) || DEFAULT_MODEL;
export const setModel = (m) => safeSet(MODEL_STORAGE, m);

export class AiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

async function rawCall(prompt, maxTokens, apiKey, model) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      /* Required for calls made straight from a browser page. The key is the
         reader's own and never leaves their machine except to Anthropic. */
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!resp.ok) {
    let msg = `API error ${resp.status}`;
    try {
      const err = await resp.json();
      if (err?.error?.message) msg = err.error.message;
    } catch (e) { /* non-JSON error body */ }
    throw new AiError(msg, resp.status);
  }
  const data = await resp.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return text.replace(/```json|```/g, "").trim();
}

export async function callClaude(prompt, maxTokens = 800) {
  const key = getApiKey();
  if (!key) throw new AiError("No API key set", 0);
  return rawCall(prompt, maxTokens, key, getModel());
}

/* Verify a key before saving it — one tiny request */
export async function testApiKey(key, model) {
  const out = await rawCall('Reply with only the word "OK".', 16, key.trim(), model || getModel());
  return out.length > 0;
}

/* Models sometimes wrap JSON in prose — recover the object */
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) { /* fall through to brace extraction */ }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error("bad json");
}

export async function fetchQuickGloss(word, sentence) {
  const prompt = `You are a Hebrew tutor. A learner tapped the word "${word}" in this sentence from a Hebrew literary text (unvocalized, possibly archaic or Mishnaic in register): "${sentence}"
The word may carry prefixes (ו, ה, ב, ל, כ, ש, מ) or suffixes — identify the base word.
Respond with ONLY valid JSON, no markdown:
{"gloss":"short English meaning as used in this sentence","base":"the dictionary form in Hebrew","translit":"simple transliteration of the tapped word","root":"shoresh with hyphens like כ-ת-ב, or null","pos":"brief part of speech; for verbs add binyan and tense"}`;
  return parseJson(await callClaude(prompt, 400));
}

export async function fetchDeepDive(word, sentenceHe, sentenceEn) {
  const prompt = `You are a warm, encouraging Hebrew tutor. Explain the Hebrew word "${word}" as it is used in this sentence: "${sentenceHe}"${sentenceEn ? ` (English: "${sentenceEn}")` : ""}. The text may be unvocalized literary Hebrew with an archaic or Mishnaic flavor.
Respond with ONLY valid JSON — no markdown, no backticks — in exactly this shape:
{"gloss":"short English meaning in this context","translit":"simple transliteration","root":"the shoresh with hyphens like ג-ו-ר, or null if not applicable","pos":"part of speech; for verbs include binyan and tense","tip":"one short friendly insight about this word (grammar, register, or culture), max 2 sentences","examples":[{"he":"a simple modern Hebrew sentence with full nikkud using this word or its root","en":"its translation"},{"he":"another simple example with nikkud","en":"its translation"}]}
Keep both examples at beginner level, 4-8 words each.`;
  return parseJson(await callClaude(prompt, 1000));
}

export async function fetchSentenceEn(sentence) {
  const prompt = `Translate this Hebrew sentence into natural, clear English. It comes from a Hebrew literary text and the register may be archaic or Mishnaic — translate the meaning, staying readable. Respond with ONLY the English translation, nothing else.
Hebrew: "${sentence}"`;
  const out = await callClaude(prompt, 500);
  return out.replace(/^["“]|["”]$/g, "");
}

export async function fetchPageQuiz(pageText) {
  const prompt = `You are a Hebrew reading tutor. Here is one page from a Hebrew literary text a learner just read:
---
${pageText}
---
Write exactly 3 multiple-choice reading-comprehension questions in English about what happens on this page. Test understanding of the events and meaning, not trivia. Vary which option is correct.
Respond with ONLY valid JSON, no markdown:
{"questions":[{"q":"question in English","opts":["option A","option B","option C","option D"],"correct":0,"ev":"the short Hebrew phrase from the page (under 12 words) that contains the answer"}]}`;
  const parsed = parseJson(await callClaude(prompt, 1400));
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) throw new Error("bad quiz");
  for (const q of parsed.questions) {
    if (!q.q || !Array.isArray(q.opts) || q.opts.length < 2) throw new Error("bad quiz");
    if (typeof q.correct !== "number" || q.correct < 0 || q.correct >= q.opts.length) throw new Error("bad quiz");
  }
  return parsed.questions;
}
