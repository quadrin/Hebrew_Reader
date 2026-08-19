/* Root families — the thing that turns 2,000 Hebrew words into 5,000.

   Almost every Hebrew word is three consonants poured into a pattern. Know
   כ־ת־ב and a vowel pattern, and כותב, נכתב, מכתב, כתובת and התכתבות stop being
   five words to memorise and become one word you can already mostly read. This
   is the single largest lever an intermediate learner has, and nothing in the
   app touches it: the tutor asks for the shoresh on every lookup and then
   flattens it into a note string nobody indexes.

   These families are hand-verified rather than derived. Clustering the course's
   2,556 lexicon words by consonant skeleton finds 112 candidate families, and
   the good ones are very good — but it also puts מעילים (coats, מ־ע־ל) with
   נעלם (disappears, ע־ל־מ), מתייעצים (consult, י־ע־ץ) with עצם, and files
   "blog" and "biology" together. A wrong family teaches a falsehood that is
   worse than the gap it fills, so every member below was checked by hand.
   `npm run check:roots` catches the gross errors mechanically — a member whose
   letters cannot come from the root at all — but it cannot catch a plausible
   wrong one. The hand pass is the real guarantee.

   `form` names the binyan for verbs and the kind of thing for nouns, because
   the binyan is the half of the system that generalises: once nif'al reads as
   the passive of pa'al, נכתב, נשמע, נסגר and נפתח all arrive at once.

   Weak roots lose letters — ג־ו־ר gives גר, י־ד־ע gives מודע — so a member is
   not required to show every root letter, only to be consistent with it.
*/

export const ROOTS = [
  {
    root: "כ-ת-ב", sense: "writing",
    words: [
      { he: "כותב", en: "writes", form: "pa'al" },
      { he: "נכתב", en: "is written", form: "nif'al — the passive" },
      { he: "מכתב", en: "a letter", form: "noun" },
      { he: "כתובת", en: "an address", form: "noun" },
      { he: "כתב", en: "handwriting, script", form: "noun" },
    ],
  },
  {
    root: "ל-מ-ד", sense: "learning",
    words: [
      { he: "לומד", en: "learns", form: "pa'al" },
      { he: "מלמד", en: "teaches", form: "pi'el — makes someone learn" },
      { he: "תלמיד", en: "a pupil", form: "noun" },
      { he: "לימוד", en: "study", form: "noun" },
    ],
  },
  {
    root: "ש-מ-ע", sense: "hearing",
    words: [
      { he: "שומע", en: "hears", form: "pa'al" },
      { he: "נשמע", en: "sounds, is heard", form: "nif'al — the passive" },
      { he: "משמיע", en: "plays, sounds out", form: "hif'il — makes heard" },
      { he: "משמעות", en: "meaning", form: "noun" },
      { he: "שמועה", en: "a rumour", form: "noun" },
    ],
  },
  {
    root: "ד-ב-ר", sense: "speaking",
    words: [
      { he: "מדבר", en: "speaks", form: "pi'el" },
      { he: "מדובר", en: "is spoken of", form: "pu'al — the passive" },
      { he: "דבר", en: "a thing", form: "noun" },
      { he: "דיבור", en: "speech", form: "noun" },
      { he: "מדבר", en: "a desert", form: "noun — same letters, different word" },
    ],
  },
  {
    root: "ח-ש-ב", sense: "thinking, counting",
    words: [
      { he: "חושב", en: "thinks", form: "pa'al" },
      { he: "מחשב", en: "a computer", form: "noun" },
      { he: "חשבון", en: "an account, arithmetic", form: "noun" },
      { he: "חשוב", en: "important", form: "adjective" },
      { he: "מחשבה", en: "a thought", form: "noun" },
    ],
  },
  {
    root: "ס-פ-ר", sense: "counting, recounting",
    words: [
      { he: "סופר", en: "counts", form: "pa'al" },
      { he: "מספר", en: "tells, recounts", form: "pi'el" },
      { he: "ספר", en: "a book", form: "noun" },
      { he: "סיפור", en: "a story", form: "noun" },
      { he: "ספרות", en: "literature", form: "noun" },
      { he: "מספר", en: "a number", form: "noun" },
    ],
  },
  {
    root: "ש-ל-מ", sense: "wholeness",
    words: [
      { he: "שלם", en: "whole, complete", form: "adjective" },
      { he: "משלם", en: "pays", form: "pi'el — makes whole" },
      { he: "שלום", en: "peace, hello", form: "noun" },
      { he: "תשלום", en: "a payment", form: "noun" },
    ],
    impostors: [{ he: "משכורת", en: "a salary", from: "ש-כ-ר" }],
  },
  {
    root: "ז-מ-נ", sense: "time, appointing",
    words: [
      { he: "זמן", en: "time", form: "noun" },
      { he: "מזמין", en: "invites, orders", form: "hif'il" },
      { he: "הזמנה", en: "an invitation, an order", form: "noun" },
      { he: "מוזמן", en: "invited", form: "huf'al — the passive" },
      { he: "זמין", en: "available", form: "adjective" },
    ],
  },
  {
    root: "ח-ד-ש", sense: "newness",
    words: [
      { he: "חדש", en: "new", form: "adjective" },
      { he: "מחדש", en: "renews", form: "pi'el" },
      { he: "חודש", en: "a month", form: "noun" },
      { he: "חדשות", en: "the news", form: "noun" },
      { he: "חידוש", en: "an innovation", form: "noun" },
    ],
  },
  {
    root: "ק-ר-א", sense: "reading, calling",
    words: [
      { he: "קורא", en: "reads, calls", form: "pa'al" },
      { he: "נקרא", en: "is called", form: "nif'al — the passive" },
      { he: "קריאה", en: "reading, a call", form: "noun" },
      { he: "מקרא", en: "scripture, a legend on a map", form: "noun" },
    ],
  },
  {
    root: "ר-א-ה", sense: "seeing",
    words: [
      { he: "רואה", en: "sees", form: "pa'al" },
      { he: "נראה", en: "looks, seems", form: "nif'al" },
      { he: "מראה", en: "shows", form: "hif'il — makes see" },
      { he: "מראה", en: "a mirror, a sight", form: "noun" },
      { he: "ראייה", en: "eyesight", form: "noun" },
    ],
  },
  {
    root: "י-ד-ע", sense: "knowing",
    words: [
      { he: "יודע", en: "knows", form: "pa'al" },
      { he: "ידע", en: "knowledge", form: "noun" },
      { he: "מודיע", en: "informs", form: "hif'il — makes known" },
      { he: "הודעה", en: "a message", form: "noun" },
      { he: "ידוע", en: "known", form: "adjective" },
    ],
  },
  {
    root: "ח-ז-ר", sense: "returning",
    words: [
      { he: "חוזר", en: "returns, goes back", form: "pa'al" },
      { he: "מחזיר", en: "gives back", form: "hif'il — makes return" },
      { he: "מחזור", en: "a cycle, recycling", form: "noun" },
      { he: "חזרה", en: "a return, a rehearsal", form: "noun" },
    ],
  },
  {
    root: "ע-ב-ד", sense: "working",
    words: [
      { he: "עובד", en: "works", form: "pa'al" },
      { he: "עבודה", en: "work, a job", form: "noun" },
      { he: "מעבד", en: "processes", form: "pi'el" },
      { he: "עובד", en: "an employee", form: "noun" },
      { he: "מעבדה", en: "a laboratory", form: "noun" },
    ],
  },
  {
    root: "י-ש-ב", sense: "sitting, settling",
    words: [
      { he: "יושב", en: "sits", form: "pa'al" },
      { he: "מושב", en: "a seat, a moshav", form: "noun" },
      { he: "תושב", en: "a resident", form: "noun" },
      { he: "ישיבה", en: "a sitting, a meeting", form: "noun" },
      { he: "מיישב", en: "settles", form: "pi'el" },
    ],
  },
  {
    root: "ק-ש-ר", sense: "tying, connecting",
    words: [
      { he: "קושר", en: "ties", form: "pa'al" },
      { he: "קשר", en: "a connection, a tie", form: "noun" },
      { he: "מתקשר", en: "phones, gets in touch", form: "hitpa'el" },
      { he: "תקשורת", en: "communication, the media", form: "noun" },
      { he: "קשור", en: "connected, related", form: "adjective" },
    ],
  },
  {
    root: "ס-ד-ר", sense: "order",
    words: [
      { he: "סדר", en: "order, a seder", form: "noun" },
      { he: "מסדר", en: "arranges", form: "pi'el" },
      { he: "מסודר", en: "tidy, arranged", form: "pu'al — the passive" },
      { he: "מסתדר", en: "manages, works out", form: "hitpa'el" },
      { he: "בסדר", en: "all right, fine", form: "phrase — literally in order" },
    ],
  },
  {
    root: "ב-ח-ר", sense: "choosing",
    words: [
      { he: "בוחר", en: "chooses", form: "pa'al" },
      { he: "נבחר", en: "is chosen, elected", form: "nif'al — the passive" },
      { he: "בחירה", en: "a choice", form: "noun" },
      { he: "בחירות", en: "elections", form: "noun" },
    ],
  },
  {
    root: "ש-מ-ר", sense: "guarding, keeping",
    words: [
      { he: "שומר", en: "guards, keeps", form: "pa'al" },
      { he: "נשמר", en: "is kept", form: "nif'al — the passive" },
      { he: "שמירה", en: "guarding", form: "noun" },
      { he: "שמורה", en: "a nature reserve", form: "noun" },
      { he: "משמר", en: "a guard, a watch", form: "noun" },
    ],
  },
  {
    root: "כ-נ-ס", sense: "entering, gathering",
    words: [
      { he: "נכנס", en: "enters", form: "nif'al" },
      { he: "כניסה", en: "an entrance", form: "noun" },
      { he: "מכניס", en: "brings in", form: "hif'il" },
      { he: "הכנסה", en: "income", form: "noun" },
      { he: "כנסת", en: "the Knesset, an assembly", form: "noun" },
    ],
  },
  {
    root: "ל-ב-ש", sense: "wearing",
    words: [
      { he: "לובש", en: "wears", form: "pa'al" },
      { he: "מלביש", en: "dresses someone", form: "hif'il" },
      { he: "מתלבש", en: "gets dressed", form: "hitpa'el — dresses oneself" },
      { he: "לבוש", en: "dressed, clothing", form: "adjective, noun" },
      { he: "תלבושת", en: "a uniform, an outfit", form: "noun" },
    ],
  },
  {
    root: "פ-ת-ח", sense: "opening",
    words: [
      { he: "פותח", en: "opens", form: "pa'al" },
      { he: "נפתח", en: "is opened", form: "nif'al — the passive" },
      { he: "מפתח", en: "a key", form: "noun" },
      { he: "פתיחה", en: "an opening", form: "noun" },
      { he: "מפתח", en: "develops", form: "pi'el" },
    ],
  },
  {
    root: "ס-ג-ר", sense: "closing",
    words: [
      { he: "סוגר", en: "closes", form: "pa'al" },
      { he: "נסגר", en: "is closed", form: "nif'al — the passive" },
      { he: "סגור", en: "closed", form: "adjective" },
      { he: "מסגרת", en: "a frame, a framework", form: "noun" },
      { he: "הסגר", en: "a quarantine", form: "noun" },
    ],
  },
  {
    root: "ג-ד-ל", sense: "growing, size",
    words: [
      { he: "גדל", en: "grows", form: "pa'al" },
      { he: "גדול", en: "big", form: "adjective" },
      { he: "מגדל", en: "raises, grows something", form: "pi'el" },
      { he: "גודל", en: "size", form: "noun" },
      { he: "מגדל", en: "a tower", form: "noun" },
    ],
  },
  {
    root: "ר-ג-ש", sense: "feeling",
    words: [
      { he: "מרגיש", en: "feels", form: "hif'il" },
      { he: "רגש", en: "an emotion", form: "noun" },
      { he: "רגיש", en: "sensitive", form: "adjective" },
      { he: "התרגשות", en: "excitement", form: "noun" },
      { he: "מתרגש", en: "gets excited", form: "hitpa'el" },
    ],
  },
  {
    root: "צ-ל-מ", sense: "photographing, image",
    words: [
      { he: "מצלם", en: "photographs", form: "pi'el" },
      { he: "צילום", en: "a photograph", form: "noun" },
      { he: "צלם", en: "a photographer", form: "noun" },
      { he: "מצלמה", en: "a camera", form: "noun" },
      { he: "צלם", en: "an image, a likeness", form: "noun" },
    ],
  },
  {
    root: "ב-ש-ל", sense: "cooking, ripening",
    words: [
      { he: "מבשל", en: "cooks", form: "pi'el" },
      { he: "מבושל", en: "cooked", form: "pu'al — the passive" },
      { he: "בישול", en: "cooking", form: "noun" },
      { he: "בשל", en: "ripe", form: "adjective" },
      { he: "תבשיל", en: "a cooked dish", form: "noun" },
    ],
  },
  {
    root: "ש-א-ל", sense: "asking, borrowing",
    words: [
      { he: "שואל", en: "asks, borrows", form: "pa'al" },
      { he: "שאלה", en: "a question", form: "noun" },
      { he: "נשאל", en: "is asked", form: "nif'al — the passive" },
      { he: "משאל", en: "a poll, a referendum", form: "noun" },
      { he: "שאילתה", en: "a query", form: "noun" },
    ],
  },
  {
    root: "א-ה-ב", sense: "loving",
    words: [
      { he: "אוהב", en: "loves", form: "pa'al" },
      { he: "אהבה", en: "love", form: "noun" },
      { he: "אהוב", en: "beloved", form: "adjective" },
      { he: "מאוהב", en: "in love", form: "pu'al" },
    ],
    impostors: [{ he: "אוהד", en: "a fan", from: "א-ה-ד" }],
  },
  {
    root: "ח-ל-פ", sense: "changing, passing",
    words: [
      { he: "מחליף", en: "replaces, swaps", form: "hif'il" },
      { he: "חילוף", en: "an exchange", form: "noun" },
      { he: "חלופה", en: "an alternative", form: "noun" },
      { he: "מוחלף", en: "is replaced", form: "huf'al — the passive" },
      { he: "חולף", en: "passes by, fleeting", form: "pa'al" },
    ],
  },
];

const FINAL = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
const WEAK = new Set(["א", "ה", "ו", "י", "נ"]);
const norm = (s) => String(s).replace(/[֑-ׇ]/g, "").split("").map((c) => FINAL[c] || c).join("");

/* Could this word come from this root? The root's letters must appear in order,
   and a weak letter is allowed to have dropped, because they do: ג-ו-ר gives
   גר, י-ד-ע gives מודע. It backtracks rather than taking the first match — the
   י in מודיע is a mater lectionis sitting after the ד, not the root's own י,
   and a greedy scan that grabs it then finds no ד left and calls a good word
   impossible.

   The checker and the drill share this one definition on purpose: the drill
   picks a word from another family as an odd-one-out only when it fails this,
   and the checker refuses a member that fails it, so neither can drift. */
export function fitsRoot(word, root) {
  const w = norm(word);
  const letters = String(root).split("-").map(norm);
  const fits = (li, at) => {
    if (li === letters.length) return true;
    const L = letters[li];
    for (let i = at; i < w.length; i++) if (w[i] === L && fits(li + 1, i + 1)) return true;
    return WEAK.has(L) && fits(li + 1, at);
  };
  return fits(0, 0);
}

/* One flat index of every word that belongs to a family, for the drill's
   distractors and for looking a word up by its family. */
export const ROOT_OF = (() => {
  const m = new Map();
  for (const f of ROOTS) for (const w of f.words) if (!m.has(w.he)) m.set(w.he, f.root);
  return m;
})();

export const familyFor = (root) => ROOTS.find((f) => f.root === root) || null;
