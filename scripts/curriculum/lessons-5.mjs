/* Level 5 — מִבְנֶה וְסִגְנוֹן · Structure and register.

   Everything up to here builds single clauses. This level joins them, and
   introduces the gap between how Hebrew is spoken and how it is written —
   which is the wall a learner hits the moment they open a book. */

export default {
  level: 5,
  name: "Structure and style",
  nameHe: "מִבְנֶה וְסִגְנוֹן",
  blurb: "Joining clauses, conditionals, verbal nouns, and the distance between spoken and written Hebrew.",
  lessons: [
    {
      id: "s1",
      title: "Joining clauses",
      titleHe: "מִשְׁפָּט מְחֻבָּר",
      goal: "Use שֶׁ, כִּי and כְּדֵי to build sentences longer than one clause.",
      sections: [
        { type: "text", body: "שֶׁ is the workhorse. Glued to the front of a clause it does the job of English that, which and who all at once — and unlike English, it is never optional." },
        {
          type: "examples", items: [
            { he: "אֲנִי חוֹשֵׁב שֶׁהוּא צוֹדֵק.", en: "I think (that) he's right." },
            { he: "הָאִישׁ שֶׁבָּא אֶתְמוֹל", en: "the man who came yesterday" },
            { he: "הַסֵּפֶר שֶׁקָּרָאתִי", en: "the book (that) I read" },
            { he: "כְּשֶׁהִגַּעְתִּי, הוּא כְּבָר הָלַךְ.", en: "When I arrived, he'd already left." },
          ],
        },
        {
          type: "table", caption: "Connectors",
          head: ["Hebrew", "English"],
          rows: [
            ["שֶׁ", "that, which, who"],
            ["כִּי", "because"],
            ["כְּדֵי", "in order to"],
            ["אֲבָל", "but"],
            ["לִפְנֵי שֶׁ", "before"],
            ["אַחֲרֵי שֶׁ", "after"],
            ["בִּגְלַל שֶׁ", "because of the fact that"],
          ],
        },
        { type: "tip", body: "אֲשֶׁר is שֶׁ in literary dress — same meaning, separate word, and everywhere in older prose. When you meet it, read it as שֶׁ." },
      ],
      vocab: [
        { he: "שֶׁ", en: "that, which, who", translit: "she-" },
        { he: "כִּי", en: "because", translit: "ki" },
        { he: "אֲשֶׁר", en: "that, which (literary)", translit: "asher" },
        { he: "כְּדֵי", en: "in order to", translit: "kdei" },
        { he: "אֲבָל", en: "but", translit: "aval" },
        { he: "לָכֵן", en: "therefore", translit: "lachen" },
        { he: "לְמָשָׁל", en: "for example", translit: "lemashal" },
        { he: "בְּעֶצֶם", en: "actually", translit: "be'etsem" },
      ],
      drills: ["vocab", "build"],
    },
    {
      id: "s2",
      title: "If",
      titleHe: "תְּנַאי",
      goal: "Tell a real condition from an impossible one.",
      sections: [
        { type: "text", body: "אִם is for things that might happen, and takes the future. לוּ and אִילוּ are for things that didn't, and take the past — with הָיָה carrying the counterfactual." },
        {
          type: "examples", items: [
            { he: "אִם יִהְיֶה זְמַן, נֵלֵךְ.", en: "If there's time, we'll go." },
            { he: "אִילוּ יָדַעְתִּי, הָיִיתִי בָּא.", en: "Had I known, I would have come." },
            { he: "לוּ הָיָה לִי כֶּסֶף…", en: "If only I had money…" },
          ],
        },
        { type: "tip", body: "The counterfactual is built with הָיָה plus the present participle: הָיִיתִי בָּא, I would have come. It's the one place the present tense is used to talk about the past." },
      ],
      vocab: [
        { he: "אִם", en: "if", translit: "im" },
        { he: "אִילוּ", en: "if (contrary to fact)", translit: "ilu" },
        { he: "אוּלַי", en: "maybe", translit: "ulai" },
        { he: "בְּלִי", en: "without", translit: "bli" },
        { he: "אַף עַל פִּי כֵן", en: "nevertheless", translit: "af al pi chen" },
      ],
      drills: ["vocab"],
      extra: [
        { type: "choice", q: "“Had I known, I would have come.”", options: ["אִילוּ יָדַעְתִּי, הָיִיתִי בָּא", "אִם יָדַעְתִּי, אָבוֹא", "אִם אֵדַע, בָּאתִי", "אִילוּ אֵדַע, אֲנִי בָּא"], correct: 0, why: "A condition that didn't happen takes אִילוּ with the past, and הָיָה plus the participle in the result." },
      ],
    },
    {
      id: "s3",
      title: "The act itself",
      titleHe: "שֵׁם פְּעֻלָּה",
      goal: "Recognise verbal nouns — the reading, the writing, the development.",
      sections: [
        { type: "text", body: "Each binyan turns its verbs into nouns by a fixed pattern. Once you see the pattern you can read a noun you've never met and know both what it means and which verb it came from." },
        {
          type: "table", caption: "Verb to noun",
          head: ["binyan", "verb", "noun"],
          rows: [
            ["פָּעַל", "כּוֹתֵב writes", "כְּתִיבָה writing"],
            ["פָּעַל", "קוֹרֵא reads", "קְרִיאָה reading"],
            ["פִּעֵל", "מְדַבֵּר speaks", "דִּבּוּר speech"],
            ["פִּעֵל", "מְטַיֵּל travels", "טִיּוּל a trip"],
            ["הִפְעִיל", "מַסְבִּיר explains", "הַסְבָּרָה explanation"],
            ["הִתְפַּעֵל", "מִתְפַּתֵּחַ develops", "הִתְפַּתְּחוּת development"],
          ],
        },
        { type: "tip", body: "This is the single most useful pattern for reading. A page of literary Hebrew is full of nouns you've never seen whose verbs you already know." },
      ],
      vocab: [
        { he: "כְּתִיבָה", en: "writing", translit: "ktiva" },
        { he: "קְרִיאָה", en: "reading, a call", translit: "kri'a" },
        { he: "דִּבּוּר", en: "speech, speaking", translit: "dibur" },
        { he: "סִפּוּר", en: "story", translit: "sipur" },
        { he: "הַתְחָלָה", en: "beginning", translit: "hatchala" },
        { he: "הַרְגָּשָׁה", en: "feeling", translit: "hargasha" },
        { he: "הִתְפַּתְּחוּת", en: "development", translit: "hitpatchut" },
      ],
      drills: ["vocab", "verbal-noun"],
    },
    {
      id: "s4",
      title: "How it's done",
      titleHe: "תֹּאַר הַפֹּעַל",
      goal: "Modify a verb — with an adverb, or with a preposition and a noun.",
      sections: [
        { type: "text", body: "Hebrew has fewer true adverbs than English and makes up the difference with בְּ plus an abstract noun: בְּשֶׁקֶט quietly, literally in quiet." },
        {
          type: "examples", items: [
            { he: "הוּא מְדַבֵּר מַהֵר.", en: "He speaks quickly." },
            { he: "הִיא כָּתְבָה בִּזְהִירוּת.", en: "She wrote carefully." },
            { he: "אֲנִי מַכִּיר אוֹתוֹ הֵיטֵב.", en: "I know him well." },
          ],
        },
        { type: "tip", body: "טוֹב is an adjective doing adverb duty in speech — הוּא כּוֹתֵב טוֹב. In writing you'd want הֵיטֵב." },
      ],
      vocab: [
        { he: "מַהֵר", en: "quickly", translit: "maher" },
        { he: "לְאַט", en: "slowly", translit: "le'at" },
        { he: "הֵיטֵב", en: "well, thoroughly", translit: "heitev" },
        { he: "מְאוֹד", en: "very", translit: "me'od" },
        { he: "תָּמִיד", en: "always", translit: "tamid" },
        { he: "לִפְעָמִים", en: "sometimes", translit: "lif'amim" },
        { he: "כְּבָר", en: "already", translit: "kvar" },
        { he: "בְּשֶׁקֶט", en: "quietly", translit: "besheket" },
      ],
      drills: ["vocab", "listen"],
    },
    {
      id: "s5",
      title: "Word order",
      titleHe: "סֵדֶר הַמִּלִּים",
      goal: "Know the default order, and what moving a word does.",
      sections: [
        { type: "text", body: "Modern Hebrew is subject–verb–object, like English. Literary and biblical Hebrew often puts the verb first, which is why an old sentence can read as inverted before you've parsed it." },
        {
          type: "examples", items: [
            { he: "הַיֶּלֶד קָרָא אֶת הַסֵּפֶר.", en: "The boy read the book. — ordinary" },
            { he: "קָרָא הַיֶּלֶד אֶת הַסֵּפֶר.", en: "Read the boy the book. — literary, same meaning" },
            { he: "אֶת הַסֵּפֶר קָרָא הַיֶּלֶד.", en: "It was the book the boy read. — fronted for emphasis" },
          ],
        },
        { type: "tip", body: "Because the verb ending already tells you the person, Hebrew can drop the subject pronoun entirely in the past and future. הָלַכְתִּי is a complete sentence." },
      ],
      vocab: [
        { he: "דַּוְקָא", en: "specifically, of all things", translit: "davka" },
        { he: "גַּם", en: "also", translit: "gam" },
        { he: "אֲפִלּוּ", en: "even", translit: "afilu" },
        { he: "בִּכְלָל", en: "at all, in general", translit: "bichlal" },
        { he: "כָּךְ", en: "thus, so", translit: "kach" },
      ],
      drills: ["vocab", "build"],
    },
    {
      id: "s6",
      title: "Written and spoken",
      titleHe: "מִשְׁלָב",
      goal: "Read the formal forms that speech has dropped.",
      sections: [
        { type: "text", body: "Written Hebrew keeps forms that conversation has abandoned. Neither is more correct — but a book uses the left column, and you will not have heard it." },
        {
          type: "table", caption: "Same meaning, two registers",
          head: ["written", "spoken", "meaning"],
          rows: [
            ["אֲשֶׁר", "שֶׁ", "that, which"],
            ["אֵינֶנִּי יוֹדֵעַ", "אֲנִי לֹא יוֹדֵעַ", "I don't know"],
            ["בֵּיתִי", "הַבַּיִת שֶׁלִּי", "my house"],
            ["כַּאֲשֶׁר", "כְּשֶׁ", "when"],
            ["רַבִּים", "הַרְבֵּה", "many"],
            ["הִנֵּה", "הִנֵּה / זֶה", "here is"],
          ],
        },
        { type: "text", body: "The possessive suffix is the one to know: instead of הַבַּיִת שֶׁלִּי, literary Hebrew attaches the pronoun to the noun." },
        {
          type: "table", caption: "Possessive suffixes",
          head: ["form", "meaning"],
          rows: [
            ["בֵּיתִי", "my house"], ["בֵּיתְךָ", "your (m.) house"], ["בֵּיתוֹ", "his house"],
            ["בֵּיתָהּ", "her house"], ["שְׁמוֹ", "his name"], ["יָדָהּ", "her hand"],
            ["דְּבָרַי", "my words"],
          ],
        },
      ],
      vocab: [
        { he: "אֵינֶנִּי", en: "I am not (literary)", translit: "eineni" },
        { he: "כַּאֲשֶׁר", en: "when (literary)", translit: "ka'asher" },
        { he: "הִנֵּה", en: "here is, behold", translit: "hine" },
        { he: "בֵּיתוֹ", en: "his house", translit: "beito" },
        { he: "שְׁמוֹ", en: "his name", translit: "shmo" },
        { he: "דָּבָר", en: "thing, word", translit: "davar" },
      ],
      drills: ["vocab", "register"],
    },
  ],
};
