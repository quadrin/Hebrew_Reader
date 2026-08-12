/* Level 4 — הַפֹּעַל · The verb system.

   This is the level where Hebrew stops being a vocabulary problem. Seven
   patterns, three tenses, and a root system that lets you guess at a word
   you've never seen — which is the point at which reading a real book starts
   to work. */

export default {
  level: 4,
  name: "The verb system",
  nameHe: "הַפֹּעַל",
  blurb: "The future, the infinitive, and the seven binyanim — the machinery that makes Hebrew guessable.",
  lessons: [
    {
      id: "v1",
      title: "What will happen",
      titleHe: "זְמַן עָתִיד",
      goal: "Use the future of pa'al, where the person is a prefix rather than an ending.",
      sections: [
        { type: "text", body: "The past hangs its person on the end of the word. The future puts it on the front — א for I, ת for you and she, י for he, נ for we. Once you know those four letters you can read any future verb's person off its first letter." },
        { type: "binyan", id: "paal", tense: "future" },
        { type: "tip", body: "ת does double duty: תִּכְתֹּב is both you (m.) will write and she will write. Only context or a pronoun tells them apart." },
        {
          type: "examples", items: [
            { he: "מָחָר אֶכְתֹּב מִכְתָּב.", en: "Tomorrow I'll write a letter." },
            { he: "מָתַי תָּבוֹא?", en: "When will you come?" },
            { he: "נִרְאֶה.", en: "We'll see." },
          ],
        },
      ],
      vocab: [
        { he: "מִכְתָּב", en: "letter", translit: "michtav" },
        { he: "אוּלַי", en: "maybe", translit: "ulai" },
        { he: "בְּוַדַּאי", en: "certainly", translit: "bevadai" },
        { he: "אַחַר כָּךְ", en: "afterwards", translit: "achar kach" },
        { he: "עוֹד", en: "more, still, another", translit: "od" },
      ],
      drills: ["vocab", "conjugate:paal:future"],
    },
    {
      id: "v2",
      title: "To do something",
      titleHe: "שֵׁם הַפֹּעַל",
      goal: "Form and use the infinitive.",
      sections: [
        { type: "text", body: "The infinitive begins with לְ and doesn't change for person, gender or number. It's what follows verbs like want, can and must — and what you'll look up in a modern dictionary." },
        {
          type: "table", caption: "Infinitives by binyan",
          head: ["binyan", "infinitive"],
          rows: [
            ["פָּעַל", "לִכְתֹּב — to write"],
            ["פִּעֵל", "לְדַבֵּר — to speak"],
            ["הִפְעִיל", "לְהַסְבִּיר — to explain"],
            ["נִפְעַל", "לְהִכָּנֵס — to enter"],
            ["הִתְפַּעֵל", "לְהִתְלַבֵּשׁ — to get dressed"],
          ],
        },
        {
          type: "examples", items: [
            { he: "אֲנִי רוֹצֶה לִלְמֹד.", en: "I want to learn." },
            { he: "אֶפְשָׁר לְדַבֵּר אִתְּךָ?", en: "Can I talk to you?" },
            { he: "צָרִיךְ לָלֶכֶת.", en: "One has to go. / We should go." },
          ],
        },
        { type: "tip", body: "צָרִיךְ must, אֶפְשָׁר it's possible and אָסוּר it's forbidden aren't verbs — they're words that take an infinitive, and they don't conjugate for tense at all." },
      ],
      vocab: [
        { he: "לִלְמֹד", en: "to learn", translit: "lilmod" },
        { he: "לָלֶכֶת", en: "to go", translit: "lalechet" },
        { he: "לָבוֹא", en: "to come", translit: "lavo" },
        { he: "לֶאֱכֹל", en: "to eat", translit: "le'echol" },
        { he: "לָתֵת", en: "to give", translit: "latet" },
        { he: "צָרִיךְ", en: "must, need to", translit: "tsarich" },
        { he: "אֶפְשָׁר", en: "it's possible", translit: "efshar" },
        { he: "יָכוֹל", en: "can, is able", translit: "yachol" },
      ],
      drills: ["vocab", "build"],
    },
    {
      id: "v3",
      title: "Making it happen",
      titleHe: "בִּנְיַן הִפְעִיל",
      goal: "Recognise hif'il and its causative sense.",
      sections: [
        { type: "text", body: "הִפְעִיל usually means causing the action rather than doing it. Its present begins with מַ and has a long i in the middle; its past begins with הִ." },
        { type: "binyan", id: "hifil", tense: "present" },
        { type: "binyan", id: "hifil", tense: "past" },
        { type: "tip", body: "The causative link is often visible across binyanim on one root. From ל־ב־ש: לוֹבֵשׁ wears, מַלְבִּישׁ dresses someone else, מִתְלַבֵּשׁ gets dressed." },
      ],
      vocab: [
        { he: "מַסְבִּיר", en: "explains", translit: "masbir" },
        { he: "מַתְחִיל", en: "begins", translit: "matchil" },
        { he: "מַרְגִּישׁ", en: "feels", translit: "margish" },
        { he: "מַזְמִין", en: "invites, orders", translit: "mazmin" },
        { he: "מַכִּיר", en: "knows, is acquainted with", translit: "makir" },
        { he: "מַחְלִיט", en: "decides", translit: "machlit" },
      ],
      drills: ["vocab", "conjugate:hifil:present", "binyan-id"],
    },
    {
      id: "v4",
      title: "Having it happen to you",
      titleHe: "בִּנְיַן נִפְעַל",
      goal: "Recognise nif'al, the passive counterpart of pa'al.",
      sections: [
        { type: "text", body: "נִפְעַל is what pa'al becomes when the subject is on the receiving end. Its present and past both begin with נִ, which makes it the easiest binyan to spot — and the easiest to confuse with itself, since נִכְנַס is both he entered and he enters." },
        { type: "binyan", id: "nifal", tense: "present" },
        { type: "binyan", id: "nifal", tense: "past" },
        { type: "tip", body: "Many nif'al verbs aren't passive in meaning at all — נִכְנָס enters, נִשְׁאָר stays, נִמְצָא is located. Treat the pattern as a shape first and a meaning second." },
      ],
      vocab: [
        { he: "נִכְנָס", en: "enters", translit: "nichnas" },
        { he: "נִמְצָא", en: "is located, is found", translit: "nimtsa" },
        { he: "נִשְׁאָר", en: "stays, remains", translit: "nish'ar" },
        { he: "נִרְאֶה", en: "seems, looks", translit: "nir'e" },
        { he: "נִגְמַר", en: "is finished", translit: "nigmar" },
        { he: "נוֹלַד", en: "was born", translit: "nolad" },
      ],
      drills: ["vocab", "binyan-id"],
    },
    {
      id: "v5",
      title: "Doing it to yourself",
      titleHe: "בִּנְיַן הִתְפַּעֵל",
      goal: "Recognise hitpa'el — and the letter-swap that hides it.",
      sections: [
        { type: "text", body: "הִתְפַּעֵל is reflexive: the action comes back on whoever does it. Present begins מִתְ, past begins הִתְ." },
        { type: "binyan", id: "hitpael", tense: "present" },
        { type: "text", body: "When the root starts with a hissing letter — ס, שׂ, שׁ, צ, ז — that letter swaps places with the ת, because the two are awkward to say in the other order." },
        {
          type: "table", caption: "The swap",
          head: ["expected", "actual", "meaning"],
          rows: [
            ["מִתְסַכֵּל", "מִסְתַּכֵּל", "looks at"],
            ["מִתְשַׁמֵּשׁ", "מִשְׁתַּמֵּשׁ", "uses"],
            ["מִתְצַעֵר", "מִצְטַעֵר", "is sorry"],
          ],
        },
        { type: "tip", body: "With צ the ת also hardens to ט — מִצְטַעֵר, not מִצְתַּעֵר. It's the one form worth memorising outright, because מִצְטַעֵר is how you apologise." },
      ],
      vocab: [
        { he: "מִתְלַבֵּשׁ", en: "gets dressed", translit: "mitlabesh" },
        { he: "מִתְעוֹרֵר", en: "wakes up", translit: "mit'orer" },
        { he: "מִסְתַּכֵּל", en: "looks at", translit: "mistakel" },
        { he: "מִשְׁתַּמֵּשׁ", en: "uses", translit: "mishtamesh" },
        { he: "מִצְטַעֵר", en: "is sorry", translit: "mitsta'er" },
        { he: "מִתְגַּעְגֵּעַ", en: "misses, longs for", translit: "mitga'age'a" },
      ],
      drills: ["vocab", "binyan-id"],
      extra: [
        { type: "choice", q: "Why is it מִשְׁתַּמֵּשׁ and not מִתְשַׁמֵּשׁ?", options: ["The ש and the ת swap places", "It's an unrelated irregular verb", "The root has four letters", "It's a different binyan"], correct: 0, why: "Roots beginning with a sibilant swap that letter with the ת of the prefix." },
      ],
    },
    {
      id: "v6",
      title: "The two passives",
      titleHe: "פֻּעַל וְהֻפְעַל",
      goal: "Recognise pu'al and huf'al on the page.",
      sections: [
        { type: "text", body: "Two binyanim exist only as passives: פֻּעַל is the passive of pi'el, הֻפְעַל the passive of hif'il. Neither has an infinitive or an imperative, and outside the third person they're rare — so this is a recognition lesson, not a production one." },
        { type: "passives" },
        { type: "tip", body: "Look for the u vowel where you'd expect a or i. מְדַבֵּר speaks becomes מְדֻבָּר is spoken of; מַסְבִּיר explains becomes מֻסְבָּר is explained." },
      ],
      vocab: [
        { he: "מְדֻבָּר", en: "spoken of, in question", translit: "meduba r" },
        { he: "מֻסְבָּר", en: "explained", translit: "musbar" },
        { he: "מְקֻבָּל", en: "accepted, customary", translit: "mekubal" },
        { he: "מֻכָּן", en: "ready, prepared", translit: "muchan" },
        { he: "מְסֻדָּר", en: "arranged, tidy", translit: "mesudar" },
      ],
      drills: ["vocab"],
    },
    {
      id: "v7",
      title: "Telling someone to do it",
      titleHe: "צִוּוּי",
      goal: "Give an order — the textbook way and the way people actually speak.",
      sections: [
        { type: "text", body: "There is a proper imperative, and it's what you'll read in books and signs." },
        {
          type: "table", caption: "Imperatives",
          head: ["binyan", "to a man", "to a woman", "to a group"],
          rows: [
            ["פָּעַל — write", "כְּתֹב", "כִּתְבִי", "כִּתְבוּ"],
            ["פִּעֵל — speak", "דַּבֵּר", "דַּבְּרִי", "דַּבְּרוּ"],
            ["הִפְעִיל — explain", "הַסְבֵּר", "הַסְבִּירִי", "הַסְבִּירוּ"],
          ],
        },
        { type: "text", body: "In speech, Israelis mostly use the future tense instead, which sounds softer: תִּכְתֹּב rather than כְּתֹב." },
        { type: "tip", body: "The negative imperative has no choice — it is always אַל plus the future. אַל תֵּלֵךְ, don't go. לֹא תֵּלֵךְ is not a command; it means you will not go." },
      ],
      vocab: [
        { he: "בּוֹא", en: "come! (m.)", translit: "bo" },
        { he: "בּוֹאִי", en: "come! (f.)", translit: "bo'i" },
        { he: "תֵּן", en: "give! (m.)", translit: "ten" },
        { he: "סְלִיחָה", en: "excuse me, sorry", translit: "slicha" },
        { he: "אַל", en: "don't (with the future)", translit: "al" },
        { he: "חַכֵּה", en: "wait! (m.)", translit: "chake" },
      ],
      drills: ["vocab"],
      extra: [
        { type: "choice", q: "“Don't go” (to a man) is —", options: ["אַל תֵּלֵךְ", "לֹא תֵּלֵךְ", "אַל הָלַךְ", "לֹא לֵךְ"], correct: 0, why: "Negative commands use אַל with the future. לֹא תֵּלֵךְ is a prediction, not an order." },
      ],
    },
    {
      id: "v8",
      title: "Roots that misbehave",
      titleHe: "גְּזָרוֹת",
      goal: "Read verbs whose roots contain נ, ו or ה and don't follow the tables.",
      sections: [
        { type: "text", body: "The tables you've learned describe strong roots — three solid consonants. Some roots contain a letter that won't stay put, and those are among the commonest verbs in the language, so they have to be met head-on." },
        { type: "weak", id: "pe-nun" },
        { type: "weak", id: "ayin-vav" },
        { type: "weak", id: "lamed-he" },
        { type: "tip", body: "Don't memorise rules for these. Learn the handful of frequent verbs in each family as words, and the pattern will settle by itself." },
      ],
      vocab: [
        { he: "נוֹפֵל", en: "falls", translit: "nofel" },
        { he: "נוֹסֵעַ", en: "travels", translit: "nose'a" },
        { he: "קָם", en: "gets up", translit: "kam" },
        { he: "שָׁר", en: "sings", translit: "shar" },
        { he: "קוֹנֶה", en: "buys", translit: "kone" },
        { he: "רוֹאֶה", en: "sees", translit: "ro'e" },
        { he: "עוֹשֶׂה", en: "does, makes", translit: "ose" },
      ],
      drills: ["vocab", "weak"],
    },
  ],
};
