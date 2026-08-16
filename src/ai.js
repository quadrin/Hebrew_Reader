/* AI tutor — glosses, translations, deep dives, and page quizzes.
   Works with any of three providers; the reader picks one in Settings and
   pastes their own API key. Calls go directly from the browser to the chosen
   provider. Keys live only in this browser's localStorage and are sent to
   nobody but that provider's API. */

const PROVIDER_KEY = "lavan-ai-provider";
const keyKey = (p) => `lavan-api-key-${p}`;
const modelKey = (p) => `lavan-api-model-${p}`;

export const PROVIDERS = {
  anthropic: {
    label: "Claude (Anthropic)",
    short: "Claude",
    keyPlaceholder: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyUrlLabel: "console.anthropic.com",
    defaultModel: "claude-sonnet-4-6",
    models: [
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — balanced (recommended)" },
      { id: "claude-opus-5", label: "Claude Opus 5 — most capable" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — fastest & cheapest" },
    ],
  },
  openai: {
    label: "ChatGPT (OpenAI)",
    short: "ChatGPT",
    keyPlaceholder: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    keyUrlLabel: "platform.openai.com",
    defaultModel: "gpt-5.6-luna",
    models: [
      { id: "gpt-5.6-luna", label: "GPT-5.6 Luna — newest, fast & low-cost (recommended)" },
      { id: "gpt-5.1", label: "GPT-5.1 — balanced" },
      { id: "gpt-5-mini", label: "GPT-5 mini — fastest & cheapest" },
      { id: "gpt-4.1", label: "GPT-4.1 — classic, no reasoning" },
    ],
  },
  gemini: {
    label: "Gemini (Google)",
    short: "Gemini",
    keyPlaceholder: "AIza…",
    keyUrl: "https://aistudio.google.com/apikey",
    keyUrlLabel: "aistudio.google.com",
    defaultModel: "gemini-2.5-flash",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash — balanced (recommended)" },
      { id: "gemini-3-pro-preview", label: "Gemini 3 Pro — most capable (preview)" },
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite — fastest & cheapest" },
    ],
  },
};
export const PROVIDER_IDS = Object.keys(PROVIDERS);

const safeGet = (k) => { try { return window.localStorage.getItem(k); } catch (e) { return null; } };
const safeSet = (k, v) => { try { window.localStorage.setItem(k, v); } catch (e) {} };
const safeDel = (k) => { try { window.localStorage.removeItem(k); } catch (e) {} };

/* v1 stored a single Anthropic key under lavan-api-key — carry it over */
(function migrateLegacy() {
  const legacyKey = safeGet("lavan-api-key");
  if (legacyKey && !safeGet(keyKey("anthropic"))) {
    safeSet(keyKey("anthropic"), legacyKey);
    const legacyModel = safeGet("lavan-api-model");
    if (legacyModel) safeSet(modelKey("anthropic"), legacyModel);
    safeSet(PROVIDER_KEY, "anthropic");
  }
  safeDel("lavan-api-key");
  safeDel("lavan-api-model");
})();

export function getProvider() {
  const p = safeGet(PROVIDER_KEY);
  return p && PROVIDERS[p] ? p : "anthropic";
}
export const activate = (p) => safeSet(PROVIDER_KEY, p);
export const getKeyFor = (p) => safeGet(keyKey(p)) || "";
export const setKeyFor = (p, key) => (key ? safeSet(keyKey(p), key.trim()) : safeDel(keyKey(p)));
export function getModelFor(p) {
  const stored = safeGet(modelKey(p));
  const models = PROVIDERS[p]?.models || [];
  return stored && models.some((m) => m.id === stored) ? stored : PROVIDERS[p]?.defaultModel;
}
export const setModelFor = (p, m) => safeSet(modelKey(p), m);
export const hasApiKey = () => !!getKeyFor(getProvider());

export class AiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

async function post(url, headers, body) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    let msg = `API error ${resp.status}`;
    try {
      const err = await resp.json();
      /* all three providers wrap errors as {error:{message}} */
      if (err?.error?.message) msg = err.error.message;
    } catch (e) { /* non-JSON error body */ }
    throw new AiError(msg, resp.status);
  }
  return resp.json();
}

async function rawCall(prompt, maxTokens, provider, apiKey, model) {
  let text = "";
  if (provider === "openai") {
    const body = { model, messages: [{ role: "user", content: prompt }] };
    if (/^gpt-5/.test(model)) {
      /* GPT-5 models spend "reasoning" tokens from the same budget — keep the
         reasoning light and leave headroom so the visible answer survives */
      body.reasoning_effort = "low";
      body.max_completion_tokens = maxTokens + 1000;
    } else {
      body.max_completion_tokens = maxTokens;
    }
    const data = await post(
      "https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${apiKey}` },
      body
    );
    text = data.choices?.[0]?.message?.content || "";
  } else if (provider === "gemini") {
    const data = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { "x-goog-api-key": apiKey },
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        /* headroom for Gemini's dynamic thinking, which shares the output budget */
        generationConfig: { maxOutputTokens: maxTokens + 1024 },
      }
    );
    text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  } else {
    const data = await post(
      "https://api.anthropic.com/v1/messages",
      {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        /* Required for calls made straight from a browser page */
        "anthropic-dangerous-direct-browser-access": "true",
      },
      { model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }
    );
    text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  }
  return text.replace(/```json|```/g, "").trim();
}

async function callAi(prompt, maxTokens = 800) {
  const provider = getProvider();
  const key = getKeyFor(provider);
  if (!key) throw new AiError("No API key set", 0);
  const text = await rawCall(prompt, maxTokens, provider, key, getModelFor(provider));
  if (!text) throw new AiError("The model returned an empty reply — try again", 0);
  return text;
}

/* Verify a key before saving it — one tiny request */
export async function testApiKey(provider, key, model) {
  const out = await rawCall('Reply with only the word "OK".', 64, provider, key.trim(), model);
  if (!out) throw new AiError("The model returned an empty reply", 0);
  return true;
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
  const prompt = `You are a Hebrew tutor. A learner tapped ONE word, "${word}", in this sentence from a Hebrew literary text (unvocalized, possibly archaic or Mishnaic in register): "${sentence}"
The sentence is context only, to pick the right sense. The gloss must translate the tapped word ALONE — the letters of "${word}" and nothing more. Never fold in the meaning of neighboring words. Example: for the tapped word "משראה" inside "משראה את הים", the gloss is "when he saw" — NOT "when he saw the sea".
The word may carry prefixes (ו, ה, ב, ל, כ, ש, מ) or suffixes — include their meaning ("and the house") and identify the base word.
Respond with ONLY valid JSON, no markdown:
{"gloss":"English meaning of the tapped word only, 1-5 words","base":"the dictionary form in Hebrew with nikkud — for verbs the INFINITIVE (e.g. לִכְתֹּב), for nouns the bare singular without ב/ל/כ/מ/ה/ו/ש prefixes","translit":"simple transliteration of the tapped word","root":"shoresh with hyphens like כ-ת-ב, or null","pos":"brief part of speech; for verbs add binyan and tense","phrase":"ONLY if the tapped word forms a fixed multi-word expression, construct phrase (סמיכות), or idiom with adjacent words in this sentence (like מִגְדַּל תַּצְפִּית or בֵּית סֵפֶר): that full phrase in its dictionary form with nikkud — otherwise null","phraseGloss":"English meaning of that phrase, 1-5 words, or null"}`;
  return parseJson(await callAi(prompt, 400));
}

export async function fetchDeepDive(word, sentenceHe, sentenceEn) {
  const prompt = `You are a warm, encouraging Hebrew tutor. Explain the Hebrew word "${word}" as it is used in this sentence: "${sentenceHe}"${sentenceEn ? ` (English: "${sentenceEn}")` : ""}. The text may be unvocalized literary Hebrew with an archaic or Mishnaic flavor.
Respond with ONLY valid JSON — no markdown, no backticks — in exactly this shape:
{"gloss":"English meaning of this word alone in this context, 1-5 words — never a translation of neighboring words","base":"the dictionary form in Hebrew with nikkud — for verbs the INFINITIVE (e.g. לִכְתֹּב), for nouns the bare singular without ב/ל/כ/מ/ה/ו/ש prefixes","translit":"simple transliteration","root":"the shoresh with hyphens like ג-ו-ר, or null if not applicable","pos":"part of speech; for verbs include binyan and tense","tip":"one short friendly insight about this word (grammar, register, or culture), max 2 sentences","examples":[{"he":"a simple modern Hebrew sentence with full nikkud using this word or its root","en":"its translation"},{"he":"another simple example with nikkud","en":"its translation"}]}
Keep both examples at beginner level, 4-8 words each.`;
  return parseJson(await callAi(prompt, 1000));
}

/* One call returns both the fluent translation and a per-word gloss list
   aligned to the sentence's tokens, for interlinear display. */
export async function fetchSentenceGlossed(sentence, tokens) {
  const n = tokens.length;
  const numbered = tokens.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const prompt = `You are a Hebrew tutor building an interlinear reader. Here is a Hebrew sentence from a literary text (register may be archaic or Mishnaic), followed by the same sentence tokenized into ${n} tokens:
Sentence: "${sentence}"
Tokens:
${numbered}
Respond with ONLY valid JSON, no markdown:
{"translation":"natural, clear English translation of the whole sentence","glosses":["short English gloss (1-3 words) of token 1 as used in THIS sentence","...one entry per token, in order"]}
Rules: "glosses" must have exactly ${n} entries, aligned to the token order. For punctuation-only or untranslatable tokens use "". Glosses give the contextual meaning of the token as a whole (including any prefixes), lowercase unless a proper noun.`;
  const parsed = parseJson(await callAi(prompt, 900));
  const translation = String(parsed.translation || "").replace(/^["“]|["”]$/g, "");
  let glosses = Array.isArray(parsed.glosses) ? parsed.glosses.map((g) => String(g ?? "")) : [];
  if (glosses.length > n) glosses = glosses.slice(0, n);
  while (glosses.length < n) glosses.push("");
  if (!translation) throw new Error("bad translation");
  return { en: translation, glosses };
}

/* Vocalize a page of unpointed Hebrew (nikkud). Verified loosely: stripping
   the nikkud back off must roughly reproduce the original. */
export async function fetchNikkud(pageText) {
  const prompt = `Add full nikkud (Hebrew vowel points, including dagesh and shin/sin dots) to this Hebrew text. The register may be literary, archaic, or Mishnaic — vocalize accordingly.
Rules: preserve every word, all punctuation, the word order, and every line break EXACTLY as given. Only add vowel points to the existing letters. Do not add, remove, reorder, or "correct" any words. Respond with ONLY the vocalized text, nothing else.
---
${pageText}`;
  const out = await callAi(prompt, 3000);
  const strip = (s) => s.replace(/[֑-ׇ]/g, "").replace(/\s+/g, " ").trim();
  const a = strip(pageText);
  const b = strip(out);
  const ratio = b.length / Math.max(a.length, 1);
  if (ratio < 0.85 || ratio > 1.15 || a.slice(0, 25) !== b.slice(0, 25)) {
    throw new AiError("The vocalized text didn't match the original — try again", 0);
  }
  return out;
}

/* Rewrite a page into easy, fully vocalized modern Hebrew — the "Simple
   Hebrew" reading mode for books above the reader's level */
export async function fetchSimplePage(pageText) {
  const prompt = `Rewrite this Hebrew passage in SIMPLE modern Hebrew for a beginner-to-intermediate learner, and add full nikkud (including dagesh and shin/sin dots) to every word of your rewrite.
Rules:
- Short sentences, about 4–9 words each. Common everyday vocabulary only.
- Keep ALL the events, people, and meaning. Do not skip anything, do not summarize, do not add anything new. Keep names exactly as they are.
- Keep the same order of events as the original.
- Plain prose — replace archaic or literary constructions with their everyday equivalents.
- Where the original starts a new paragraph (a new line), start a new line in your rewrite too.
Respond with ONLY the rewritten Hebrew text, nothing else — no introduction, no translation, no notes.
---
${pageText}`;
  const out = (await callAi(prompt, 3500)).trim().replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
  /* sanity: mostly Hebrew and a plausible length next to the original */
  const strip = (s) => s.replace(/[֑-ׇ]/g, "").replace(/\s+/g, " ").trim();
  const hebChars = (out.match(/[א-ת]/g) || []).length;
  const ratio = strip(out).length / Math.max(strip(pageText).length, 1);
  if (hebChars < 20 || ratio < 0.25 || ratio > 2.5) {
    throw new AiError("The simplified page didn't come out right — try again", 0);
  }
  return out;
}

/* Titles are the one Hebrew in this app a learner can't tap to translate.
   Everything else is read after you've chosen it; a title is what you read to
   choose. Batched, because a shelf of forty is worth one request, not forty. */
export async function fetchTitleTranslations(titles) {
  const list = titles.map((t, i) => `${i}\t${t}`).join("\n");
  const prompt = `Below are Hebrew titles of literary works, or the names of shelves they are filed under. Give each one in English.
Where the work is known in English under an established title, use that title (הנסיך הקטן is "The Little Prince", not "The Small Prince"). Otherwise translate the meaning plainly. Never transliterate, never explain, never add the author. Keep each under about eight words. Parenthetical notes — a place, a source — should be translated too and kept in the parentheses.
The register may be biblical, rabbinic or archaic; render it in ordinary modern English.
---
${list}
---
Respond with ONLY valid JSON, no markdown, keyed by the number on each line:
{"0":"English title","1":"English title"}`;
  const parsed = parseJson(await callAi(prompt, 200 + titles.length * 40));
  const out = new Map();
  titles.forEach((t, i) => {
    const en = parsed[String(i)];
    if (typeof en === "string" && en.trim()) out.set(t, en.trim());
  });
  return out;
}

/* Grammar breakdown of one sentence, as short bullet points */
export async function fetchGrammar(sentence) {
  const prompt = `Explain the grammar of this Hebrew sentence for an intermediate learner. The register may be archaic or Mishnaic — note that where relevant.
"${sentence}"
Respond with ONLY valid JSON, no markdown:
{"points":["3 to 6 short bullet points covering: overall clause structure, each verb's root/binyan/tense/person, notable prefixes and suffixes, and register notes"]}`;
  const parsed = parseJson(await callAi(prompt, 700));
  if (!Array.isArray(parsed.points) || parsed.points.length === 0) throw new Error("bad grammar");
  return parsed.points.map((p) => String(p));
}

export async function fetchPageQuiz(pageText) {
  const prompt = `You are a Hebrew reading tutor. Here is one page from a Hebrew literary text a learner just read:
---
${pageText}
---
Write exactly 3 multiple-choice reading-comprehension questions in English about what happens on this page. Test understanding of the events and meaning, not trivia. Vary which option is correct.
Respond with ONLY valid JSON, no markdown:
{"questions":[{"q":"question in English","opts":["option A","option B","option C","option D"],"correct":0,"ev":"the short Hebrew phrase from the page (under 12 words) that contains the answer"}]}`;
  const parsed = parseJson(await callAi(prompt, 1400));
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) throw new Error("bad quiz");
  for (const q of parsed.questions) {
    if (!q.q || !Array.isArray(q.opts) || q.opts.length < 2) throw new Error("bad quiz");
    if (typeof q.correct !== "number" || q.correct < 0 || q.correct >= q.opts.length) throw new Error("bad quiz");
  }
  return parsed.questions;
}

/* ------------------------------------------------------------------ */
/* Grading                                                             */
/* ------------------------------------------------------------------ */
/* The course ships one accepted English per sentence; Duolingo ships dozens
   per sentence and grades them leniently. So an answer that means the right
   thing gets marked wrong here far more often than it should — "you are
   looking at a pretty woman" for "אתה רואה אישה יפה" is not a mistake anyone
   needs correcting. When the literal check fails, the model rules on whether
   the answer means the same thing, and an accepted one is remembered so the
   sentence is never argued about twice. */
/* Grading is on the critical path — someone is watching a spinner — so it does
   not use the tutor model. It uses the fastest model each provider has, with
   no reasoning budget and a two-token answer to produce. */
const FAST_MODEL = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4.1",
  gemini: "gemini-2.5-flash-lite",
};

export async function fetchAnswerRuling({ he, en, given, lang, signal }) {
  const target = lang === "he" ? "Hebrew" : "English";
  const prompt = `You are the grader for a beginner Hebrew course. Decide whether a learner's ${target} answer should be accepted.

Hebrew sentence: ${he}
The course's reference English: ${en}
The learner wrote (${target}): ${given}

Accept it when it means the same thing. Differences that do NOT matter: word order where both are natural, articles, contractions, punctuation, capitalisation, spelling slips, British or American spelling, a synonym of the same register ("beautiful" and "pretty", "see" and "look at"), or a different but equally valid tense phrasing of the same Hebrew form.
Reject it when the meaning changes: a different subject or object, wrong person, gender or number, a negation added or dropped, content invented or left out, or a different sentence altogether.
Be generous — this is a learner practising, not an exam.

Answer with one word — YES if it should be accepted, NO if it should not — then a dash and at most eight words of reason. Nothing else.`;

  const provider = getProvider();
  const key = getKeyFor(provider);
  if (!key) throw new AiError("No API key set", 0);
  const text = await rawCall(prompt, 40, provider, key, FAST_MODEL[provider] || getModelFor(provider));
  const accept = /^\s*(yes|true)\b/i.test(text);
  const why = text.replace(/^\s*(yes|no|true|false)\b[\s—-]*/i, "").trim();
  return { accept, why: why.slice(0, 120) };
}
