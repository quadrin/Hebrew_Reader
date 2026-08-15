/* The alphabet, as the first three units teach it.

   Units 1–3 are "learn the alphabet", and a course that only ever asks you to
   translate sentences teaches it badly. The letters below come from the Tips &
   Notes table Duolingo wrote for Letters 1, with the vowel points that unit 3
   introduces. `taught` is the unit that first shows the letter, so the drills
   never ask for a letter the course has not reached. */

export const LETTERS = [
  { l: "א", name: "Aleph", ipa: "ʔ", sound: "silent placeholder", taught: 1 },
  { l: "ב", name: "Bet", ipa: "b / v", sound: "b as in bet, v as in vet", taught: 1 },
  { l: "ג", name: "Gimel", ipa: "g", sound: "g as in go", taught: 2 },
  { l: "ד", name: "Dalet", ipa: "d", sound: "d as in dog", taught: 2 },
  { l: "ה", name: "Hey", ipa: "h", sound: "h as in hen", taught: 1 },
  { l: "ו", name: "Vav", ipa: "v", sound: "v as in vet", taught: 1 },
  { l: "ז", name: "Zayin", ipa: "z", sound: "z as in zoo", taught: 3 },
  { l: "ח", name: "Chet", ipa: "χ", sound: "ch as in loch", taught: 1 },
  { l: "ט", name: "Tet", ipa: "t", sound: "t as in ten", taught: 2 },
  { l: "י", name: "Yod", ipa: "j", sound: "y as in yes", taught: 1 },
  { l: "כ", name: "Kaf", ipa: "k / χ", sound: "k as in cat, ch as in loch", final: "ך", taught: 2 },
  { l: "ל", name: "Lamed", ipa: "l", sound: "l as in log", taught: 1 },
  { l: "מ", name: "Mem", ipa: "m", sound: "m as in man", final: "ם", taught: 1 },
  { l: "נ", name: "Nun", ipa: "n", sound: "n as in no", final: "ן", taught: 2 },
  { l: "ס", name: "Samekh", ipa: "s", sound: "s as in see", taught: 3 },
  { l: "ע", name: "Ayin", ipa: "ʔ", sound: "silent, like Aleph", taught: 2 },
  { l: "פ", name: "Pei", ipa: "p / f", sound: "p as in pay, f as in fool", final: "ף", taught: 2 },
  { l: "צ", name: "Tsadi", ipa: "ts", sound: "ts as in cats", final: "ץ", taught: 3 },
  { l: "ק", name: "Qof", ipa: "k", sound: "k as in cat", taught: 3 },
  { l: "ר", name: "Resh", ipa: "ʁ", sound: "r, in the back of the throat", taught: 2 },
  { l: "ש", name: "Shin", ipa: "ʃ / s", sound: "sh as in she, s as in see", taught: 1 },
  { l: "ת", name: "Tav", ipa: "t", sound: "t as in tap", taught: 1 },
];

export const VOWELS = [
  { mark: "בַ", name: "Patach", sound: "a as in father" },
  { mark: "בָ", name: "Kamatz", sound: "a as in father" },
  { mark: "בֵ", name: "Tzeire", sound: "e as in bed" },
  { mark: "בֶ", name: "Segol", sound: "e as in bed" },
  { mark: "בִ", name: "Chirik", sound: "i as in machine" },
  { mark: "בֹ", name: "Cholam", sound: "o as in bore" },
  { mark: "בֻ", name: "Kubutz", sound: "u as in blue" },
  { mark: "בּ", name: "Dagesh", sound: "hardens the letter: b, k, p" },
  { mark: "בְ", name: "Sheva", sound: "no vowel, or a short uh" },
];

export const letterByChar = new Map(LETTERS.map((x) => [x.l, x]));
export const lettersUpTo = (unit) => LETTERS.filter((x) => x.taught <= Math.max(1, unit));
