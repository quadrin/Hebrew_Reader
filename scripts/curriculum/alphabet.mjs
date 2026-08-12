/* The reading system: letters, their final forms, and the vowel signs.

   This is the one part of Hebrew that has to be taught before anything else
   and can't be inferred from a corpus — a frequency list will happily teach
   you של before you can tell ד from ר. Everything here is hand-checked;
   the lesson builder turns it into recognition, sound and reading drills. */

/* `sound` is what the letter does, `name` is what it's called, `confuse` lists
   the letters it is genuinely mistaken for on the page — those pairs are where
   a beginner actually loses time, so the drills lean on them. */
export const LETTERS = [
  { l: "א", name: "אָלֶף", en: "alef", sound: "silent (carries its vowel)", confuse: ["ע"] },
  { l: "ב", name: "בֵּית", en: "bet", sound: "b — v without a dagesh", confuse: ["כ"] },
  { l: "ג", name: "גִּימֶל", en: "gimel", sound: "g as in go", confuse: ["נ"] },
  { l: "ד", name: "דָּלֶת", en: "dalet", sound: "d", confuse: ["ר", "ך"] },
  { l: "ה", name: "הֵא", en: "he", sound: "h", confuse: ["ח", "ת"] },
  { l: "ו", name: "וָו", en: "vav", sound: "v — also the vowels o and u", confuse: ["ז", "ן"] },
  { l: "ז", name: "זַיִן", en: "zayin", sound: "z", confuse: ["ו"] },
  { l: "ח", name: "חֵית", en: "chet", sound: "ch as in Bach", confuse: ["ה", "ת"] },
  { l: "ט", name: "טֵית", en: "tet", sound: "t", confuse: ["מ"] },
  { l: "י", name: "יוֹד", en: "yod", sound: "y — also the vowel i", confuse: ["ו"] },
  { l: "כ", name: "כָּף", en: "kaf", sound: "k — kh without a dagesh", final: "ך", confuse: ["ב", "ר"] },
  { l: "ל", name: "לָמֶד", en: "lamed", sound: "l", confuse: [] },
  { l: "מ", name: "מֵם", en: "mem", sound: "m", final: "ם", confuse: ["ט", "ס"] },
  { l: "נ", name: "נוּן", en: "nun", sound: "n", final: "ן", confuse: ["ג", "ו"] },
  { l: "ס", name: "סָמֶךְ", en: "samekh", sound: "s", confuse: ["ם", "ט"] },
  { l: "ע", name: "עַיִן", en: "ayin", sound: "silent in modern Hebrew", confuse: ["א", "צ"] },
  { l: "פ", name: "פֵּא", en: "pe", sound: "p — f without a dagesh", final: "ף", confuse: ["ם"] },
  { l: "צ", name: "צָדִי", en: "tsadi", sound: "ts as in cats", final: "ץ", confuse: ["ע"] },
  { l: "ק", name: "קוֹף", en: "qof", sound: "k", confuse: ["ר", "ן"] },
  { l: "ר", name: "רֵישׁ", en: "resh", sound: "r, in the throat", confuse: ["ד", "כ"] },
  { l: "ש", name: "שִׁין", en: "shin", sound: "sh — s when the dot is on the left", confuse: [] },
  { l: "ת", name: "תָּו", en: "tav", sound: "t", confuse: ["ח", "ה"] },
];

/* Five letters change shape at the end of a word. Nothing else about them
   changes — same letter, same sound — but a reader who doesn't know them sees
   five extra letters that aren't in the alphabet. */
export const FINALS = LETTERS.filter((x) => x.final).map((x) => ({
  l: x.l, final: x.final, en: x.en, name: x.name,
}));

/* Vowels are marks under (mostly) the letter they follow. Modern Hebrew has
   collapsed several pairs into one sound; the pairs are kept apart here
   because they still look different on the page. */
export const VOWELS = [
  { sign: "ַ", on: "בַ", name: "פַּתַח", en: "patach", sound: "a as in father" },
  { sign: "ָ", on: "בָ", name: "קָמַץ", en: "kamatz", sound: "a as in father" },
  { sign: "ֵ", on: "בֵ", name: "צֵירֵי", en: "tsere", sound: "e as in they" },
  { sign: "ֶ", on: "בֶ", name: "סֶגוֹל", en: "segol", sound: "e as in bed" },
  { sign: "ִ", on: "בִ", name: "חִירִיק", en: "chirik", sound: "i as in machine" },
  { sign: "ֹ", on: "בֹ", name: "חוֹלָם", en: "cholam", sound: "o as in more" },
  { sign: "ֻ", on: "בֻ", name: "קֻבּוּץ", en: "kubutz", sound: "u as in flute" },
  { sign: "ְ", on: "בְ", name: "שְׁוָא", en: "shva", sound: "a half-vowel, or nothing at all" },
];

/* Two vowels are written with a vav rather than under the letter */
export const VAV_VOWELS = [
  { on: "בּוֹ", name: "חוֹלָם מָלֵא", en: "cholam male", sound: "o — a vav with a dot above" },
  { on: "בּוּ", name: "שׁוּרוּק", en: "shuruk", sound: "u — a vav with a dot in its middle" },
];

/* The dot that hardens three letters. Everything else a dagesh does is
   invisible in modern pronunciation, so only these three are taught. */
export const DAGESH = [
  { soft: "בֿ", hard: "בּ", en: "vet → bet", sound: "v becomes b" },
  { soft: "כֿ", hard: "כּ", en: "khaf → kaf", sound: "kh becomes k" },
  { soft: "פֿ", hard: "פּ", en: "fe → pe", sound: "f becomes p" },
];

/* Shin and sin are the same letter with the dot moved */
export const SIN_SHIN = [
  { l: "שׁ", en: "shin", sound: "sh — dot on the right", example: "שָׁלוֹם", exEn: "peace, hello" },
  { l: "שׂ", en: "sin", sound: "s — dot on the left", example: "שָׂמֵחַ", exEn: "happy" },
];

/* Real words a learner can sound out with only the letters taught so far.
   `after` is the alphabet lesson that unlocks each one. */
export const SYLLABLE_WORDS = [
  { he: "אַבָּא", en: "dad", translit: "aba", after: 1 },
  { he: "בַּיִת", en: "house", translit: "bayit", after: 2 },
  { he: "דָּג", en: "fish", translit: "dag", after: 1 },
  { he: "גַּג", en: "roof", translit: "gag", after: 1 },
  { he: "יָד", en: "hand", translit: "yad", after: 2 },
  { he: "טוֹב", en: "good", translit: "tov", after: 2 },
  { he: "כֶּלֶב", en: "dog", translit: "kelev", after: 2 },
  { he: "לַיְלָה", en: "night", translit: "layla", after: 2 },
  { he: "מַיִם", en: "water", translit: "mayim", after: 3 },
  { he: "סֵפֶר", en: "book", translit: "sefer", after: 3 },
  { he: "עֵץ", en: "tree", translit: "ets", after: 3 },
  { he: "פֶּה", en: "mouth", translit: "pe", after: 3 },
  { he: "צִפּוֹר", en: "bird", translit: "tsipor", after: 3 },
  { he: "קָפֶה", en: "coffee", translit: "kafe", after: 4 },
  { he: "רֹאשׁ", en: "head", translit: "rosh", after: 4 },
  { he: "שֶׁמֶשׁ", en: "sun", translit: "shemesh", after: 4 },
  { he: "תַּפּוּחַ", en: "apple", translit: "tapuach", after: 4 },
  { he: "שָׁלוֹם", en: "hello, peace", translit: "shalom", after: 4 },
];
