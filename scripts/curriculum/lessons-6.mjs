/* Level 6 — קְרִיאַת סִפְרוּת · Reading the real thing.

   The library this app is built on is public domain, which means it is old:
   Bialik, Brenner, Tchernichovsky, and translations made a century ago. Their
   Hebrew is not the Hebrew of level 2. This level teaches the specific
   differences, so the shelf stops being a wall. */

export default {
  level: 6,
  name: "Reading literature",
  nameHe: "קְרִיאַת סִפְרוּת",
  blurb: "The older forms you'll meet in the library — and how to read a page of it unaided.",
  lessons: [
    {
      id: "l1",
      title: "The vav that flips the tense",
      titleHe: "וָ״ו הַהִפּוּךְ",
      goal: "Read narrative past in biblical style — future forms that mean the past.",
      sections: [
        { type: "text", body: "Biblical narrative doesn't tell a story in the past tense. It puts a וַ on the front of a future-tense verb, and the whole thing means the past. This is why a page of Genesis looks like it's about to happen and isn't." },
        {
          type: "table", caption: "Reading it",
          head: ["on the page", "looks like", "actually means"],
          rows: [
            ["וַיֹּאמֶר", "he will say", "and he said"],
            ["וַיֵּלֶךְ", "he will go", "and he went"],
            ["וַתֹּאמֶר", "she will say", "and she said"],
            ["וַיְהִי", "it will be", "and it came to pass"],
            ["וַיִּקְרָא", "he will call", "and he called"],
          ],
        },
        { type: "tip", body: "It works the other way too: וְ on a past-tense verb can push it into the future — וְהָיָה, and it shall be. Rarer, and mostly in prophecy." },
        { type: "text", body: "You'll meet this in anything drawing on the Bible, which in Hebrew literature is nearly everything." },
      ],
      vocab: [
        { he: "וַיֹּאמֶר", en: "and he said", translit: "vayomer" },
        { he: "וַיְהִי", en: "and it came to pass", translit: "vayhi" },
        { he: "וַיֵּלֶךְ", en: "and he went", translit: "vayelech" },
        { he: "וַיַּרְא", en: "and he saw", translit: "vayar" },
        { he: "וַתֹּאמֶר", en: "and she said", translit: "vatomer" },
      ],
      drills: ["vocab", "vavflip"],
    },
    {
      id: "l2",
      title: "Older pronouns and endings",
      titleHe: "צוּרוֹת עַתִּיקוֹת",
      goal: "Recognise the pronouns and suffixes that modern Hebrew has retired.",
      sections: [
        {
          type: "table", caption: "Pronouns you'll meet",
          head: ["older", "modern", "meaning"],
          rows: [
            ["אָנֹכִי", "אֲנִי", "I"],
            ["הֵמָּה", "הֵם", "they (m.)"],
            ["הֵנָּה", "הֵן", "they (f.)"],
            ["זֹאת", "זֹאת / זוֹ", "this (f.)"],
            ["אֲשֶׁר", "שֶׁ", "that, which"],
          ],
        },
        { type: "text", body: "Object pronouns are attached to the verb rather than following it as אוֹתִי, אוֹתוֹ." },
        {
          type: "table", caption: "Attached objects",
          head: ["on the page", "modern", "meaning"],
          rows: [
            ["רָאִיתִיו", "רָאִיתִי אוֹתוֹ", "I saw him"],
            ["שְׁמָעֵנִי", "שְׁמַע אוֹתִי", "hear me"],
            ["אֲהַבְתִּיהָ", "אָהַבְתִּי אוֹתָהּ", "I loved her"],
          ],
        },
        { type: "tip", body: "The trick is to read the ending off the back of the word: ־וֹ him, ־ָהּ her, ־נִי me, ־ָם them. The rest of the word is the verb you already know." },
      ],
      vocab: [
        { he: "אָנֹכִי", en: "I (archaic)", translit: "anochi" },
        { he: "הֵמָּה", en: "they (archaic)", translit: "hema" },
        { he: "כֹּה", en: "thus", translit: "ko" },
        { he: "אָז", en: "then", translit: "az" },
        { he: "טֶרֶם", en: "before, not yet", translit: "terem" },
        { he: "פֶּן", en: "lest", translit: "pen" },
      ],
      drills: ["vocab", "oldforms"],
    },
    {
      id: "l3",
      title: "Directions and other survivals",
      titleHe: "ה׳ הַמְּגַמָּה",
      goal: "Read the ־ָה that means towards, and the other fossils around it.",
      sections: [
        { type: "text", body: "An unstressed ־ָה on the end of a place noun means towards it — a case ending that survived nowhere else." },
        {
          type: "examples", items: [
            { he: "הַבַּיְתָה", en: "homewards, home" },
            { he: "אַרְצָה", en: "to the land, to Israel" },
            { he: "יְרוּשָׁלַיְמָה", en: "to Jerusalem" },
            { he: "הַחוּצָה", en: "outwards, outside" },
          ],
        },
        { type: "tip", body: "הַבַּיְתָה is fully alive in modern Hebrew — אֲנִי הוֹלֵךְ הַבַּיְתָה, I'm going home. Most of the others are literary." },
        { type: "text", body: "Two more worth knowing: the infinitive with לְ can appear as בְּ or כְּ plus the infinitive to mean when — בְּבוֹאוֹ, when he came — and the particle אֵת is often spelled אֶת־ with a hyphen in older typesetting." },
      ],
      vocab: [
        { he: "הַבַּיְתָה", en: "homewards", translit: "habayta" },
        { he: "אַרְצָה", en: "to the land", translit: "artsa" },
        { he: "הַחוּצָה", en: "outside", translit: "hachutsa" },
        { he: "שָׁמַיִם", en: "sky, heaven", translit: "shamayim" },
        { he: "לֵאמֹר", en: "saying (introduces speech)", translit: "lemor" },
      ],
      drills: ["vocab"],
    },
    {
      id: "l4",
      title: "How poems are built",
      titleHe: "שִׁירָה",
      goal: "Read Hebrew verse — parallelism, compression, inverted order.",
      sections: [
        { type: "text", body: "Hebrew poetry doesn't rhyme, classically. It says the same thing twice in different words — the second line answering the first. Once you expect it, half of any verse is already understood." },
        {
          type: "examples", items: [
            { he: "כִּי כְּבָר רָצָה הָאֱלֹהִים אֶת מַעֲשֶׂיךָ", en: "for God has already accepted your deeds" },
            { he: "הַשָּׁמַיִם מְסַפְּרִים כְּבוֹד אֵל / וּמַעֲשֵׂה יָדָיו מַגִּיד הָרָקִיעַ", en: "The heavens declare the glory of God / and the firmament proclaims the work of his hands" },
          ],
        },
        { type: "text", body: "The second half of that pair restates the first: heavens answers firmament, declare answers proclaims. Neither line is new information." },
        { type: "tip", body: "Verse also stacks construct chains — מַעֲשֵׂה יָדָיו, the work of his hands — and drops the article freely. Expect nouns to be more tightly packed than in prose." },
      ],
      vocab: [
        { he: "כָּבוֹד", en: "glory, honour", translit: "kavod" },
        { he: "מַעֲשֶׂה", en: "deed, work", translit: "ma'ase" },
        { he: "נֶפֶשׁ", en: "soul, self", translit: "nefesh" },
        { he: "לֵבָב", en: "heart (poetic)", translit: "levav" },
        { he: "אוֹר", en: "light", translit: "or" },
        { he: "חֹשֶׁךְ", en: "darkness", translit: "choshech" },
      ],
      drills: ["vocab"],
    },
    {
      id: "l6",
      title: "Words that moved",
      titleHe: "שִׁנּוּי מַשְׁמָעוּת",
      goal: "Know the common words whose old sense is not their modern one.",
      sections: [
        { type: "text", body: "The hardest words on an old page are not the rare ones — a rare word announces itself and you look it up. The trouble comes from common words you are sure of, which have quietly moved since the sentence was written." },
        {
          type: "table", caption: "On an old page it means",
          head: ["word", "today", "in an old text"],
          rows: [
            ["נַעַר — na'ar", "a teenager", "a servant, an attendant of any age"],
            ["דָּבָר — davar", "a thing", "a word, a matter, an affair"],
            ["מַלְאָךְ — mal'ach", "an angel", "a messenger, anyone sent"],
            ["חַיִל — chayil", "a force, a corps", "an army, or valour"],
            ["נֶפֶשׁ — nefesh", "a soul", "a person, a living creature"],
            ["אִישׁ — ish", "a man", "each one, anyone at all"],
            ["עֶבֶד — eved", "a slave", "a servant of any rank"],
            ["חֶסֶד — chesed", "kindness", "loyalty owed within a covenant"],
            ["רֵעַ — re'a", "a friend, in writing", "a fellow, whoever is next to you"],
            ["מְלָאכָה — melacha", "a craft, a trade", "any work done with the hands"],
          ],
        },
        { type: "text", body: "The pattern is nearly always the same direction: the old sense is wider, the modern one narrower. אִישׁ meant anyone and now means a man; מַלְאָךְ meant a messenger and was narrowed to the divine kind." },
        {
          type: "examples", items: [
            { he: "וַיִּשְׁלַח מַלְאָכִים אֶל הַמֶּלֶךְ", en: "and he sent messengers to the king — not angels" },
            { he: "אִישׁ אֶל רֵעֵהוּ", en: "each to his fellow — a fixed phrase, still used" },
            { he: "כָּל נֶפֶשׁ", en: "every person" },
          ],
        },
        { type: "tip", body: "The rule of thumb: when a common word makes a sentence odd, suspect the word before you suspect the grammar. A sentence that will not resolve is far more often one moved meaning than one misread verb." },
      ],
      vocab: [
        { he: "רֵעַ", en: "fellow, companion", translit: "re'a" },
        { he: "מַלְאָךְ", en: "messenger, angel", translit: "mal'ach" },
        { he: "חַיִל", en: "army, valour", translit: "chayil" },
        { he: "הָמוֹן", en: "a crowd, a multitude", translit: "hamon" },
        { he: "כְּלִי", en: "a vessel, a tool", translit: "kli" },
        { he: "מְלָאכָה", en: "work, craft", translit: "melacha" },
      ],
      drills: ["vocab", "shift"],
    },
    {
      id: "l7",
      title: "Reading without vowels",
      titleHe: "כְּתִיב חָסֵר וּמָלֵא",
      goal: "Read the unpointed spelling every real book is printed in.",
      sections: [
        { type: "text", body: "Outside textbooks, poetry, children's books and the Bible, Hebrew is printed with no vowel marks at all. This sounds impossible and is not: the spelling changes to compensate, adding a ו or a י wherever a vowel most needed saying. That fuller spelling is כְּתִיב מָלֵא." },
        {
          type: "table", caption: "Pointed, and as it is actually printed",
          head: ["with nikkud", "meaning", "in a book"],
          rows: [
            ["סִפּוּר — a story", "a story", "סיפור"],
            ["דִּבֵּר — he spoke", "he spoke", "דיבר"],
            ["חֻלְצָה — a shirt", "a shirt", "חולצה"],
            ["תָּכְנִית — a programme", "a programme", "תוכנית"],
            ["אִשָּׁה — a woman", "a woman", "אישה"],
            ["צָהֳרַיִם — noon", "noon", "צהריים"],
            ["תִּקְוָה — hope", "hope", "תקווה"],
          ],
        },
        { type: "text", body: "Three habits produce nearly all of it. An i sound gains a י. An o or u sound gains a ו. And a ו or י that is doing consonant duty in the middle of a word is written twice, so that תִּקְוָה becomes תקווה and nobody reads it as a vowel." },
        { type: "tip", body: "Older books do the opposite. Ben-Yehuda's texts and anything set before the middle of the last century often use כְּתִיב חָסֵר — the defective spelling — with fewer vavs and yods than you expect, because it followed the pointed spelling with the points taken away. If a word looks a letter short, that is why." },
        { type: "text", body: "What is genuinely lost is distinctions. ספר with no points can be סֵפֶר a book, סַפָּר a barber, סָפַר he counted, סִפֵּר he told, or סְפָר a frontier. The context decides, always — and reliably, which is the part that has to be taken on trust until it starts happening." },
        { type: "tip", body: "This is the real argument for the habit from the reading lesson: finish the sentence before looking anything up. An unpointed word is often ambiguous on its own and never ambiguous by the time the verb has arrived." },
      ],
      vocab: [
        { he: "כְּתִיב", en: "spelling", translit: "ktiv" },
        { he: "נִקּוּד", en: "the vowel points", translit: "nikud" },
        { he: "הֶקְשֵׁר", en: "context", translit: "heksher" },
        { he: "חָסֵר", en: "lacking, defective", translit: "chaser" },
        { he: "סוֹפֵר", en: "a writer", translit: "sofer" },
        { he: "מַהֲדוּרָה", en: "an edition", translit: "mahadura" },
      ],
      drills: ["vocab", "ktiv"],
    },
    {
      id: "l5",
      title: "Reading a real page",
      titleHe: "עַל הַסֵּפֶר",
      goal: "Put it together on unedited literary Hebrew.",
      sections: [
        { type: "text", body: "Everything from here is reading. The shelf in the Browse tab is graded by how much of each book is built from the commonest two thousand words — start green and work down." },
        { type: "text", body: "Three habits are worth carrying into it." },
        { type: "tip", body: "Read to the end of the sentence before you look anything up. Hebrew's verb often arrives late, and half the words you'd have tapped resolve themselves once it does." },
        { type: "tip", body: "When a word is unfamiliar, look for the three root letters first. Strip ו, ה, ב, ל, כ, מ, ש from the front and the endings from the back, and what's left is usually something you know." },
        { type: "tip", body: "Unvocalized text is the norm outside textbooks and poetry. You'll read it faster than you expect, because context does the work the vowels were doing." },
      ],
      vocab: [
        { he: "סוֹף", en: "end", translit: "sof" },
        { he: "הַתְחָלָה", en: "beginning", translit: "hatchala" },
        { he: "מִלָּה", en: "word", translit: "mila" },
        { he: "מִשְׁפָּט", en: "sentence", translit: "mishpat" },
        { he: "שֹׁרֶשׁ", en: "root", translit: "shoresh" },
        { he: "מַשְׁמָעוּת", en: "meaning", translit: "mashma'ut" },
      ],
      drills: ["vocab"],
    },
  ],
};
