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
  const parts = clean.split(/(?<=[.!?…][”"׳״']?)\s+/);
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

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
