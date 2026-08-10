/* Hebrew text helpers */

export const stripWord = (t) => t.replace(/[^֑-תװ-ײ]/g, "");
export const removeNikkud = (s) => s.replace(/[֑-ׇ]/g, "");
export const stripBidi = (s) => s.replace(/[‎‏‪-‮⁦-⁩]/g, "");

/* Split a page of prose into sentences for line-by-line reading */
export function splitSentences(text) {
  let clean = stripBidi(text).replace(/\s+/g, " ").trim();
  if (!clean) return [];
  /* Some RTL extractions orphan punctuation ("דעתו .כל") — reattach it */
  clean = clean
    .replace(/\s+([.!?;:,…])/g, "$1")
    .replace(/([.!?…])(?=[֐-׿“"'A-Za-z])/g, "$1 ")
    .replace(/([,;:])(?=[֐-׿])/g, "$1 ");
  /* Split after terminator (+ optional closing quote) followed by whitespace.
     A marker + split is used instead of a lookbehind, which Safari < 16.4
     can't parse — a lookbehind here blanked the whole app on older iPhones. */
  const parts = clean.replace(/([.!?…][”"׳״']?)\s+/g, "$1\u0000").split("\u0000");
  const out = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    /* merge tiny fragments (stray punctuation, numbers) into the previous sentence */
    if (t.length < 4 && out.length) out[out.length - 1] += " " + t;
    else out.push(t);
  }
  return out;
}

export function paginateText(raw) {
  const sentences = splitSentences(stripBidi(raw).replace(/\n+/g, " "));
  const pages = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && cur.length + s.length > 1500) {
      pages.push(cur);
      cur = s;
    } else cur = cur ? cur + " " + s : s;
  }
  if (cur) pages.push(cur);
  return pages;
}

/* Speech — browsers load voices asynchronously; warm the list at startup */
export function warmSpeech() {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", () => {});
  } catch (e) { /* no audio */ }
}

export function speak(text) {
  try {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(removeNikkud(stripBidi(text)));
    u.lang = "he-IL";
    u.rate = 0.8;
    const voices = window.speechSynthesis.getVoices();
    const heVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("he"));
    if (heVoice) u.voice = heVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) { /* no audio — fail quietly */ }
}

/* Speak one sentence and call onend when finished (or on any failure), so a
   caller can chain sentences for read-aloud mode. Returns nothing; use
   stopSpeech() to cancel. */
export function speakOne(text, { rate = 0.85, onend } = {}) {
  try {
    if (!window.speechSynthesis) { onend?.(); return; }
    const u = new SpeechSynthesisUtterance(removeNikkud(stripBidi(text)));
    u.lang = "he-IL";
    u.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const heVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("he"));
    if (heVoice) u.voice = heVoice;
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(guard); onend?.(); } };
    /* some engines never fire onend — advance anyway after a generous cap */
    const guard = setTimeout(finish, 8000 + text.length * 160);
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.speak(u);
  } catch (e) {
    onend?.();
  }
}

export function stopSpeech() {
  try { window.speechSynthesis?.cancel(); } catch (e) { /* no audio */ }
}

/* Forgiving comparison for typed answers: ignore nikkud, punctuation and
   final-letter forms so recall is graded, not orthography */
const FINALS = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
export const normalizeHebrew = (s) =>
  removeNikkud(stripBidi(s || ""))
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/[^א-ת]/g, "");
export const answersMatch = (a, b) => {
  const x = normalizeHebrew(a), y = normalizeHebrew(b);
  return !!x && x === y;
};

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
