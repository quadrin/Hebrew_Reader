/* Model verbs — one per binyan, fully written out.

   A general morphology engine would be the tempting way to do this, and the
   wrong one: Hebrew's stem changes depend on which consonants a root has, so
   an engine that looks right on כתב quietly produces nonsense on a root with a
   guttural or a weak letter. These are the seven textbook model verbs, each on
   a strong root (שלמים) so the pattern actually holds, written out by hand and
   checked form by form. Weak roots get taught as their own topic later, from
   their own tables.

   Drills are generated from these: every cell is a question ("she wrote"?) and
   every other cell in the table is a ready-made distractor that is wrong in an
   instructive way. */

export const PERSONS = [
  { id: "1s", he: "אֲנִי", en: "I" },
  { id: "2ms", he: "אַתָּה", en: "you (m.)" },
  { id: "2fs", he: "אַתְּ", en: "you (f.)" },
  { id: "3ms", he: "הוּא", en: "he" },
  { id: "3fs", he: "הִיא", en: "she" },
  { id: "1p", he: "אֲנַחְנוּ", en: "we" },
  { id: "2mp", he: "אַתֶּם", en: "you (m.pl.)" },
  { id: "2fp", he: "אַתֶּן", en: "you (f.pl.)" },
  { id: "3p", he: "הֵם / הֵן", en: "they" },
];

export const PRESENT_FORMS = [
  { id: "ms", en: "masculine singular" },
  { id: "fs", en: "feminine singular" },
  { id: "mp", en: "masculine plural" },
  { id: "fp", en: "feminine plural" },
];

export const BINYANIM = [
  {
    id: "paal",
    he: "פָּעַל",
    en: "pa'al (kal)",
    note: "The plain, basic verb — the one most everyday actions use.",
    verb: { root: "כ־ת־ב", inf: "לִכְתֹּב", en: "to write" },
    present: { ms: "כּוֹתֵב", fs: "כּוֹתֶבֶת", mp: "כּוֹתְבִים", fp: "כּוֹתְבוֹת" },
    past: {
      "1s": "כָּתַבְתִּי", "2ms": "כָּתַבְתָּ", "2fs": "כָּתַבְתְּ",
      "3ms": "כָּתַב", "3fs": "כָּתְבָה", "1p": "כָּתַבְנוּ",
      "2mp": "כְּתַבְתֶּם", "2fp": "כְּתַבְתֶּן", "3p": "כָּתְבוּ",
    },
    future: {
      "1s": "אֶכְתֹּב", "2ms": "תִּכְתֹּב", "2fs": "תִּכְתְּבִי",
      "3ms": "יִכְתֹּב", "3fs": "תִּכְתֹּב", "1p": "נִכְתֹּב",
      "2mp": "תִּכְתְּבוּ", "2fp": "תִּכְתְּבוּ", "3p": "יִכְתְּבוּ",
    },
    imperative: { ms: "כְּתֹב", fs: "כִּתְבִי", mp: "כִּתְבוּ" },
  },
  {
    id: "piel",
    he: "פִּעֵל",
    en: "pi'el",
    note: "Often an intensified or causative sense; the middle root letter doubles.",
    verb: { root: "ד־ב־ר", inf: "לְדַבֵּר", en: "to speak" },
    present: { ms: "מְדַבֵּר", fs: "מְדַבֶּרֶת", mp: "מְדַבְּרִים", fp: "מְדַבְּרוֹת" },
    past: {
      "1s": "דִּבַּרְתִּי", "2ms": "דִּבַּרְתָּ", "2fs": "דִּבַּרְתְּ",
      "3ms": "דִּבֵּר", "3fs": "דִּבְּרָה", "1p": "דִּבַּרְנוּ",
      "2mp": "דִּבַּרְתֶּם", "2fp": "דִּבַּרְתֶּן", "3p": "דִּבְּרוּ",
    },
    future: {
      "1s": "אֲדַבֵּר", "2ms": "תְּדַבֵּר", "2fs": "תְּדַבְּרִי",
      "3ms": "יְדַבֵּר", "3fs": "תְּדַבֵּר", "1p": "נְדַבֵּר",
      "2mp": "תְּדַבְּרוּ", "2fp": "תְּדַבְּרוּ", "3p": "יְדַבְּרוּ",
    },
    imperative: { ms: "דַּבֵּר", fs: "דַּבְּרִי", mp: "דַּבְּרוּ" },
  },
  {
    id: "hifil",
    he: "הִפְעִיל",
    en: "hif'il",
    note: "Causative — making someone else do or become something.",
    verb: { root: "ס־ב־ר", inf: "לְהַסְבִּיר", en: "to explain" },
    present: { ms: "מַסְבִּיר", fs: "מַסְבִּירָה", mp: "מַסְבִּירִים", fp: "מַסְבִּירוֹת" },
    past: {
      "1s": "הִסְבַּרְתִּי", "2ms": "הִסְבַּרְתָּ", "2fs": "הִסְבַּרְתְּ",
      "3ms": "הִסְבִּיר", "3fs": "הִסְבִּירָה", "1p": "הִסְבַּרְנוּ",
      "2mp": "הִסְבַּרְתֶּם", "2fp": "הִסְבַּרְתֶּן", "3p": "הִסְבִּירוּ",
    },
    future: {
      "1s": "אַסְבִּיר", "2ms": "תַּסְבִּיר", "2fs": "תַּסְבִּירִי",
      "3ms": "יַסְבִּיר", "3fs": "תַּסְבִּיר", "1p": "נַסְבִּיר",
      "2mp": "תַּסְבִּירוּ", "2fp": "תַּסְבִּירוּ", "3p": "יַסְבִּירוּ",
    },
    imperative: { ms: "הַסְבֵּר", fs: "הַסְבִּירִי", mp: "הַסְבִּירוּ" },
  },
  {
    id: "nifal",
    he: "נִפְעַל",
    en: "nif'al",
    note: "The passive or reflexive counterpart of pa'al.",
    verb: { root: "כ־נ־ס", inf: "לְהִכָּנֵס", en: "to enter, to go in" },
    present: { ms: "נִכְנָס", fs: "נִכְנֶסֶת", mp: "נִכְנָסִים", fp: "נִכְנָסוֹת" },
    past: {
      "1s": "נִכְנַסְתִּי", "2ms": "נִכְנַסְתָּ", "2fs": "נִכְנַסְתְּ",
      "3ms": "נִכְנַס", "3fs": "נִכְנְסָה", "1p": "נִכְנַסְנוּ",
      "2mp": "נִכְנַסְתֶּם", "2fp": "נִכְנַסְתֶּן", "3p": "נִכְנְסוּ",
    },
    future: {
      "1s": "אֶכָּנֵס", "2ms": "תִּכָּנֵס", "2fs": "תִּכָּנְסִי",
      "3ms": "יִכָּנֵס", "3fs": "תִּכָּנֵס", "1p": "נִכָּנֵס",
      "2mp": "תִּכָּנְסוּ", "2fp": "תִּכָּנְסוּ", "3p": "יִכָּנְסוּ",
    },
    imperative: { ms: "הִכָּנֵס", fs: "הִכָּנְסִי", mp: "הִכָּנְסוּ" },
  },
  {
    id: "hitpael",
    he: "הִתְפַּעֵל",
    en: "hitpa'el",
    note: "Reflexive — the action comes back on the one doing it.",
    verb: { root: "ל־ב־ש", inf: "לְהִתְלַבֵּשׁ", en: "to get dressed" },
    present: { ms: "מִתְלַבֵּשׁ", fs: "מִתְלַבֶּשֶׁת", mp: "מִתְלַבְּשִׁים", fp: "מִתְלַבְּשׁוֹת" },
    past: {
      "1s": "הִתְלַבַּשְׁתִּי", "2ms": "הִתְלַבַּשְׁתָּ", "2fs": "הִתְלַבַּשְׁתְּ",
      "3ms": "הִתְלַבֵּשׁ", "3fs": "הִתְלַבְּשָׁה", "1p": "הִתְלַבַּשְׁנוּ",
      "2mp": "הִתְלַבַּשְׁתֶּם", "2fp": "הִתְלַבַּשְׁתֶּן", "3p": "הִתְלַבְּשׁוּ",
    },
    future: {
      "1s": "אֶתְלַבֵּשׁ", "2ms": "תִּתְלַבֵּשׁ", "2fs": "תִּתְלַבְּשִׁי",
      "3ms": "יִתְלַבֵּשׁ", "3fs": "תִּתְלַבֵּשׁ", "1p": "נִתְלַבֵּשׁ",
      "2mp": "תִּתְלַבְּשׁוּ", "2fp": "תִּתְלַבְּשׁוּ", "3p": "יִתְלַבְּשׁוּ",
    },
    imperative: { ms: "הִתְלַבֵּשׁ", fs: "הִתְלַבְּשִׁי", mp: "הִתְלַבְּשׁוּ" },
  },
];

/* The two passives are taught for recognition only. They have no imperative
   and almost never appear outside the third person and the participle, so a
   full nine-cell table would be drilling forms nobody writes. */
export const PASSIVES = [
  {
    id: "pual",
    he: "פֻּעַל",
    en: "pu'al",
    of: "piel",
    note: "The passive of pi'el — something is being done to the subject.",
    verb: { root: "ד־ב־ר", en: "to be spoken (of)" },
    present: { ms: "מְדֻבָּר", fs: "מְדֻבֶּרֶת", mp: "מְדֻבָּרִים", fp: "מְדֻבָּרוֹת" },
    past: { "3ms": "דֻּבַּר", "3fs": "דֻּבְּרָה", "3p": "דֻּבְּרוּ" },
    future: { "3ms": "יְדֻבַּר", "3fs": "תְּדֻבַּר", "3p": "יְדֻבְּרוּ" },
  },
  {
    id: "hufal",
    he: "הֻפְעַל",
    en: "huf'al",
    of: "hifil",
    note: "The passive of hif'il.",
    verb: { root: "ס־ב־ר", en: "to be explained" },
    present: { ms: "מֻסְבָּר", fs: "מֻסְבֶּרֶת", mp: "מֻסְבָּרִים", fp: "מֻסְבָּרוֹת" },
    past: { "3ms": "הֻסְבַּר", "3fs": "הֻסְבְּרָה", "3p": "הֻסְבְּרוּ" },
    future: { "3ms": "יֻסְבַּר", "3fs": "תֻּסְבַּר", "3p": "יֻסְבְּרוּ" },
  },
];

/* Roots that don't behave. Each family gets one model verb, written out in the
   tenses where it actually diverges from the strong pattern. */
export const WEAK_ROOTS = [
  {
    id: "pe-nun",
    he: "פ״נ",
    en: "roots beginning with נ",
    why: "The נ vanishes into the next letter, which takes a dagesh instead.",
    verb: { root: "נ־פ־ל", inf: "לִפֹּל", en: "to fall" },
    forms: [
      { label: "he falls", he: "נוֹפֵל", note: "present keeps the נ" },
      { label: "he fell", he: "נָפַל", note: "past keeps it too" },
      { label: "he will fall", he: "יִפֹּל", note: "the נ is gone; פ doubles" },
      { label: "to fall", he: "לִפֹּל", note: "same in the infinitive" },
    ],
  },
  {
    id: "ayin-vav",
    he: "ע״ו",
    en: "hollow roots",
    why: "The middle letter is a vowel, so there are only two consonants to hear.",
    verb: { root: "ק־ו־ם", inf: "לָקוּם", en: "to get up" },
    forms: [
      { label: "he gets up", he: "קָם", note: "one syllable — no middle letter" },
      { label: "she gets up", he: "קָמָה", note: "" },
      { label: "he got up", he: "קָם", note: "past and present look alike" },
      { label: "I got up", he: "קַמְתִּי", note: "" },
      { label: "he will get up", he: "יָקוּם", note: "the vav surfaces as u" },
    ],
  },
  {
    id: "lamed-he",
    he: "ל״ה",
    en: "roots ending in ה",
    why: "The final ה drops before most endings, and the vowel before it shifts.",
    verb: { root: "ק־נ־ה", inf: "לִקְנוֹת", en: "to buy" },
    forms: [
      { label: "he buys", he: "קוֹנֶה", note: "" },
      { label: "she buys", he: "קוֹנָה", note: "not קונת" },
      { label: "they buy", he: "קוֹנִים", note: "the ה is gone" },
      { label: "he bought", he: "קָנָה", note: "" },
      { label: "I bought", he: "קָנִיתִי", note: "ה becomes י" },
      { label: "to buy", he: "לִקְנוֹת", note: "infinitive ends ־וֹת" },
    ],
  },
];
