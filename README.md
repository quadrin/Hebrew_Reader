# דּוּכִיפַת · Duchifat — a tap-to-learn Hebrew reader

A web app for learning Hebrew by reading. It ships with **Lavan**, an original
beginner-level graded story with full nikkud, opens a **library of free
public-domain Hebrew books** from three online sources, and lets you load
**your own Hebrew books** (PDF, EPUB, text file, or pasted text). Tap any word
to see its meaning and save it; review saved words with spaced repetition;
drill real sentences with cloze practice; check comprehension with quizzes.

Everything runs in the browser — there is no server and nothing to sign up for.

## What it does

- **Built-in graded story** — 4 chapters, full nikkud (toggleable), every word
  glossed by hand, embedded English per sentence, and a comprehension quiz per
  chapter. Works completely offline from the AI tutor.
- **The Duolingo Hebrew tree, rebuilt — and then carried past where it stops** —
  the app opens on the *Path*: a working clone of
  Duolingo's Hebrew (from English) course, built on the scraped course payload:
  **3 sections and 84 units**, in Duolingo's own order and laid out the
  way the legacy tree laid it out — skills in centred rows of one to three,
  each a disc carrying Duolingo's own skill picture with its name underneath —
  with its teaching objectives, its unit guidebooks and the **Tips & Notes** it
  deleted from the app (66 units still have theirs, conjugation tables and all).
  New words arrive **with a picture of the thing**, the way Duolingo's did:
  1,089 photographs, one per word that names something a photograph can show, and
  the *"which one of these is X?"* question is asked with three of them side by
  side. The pictures are scraped rather than drawn — every one is the lead image
  of the English Wikipedia article the word names, which is the picture editors
  chose as the thing itself. `npm run build:images` collects them, refuses
  anything that turns out to be a diagram (mostly white paper in a handful of
  flat colours), a disambiguation page or an article about an album, and files
  each one with the photographer and the licence it carries. They are 256px
  square WebP, 14 MB for the lot, cached as the words come up rather than
  precached, and credited in full under *You → Picture credits*. A quarter of
  the new-word cards in the course now open with a picture rather than a word.
  That tree ends at unit 84 and at early A2, which is a fine place to stop being
  a beginner and a poor place to stop, because the shelf this app is built
  around is not readable from there. So the path continues:
  **seven more sections and 156 more units, 85 to 240, written for this
  repository rather than scraped** — the rest of the binyanim in past and
  future, the weak roots, the passives, relative and purpose clauses, word
  patterns, the biblical and formal registers, and units that read Bialik,
  Brenner, Agnon and Amichai; then the Hebrew of actually living somewhere —
  the doctor, the bank, the lease, the army, the slang and the filler words —
  then morphology, syntax and register as systems, then comprehension at native
  speed across every register the language has, and finally the abstract
  vocabulary and the unassisted reading that is the ceiling. None of it is
  Duolingo's; it carries no scraped sentence, gloss or recording, and it lives
  in `data/extended-units/` with the provenance written down. The build plans it onto the path with the same code
  that plans the scraped units, so a card is a card wherever it came from —
  including the rows: the scraped cards take their grouping from the tree they
  came out of, and the new ones carry their own, so the path stays one to three
  abreast all the way down rather than falling into a column at unit 85.
  **240 units in 264 cards and 1,056 lessons**, Intro to C1.
  A unit is **at most five lessons**, counting the chest or the review that
  closes it; a unit with more to teach than that holds is drawn as two cards,
  *p1* and *p2*. Duolingo's own tree asked for four to seven sessions of each of
  four to seven levels, so a card there ran fifteen to thirty-three lessons
  deep — "lesson 3 of 15" under a circle nobody was going to finish.
  Lessons are generated from **13,944 sentences** — 7,615 of Duolingo's own,
  harvested from the session API at 17 to 141 per unit, and 6,329 written for
  the units past 84 — together with 1,123 key phrases, of which the 367 from the
  guidebooks carry real Duolingo audio, and 6,102 glossed words. Which of them a lesson asks about is **chosen rather than
  drawn**, which is the one thing worth taking from Clozemaster: not the blank,
  but which sentence gets blanked. A sentence used to be picked uniformly from
  its unit's pool, and measured against the course's own data that left a third
  of a lesson's sentences on material the unit does not teach at all and a
  quarter of them two or more words past anything the course had introduced by
  then. Now a sentence earns its place by what it exercises — the word this
  lesson is teaching, a word that has come round again, the sentence itself
  falling due — and loses it for every word beyond those that you have not met,
  and for running long. Hebrew's one-letter prefixes come off before that
  question is asked, so ולילד counts as ילד. The scores go into a bag with the
  good sentences in it up to four times rather than into a ranking, because a
  ranking would serve the same handful of lines every lesson; everything stays
  seeded, so a lesson re-opened after a crash is the lesson that was
  interrupted. Across all 240 units that moves the sentences carrying a word
  their unit teaches from 77% to 84%, and the unmet words in a drilled sentence
  down by two fifths. **Fill-the-blank** goes further, because it is the one
  exercise that tests a single word and nothing else: it picks the sentence for
  the word rather than the word for the sentence, and now blanks something the
  unit is teaching **89% of the time rather than 34%**. No sentence is asked
  about more than twice in one lesson. Both numbers are asserted by
  `npm run check:duo`, since a lesson built the old way looks exactly like a
  lesson built the new way until you count.
  Every answer is also recorded **against the sentence**, not only against the
  words in it — a Leitner ladder six levels deep, climbing on a right answer
  and dropping to the bottom on a wrong one, which is what tells a line met
  once from one had right five times running and is read back the next time a
  lesson is built. It merges across devices like the words do, so the phone and
  the laptop do not overwrite each other's reading.
  Translation is **typed by default**, in either direction, with
  an on-screen Hebrew keyboard and the word bank one tap away for anyone who
  wants it; a typed answer is marked against every translation the course
  recorded for that sentence, forgives a typo or two, and — with an AI key —
  gets a **second opinion from the model** before it is called wrong, so
  "you are looking at a pretty woman" is not marked against "You see a
  beautiful woman". That runs on the fastest model each provider has and is
  started while you are still typing, so it is usually back before you press
  Check; it waits no longer than 700ms, and a ruling that lands after that
  upgrades the answer rather than delaying it. Anything the grader allows is
  remembered for that sentence. A wrong answer also gets a line saying **what
  was actually wrong** — for Hebrew that is usually gender agreement or a
  missing את, which the bare "Correct solution:" leaves you to spot for
  yourself — fetched after the red bar is already up, so it never delays it.
  It **teaches the answer rather than marking the attempt**: it leads with the
  rule the right Hebrew is following and the form that rule produces, and names
  what you wrote only where that makes the rule clearer, and then second. A
  note that opens by listing your errors reads as a mark against you and leaves
  you nothing to carry to the next sentence, where the rule is the only part
  that transfers — and a note that is not hunting for mistakes stops inventing
  them, which is what the old one did.
  That note is written **in English**: a prompt this full of Hebrew pulls the
  fast models into answering in it, which leaves a beginner staring at an
  explanation of their Hebrew that they cannot read, so a note that comes back
  in Hebrew is asked for again and dropped if it comes back in Hebrew twice.
  It also never counts a person, gender or number **the English never
  specified** as a mistake — "we love this name" says nothing about who *we*
  are, so אוהבים is right and the course's אוהבות is only another right
  answer, and marking it wrong beside a real mistake taught the opposite of
  the truth. The **star beside Continue** saves the sentence you were just
  asked about, right or wrong, into the same favourites the reader's line-end
  star fills. The rest: listening,
  tap-what-you-hear, matching pairs, fill-the-blank, multiple choice, speaking
  graded by transcription,
  alphabet drills for the letter units, and "new word" cards. Sentences with no
  Duolingo recording — nine in ten of them — are **read aloud by a model** and
  cached after the first play. The game around it is all there too: **test out
  of a unit** with the key on its skill's card, or out of a whole **checkpoint
  block** — 20 or 25 exercises, three mistakes and it ends, pass and every unit
  up to that point opens at once, on **three strikes** — a test is the one
  thing that can be failed, and failing costs nothing; **no hearts** anywhere,
  so an ordinary lesson cannot be lost and a mistake costs only the time it
  takes to put right — **a lesson ends when every question in it has been
  answered right**, so a wrong answer goes to the back of the queue and keeps
  coming back until it is not wrong any more, which makes the thing you keep
  missing the thing you keep being asked. A sentence that was **one word out**
  is not marked wrong at all the first time: it says **"Close!"** and names the
  kind of mistake — *check the pronoun*, *right word, wrong ending*, *all the
  right words, not in that order* — and gives the question back with the answer
  still hidden, because a hint is something to think about and an answer is
  something to copy. One hint per question, and none at all in a test, which is
  a measurement rather than a lesson; **crowns**
  per node with legendary levels, **XP with a daily goal ring**, a **streak**,
  **treasure chests**, combo bonuses, an end-of-lesson stats card and
  achievements. There is no league, no shop and no daily quest: they are
  Duolingo's retention machinery rather than its teaching, and a league in
  particular could only ever have been a lie here — no server, no other
  players, so it was twenty-nine invented strangers with randomly generated XP.
  A unit can end with something to **read** rather than another exercise. The
  course teaches in sentences, and a sentence is not what language is: nothing
  in a lesson ever refers back to anything, so the skill that carries a reader
  — holding on to who *he* is across two lines — is the one skill the format
  cannot practise. So **37 units close with a short text**, in Duolingo's own
  order — offered on the lesson-complete screen, which is the moment you are
  reliably looking, and listed under *Practice → Stories*, which does not move
  as the path scrolls. (The path only renders a window of units around where
  you are, so a link on the unit's card — where this started — is unreachable
  for anything you finished a while ago.) The same two people
  and the same cat run through all of them, so it is one thing to read rather
  than seventeen; the English is per line and hidden until you ask for it, and
  the comprehension questions stay out of sight until you say you have read it,
  since a question visible from the start turns reading into scanning. The
  constraint is the point and it is measured, not trusted: every passage is at
  least **95% built from words its own unit and the ones before it have
  taught**, checked by `npm run check:passages` against the course's real data,
  and all 37 currently sit at 100%. It is why the early ones are five short
  lines — after eight units of this course you have about 150 words and almost
  none of the glue, no *של*, no *עם*, no *גם* — and why they grow as the
  vocabulary does. Units 4 to 40 have one so far; the rest of the path does not
  yet. Switch the whole thing off under **You → Settings**, which takes away
  the list and both offers together.
  **Word families** sit in Practice, for the thing that separates two thousand
  Hebrew words from five: almost every word is three consonants poured into a
  pattern, so knowing כ־ת־ב gets you כותב, נכתב, מכתב and כתובת at once. The app
  already asked the tutor for the shoresh on every lookup and then threw it into
  a note string nobody indexed. **30 hand-verified families, 145 words**, drilled
  four ways — which word is *not* from this root, read a rarer member off a
  common one, what the binyan does to the meaning (nif'al being the passive of
  pa'al unlocks נכתב, נשמע, נסגר and נפתח together), and what idea three members
  share. Every question carries the fact it is teaching under the answer, right
  or wrong, since a right answer for the wrong reason is the case that most
  needs telling. The families are checked by hand rather than derived: clustering
  the course's own lexicon by consonant skeleton finds 112 candidates and the good
  ones are excellent, but it also files מעילים under ע־ל־מ and puts "blog" with
  "biology", and a wrong family teaches something worse than the gap it fills.
  `npm run check:roots` catches what a machine can — a member whose letters
  cannot come from the root, backtracking through the weak letters that drop —
  and each family may name a hand-picked **impostor**, a word that looks like it
  belongs and provably does not, which is what the odd-one-out question asks. Off
  under **You → Settings**.
  **Personalised practice** builds itself from what is actually due, and a word
  that is due comes back **inside a sentence** rather than beside two other
  words. Picking אוכל out of a list of three is not the skill this course is
  for; reading it where it stands is — and it is the same retrieval either way,
  so the harder one is free. It finds a sentence in the window that contains the
  word, blanks that word, and credits the answer to the pool's own spelling, so
  a word blanked as ולילד clears ילד from the due list instead of banking a new
  word nobody will ever be asked again. Multiple choice stays for the words no
  sentence contains, and as a change of pace where they do. The hub counts the
  sentences due beside the words, because they are now scheduled beside them.
  A **placement test** is offered on an untouched path: three questions from a
  unit at a time, climbing a nine-rung ladder from unit 3 to unit 82.
  It used to stop at the first set that defeated you and hand back the last rung
  you had cleared, which placed people low twice over. The rungs are up to
  thirteen units apart, so clearing 57 and failing 70 said only that the answer
  was somewhere between — and the test answered 57. Three questions is also not
  a measurement: someone who genuinely knows four in five of a rung gets fewer
  than two right one time in ten, and against eight rungs those chances
  compound. So it **does not stop**. A rung that beats you fixes the top of a
  range rather than ending the test, and the ladder becomes a search: halve
  what is left between the highest unit cleared and the lowest known to be too
  hard, ask again, settle once the gap is down to two. The obvious fix — more
  questions a rung — turned out to be the wrong one, and simulating both
  against a learner who answers noisily is what showed it: five questions
  passing on three does place almost exactly, but costs 43 questions against a
  banner promising two minutes. Once a bad rung is recoverable rather than
  final, three questions are enough, because a rung failed by bad luck is
  re-probed from below a moment later. **Three questions with the search places
  a unit short on average and takes 23; three without it placed nearly five
  units short and left one learner in six more than ten units adrift.** Against
  a learner who knows everything up to a unit and nothing above it, it now
  lands **within one unit every time**, checked for all 82 by
  `npm run check:duo`. Everything you clear is unlocked and the path starts
  there. Everything is stored on the device.
  It can also be **run again**. The banner offering it only ever appeared on an
  untouched path, so one lesson retired the only instrument the course had for
  asking where somebody actually was — no use at all to a learner who improved
  elsewhere, or came back after a year off. **Practice → Check my level** runs
  the same test from the rung nearest where the path already has you, rather
  than from the alphabet, which saves the fifteen questions it would take to
  climb back up to yourself. Starting above your real level costs nothing now
  that a failed rung searches downwards instead of ending the test, and the
  result can only open units, never close them, so a bad morning cannot undo
  work already done. `npm run check:duo` runs a level check from every rung
  against every possible true level and asserts it still lands within one unit
  and never overshoots.
  The course also **notices how it is going for you**. Every session records
  its first-attempt accuracy against the unit it was in — first attempts only,
  since a question got right on the second go inside the same session is a
  question got wrong, and counting the requeue would make every lesson report
  the accuracy the requeue was built to produce. At the end of a unit, that
  record earns one offer, in this order: **struggling** (under 68% across the
  last few units) gets the unit's notes rather than another lesson, because
  somebody at 60% is not helped by being sent forwards or backwards;
  **something forgotten** comes next; and only with nothing behind you wanting
  attention does **going faster** get offered — a test two to five units ahead,
  sized by how well you are doing, which opens all of them at once.
  Because a crown is a high-water mark and knowing is not. Unit 12 cleared in
  March is not unit 12 known in August, and nothing here used to decay: the
  crown stayed gold and the only way back was to scroll the path down and
  guess. So **a unit's strength falls off** — measured where there is anything
  to measure, from how many of the words it taught are past their review date,
  and from the calendar where there is not, halving every three weeks toward a
  floor, because you do not forget a language to zero. A unit opened by a test
  is stamped with the day it was passed and capped below one worked through,
  since twenty questions is thinner evidence than five lessons — without that,
  a placement left forty units reading as perfectly held for ever.
  A unit is not judged by its own calendar, though, because that gets the
  commonest case backwards. Hebrew's most useful words are taught in the first
  few units and then never stop appearing: ה, של and אוכל are in unit 40's
  sentences as much as they were in unit 3's, so somebody grinding unit 40 is
  exercising unit 3 every day. Dating unit 3 from the last lesson launched
  inside it calls that unit forgotten while it is in constant use. So the
  **words decide**, each carrying the date it was last answered as well as the
  date it is next wanted, and a unit is held to the degree its own vocabulary
  is still inside the review windows it has earned. Partial credit, not a yes
  or a no: freshly answered is 1, the moment it falls due is 0, and higher
  levels ride near 1 for longer, which is what the ladder is for. The calendar
  only fills in what the words cannot answer, blended by how many of them there
  are rather than switched to at a threshold — a cliff meant one more word
  answered could swing a unit from healthy to forgotten. And the reuse signal
  is deliberately kept out of the calendar: counted per word it is weighed by
  how much of the unit is in use, while as a flag one lucky word out of thirty
  would speak for the other twenty-nine.
  That only works if the reuse is recorded, and most of it was not. An exercise
  credited the words the glossary carried a hint for, which across the sentence
  bank is **77% of them**, and credited them against whichever unit was on
  screen. Everything else went past unmarked. So every word you already know
  that appears in a sentence you answer correctly is now credited too, and
  credited to the unit that first taught it: four lessons at unit 40 reach
  **eleven more units** that way, units 1, 2 and 4 among them. It is scored as
  **exposure rather than recall** — the level does not move, because nothing
  asked you to produce the word and getting credit for reading past it would
  inflate the ladder until it meant nothing. What moves is the clock, and only
  so far: a word seen in passing is pulled back to at most halfway through the
  interval it had already earned, so exposure can keep a word from lapsing but
  can never carry it further than a real review would have.
  What has faded is offered back under **Practice → Review an old unit**, weakest
  first, and is never called forgotten if it was never finished. It also shows
  **on the path itself**, which is the only place most people look: a finished
  unit that has not been practised in a long time is drawn with the colour going
  out of its disc. Duolingo's gold never dulls, and that is the lie in it — a
  crown earned in March says exactly what a crown earned yesterday says. Opening
  a pale one says when you last practised it and offers a review rather than
  more practice. It is also why
  the "go faster" offer comes last: jumping ahead on foundations that have gone
  is exactly how somebody ends up lost two sections later with no idea which
  part gave way.
  None of this re-teaches what you already know. A placement can open forty
  units without a question being answered inside them, which left the word map
  empty — so every lesson afterwards introduced vocabulary the learner had
  known for years, and the sentence weighing counted their whole vocabulary as
  unmet and marked perfectly readable lines as too hard. `npm run build:lexicon`
  writes **`lexicon.json`, 12,384 words against the unit each first appears in**
  (145 KB), so "have they been taught this?" can be answered from where they
  have reached rather than from what this device has seen them answer. Seeding
  the word map instead would have invented two thousand review dates nobody
  earned.
- **A taught course** — six levels and 90 lessons, from *this is an alef* to
  reading Brenner. It follows the shape every ulpan uses, because a course has
  to: the alphabet, the vowel marks and where the stress falls first, then
  nouns and gender, demonstratives, adjective agreement, comparison, the
  present tense, possession — both שֶׁל and the endings hung on the noun — the
  past, the dual, the construct chain, the seven binyanim, the future across
  all of them, the passive participle, the prepositions each verb insists on,
  the patterns words are built from, and finally the older forms — the
  vav-consecutive, attached object pronouns, the directional ־ָה, the words
  whose meaning has moved since — that the public-domain library is actually
  written in. It ends where the shelf begins, with the unpointed spelling every
  real book is printed in. Grammar lessons alternate with **28 themed
  vocabulary packs** of 19–34 words apiece — the house, the body, the market,
  the calendar, the Jewish year, a day in verbs, the road out, the rabbinic
  register — for **770 words**, spliced in after the grammar each set needs.
  Each lesson teaches, then tests: **1,848 exercises** across seven kinds —
  multiple choice, listening (spoken aloud), sounding out, matching,
  odd-one-out, fill-the-gap in a real sentence, sentence building, and typing
  Hebrew unprompted. **1,195 vocabulary entries**, 1,119 of them distinct, and
  no question has a second right answer among its wrong ones — a distractor is
  dropped if it matches the answer's spelling or its gloss, which is the only
  thing standing between כֶּסֶף *money* and כֶּסֶף *money, silver* being offered
  in the same four options. Every letter, example, conjugation and vocabulary
  word is tappable to hear it. Progress is per lesson, with a score you can
  beat by practising again.
- **Graded readings from the corpus** — at the end of each level, real
  public-domain passages picked by how much of each is built from words that
  level has covered, so the first thing you read is 84% familiar. Vocabulary
  from a lesson joins the same spaced-repetition store as starred words, and any
  reading opens in the reader like an ordinary book.
- **A grammar reference** — Wikibooks' Hebrew course (CC BY-SA): alphabet pages,
  binyanim and conjugation tables, to keep beside a book.
- **A graded shelf, offline** — the app ships with 75 short public-domain
  works from Project Ben-Yehuda, sorted into five reading levels coloured green
  (easiest) to red. Grading is measured against the corpus itself: each book is
  scored by how much of it is written in the 2,000 commonest Hebrew words, so
  you can pick something at **71% familiar** rather than guessing from a title.
  Each entry shows the title in English, the author's name in English (from
  Wikidata) with a one-line description, a romanization of the Hebrew title
  where it's vocalized enough to sound out, and a one-line summary of what the
  book is actually about. No key, no network — the shelf browses offline and a
  book stays cached once opened.
- **Free public-domain library** — the *Browse* tab opens three more online
  sources and downloads any of them straight into your library:
  **Sefaria** (a curated shelf of vocalized classical texts, no sign-up),
  **Hebrew Wikisource** (the whole public-domain corpus, no sign-up), and
  **Project Ben-Yehuda** (~65,000 works of modern Hebrew literature by 4,400
  writers, using a free key you can get in a minute). Both of the big two are
  browsable, not just searchable: Wikisource opens on nine shelves with English
  names — folk tales, children's stories, poetry by poet — that drill down into
  its category tree, each work showing an estimated reading time; Ben-Yehuda
  opens on a directory of 504 writers and 25,624 works, named in English,
  filterable, and sorted by genre, which ships with the app and needs no key to
  browse. Downloaded books record where they came from and under what licence,
  and behave exactly like imported ones — tap-to-learn, nikkud, quizzes and
  cloze all work.
- **Titles in English** — every list of Hebrew titles, in the course and both
  live libraries, carries an English line under the Hebrew, so you can tell what
  a book is before opening it. Author names come from Wikidata and cost nothing;
  titles are translated with your AI key, one batched request per list, kept
  afterwards so the same shelf is never paid for twice. Switch it off in
  Settings.
- **Your own books** — import a Hebrew PDF (text-layer PDFs; the RTL reading
  order is reconstructed), an `.epub`, a `.txt` file, or pasted text. Books are
  stored in your browser and remembered across visits, with a **common words**
  list per book so you can learn the highest-value vocabulary first.
- **Tap-to-learn** — tap a word and its English **appears right above it in
  the text** (Wiktionary's free API does the quick lookup — no key needed;
  the AI tutor fills in when the dictionary misses), with a **star** beside
  the meaning. Tapping asks what a word means and nothing else: the word is
  not put into practice until you tap that star, at which point it turns
  gold and joins **My Words**. Reading a page and tapping thirty words you
  half-knew used to leave you thirty flashcards you never asked for, which is
  the reverse of what tapping is for — you tap the words you *don't* know, and
  most of them you only need once. The star is the second, deliberate step, and
  it is the moment the review schedule starts, so a word starred today is due
  today however long ago you first met it. Everything the lookup worked out is
  kept either way: an entry is filed under its **dictionary form** — tap
  במשקפת and you learn משקפת, tap a conjugated verb and you learn its
  infinitive, and a word inside a fixed expression (מגדל תצפית, בית ספר)
  takes the whole phrase — tapping either member shows the phrase meaning.
  Every surface form you met stays marked and listed under the entry; a
  starred word carries the gold highlight, one you have only looked up wears
  a quiet underline. Tap a word again for the full panel: dictionary detail,
  AI deep dive, star/known toggles, and a re-lookup button. **Press and hold**
  a gold word to drop it from practice right in the text — the meaning stays
  under it, since you still met the word. Opening a sentence's
  translation shows the full **interlinear view** — a gloss above every word,
  and no stars there, because a star over every word in the line is all you
  would be able to see — and the **star** at the end of any line saves the
  whole sentence to a favorites list. Words collected before any of this
  existed were in practice by definition, tapping being the only way in, so
  they are all carried across starred.
- **Known words & comprehension meter** — mark words as known from the word
  panel (words also graduate automatically when they master the top SRS box).
  Each book page then shows *"you know N% of this page"*, the common-words
  list tracks how much of the book you've mastered, and drills stop blanking
  words you already know.
- **Spaced repetition** — starred words are scheduled with a Leitner system
  (1 → 3 → 7 → 14 → 30 days). They live in the path's **Practice** tab, which
  is where the reviewing was always done: one switch flips the list between
  the words the lessons taught and the words you starred while reading, the
  flashcards and the cloze drill sit above it with the course's own practice,
  and the **Practice** tab itself carries the count of what is due, from both
  stores at once. It used to sit on the app's own *Path* tab, where it was a
  number next to a word that is not where the reviewing happens; it counts
  reviews only, not the mistakes list, because mistakes do not expire and a
  badge that never goes out is not a notification. Words used to have
  a header tab of their own, which meant two places to go for one thing.
  Flashcards and cloze answers both feed the schedule. Export your words as an
  **Anki deck** any time, or download a full **backup** (books, words,
  progress) and restore it on another device.
- **Cloze practice** — fill-in-the-blank drills built from real sentences:
  random sentences from the book you're reading plus sentences you saved words
  from, with distractors drawn from the same book. Both cloze and flashcards
  have a **typing mode** (toggle in the header): produce the Hebrew yourself,
  graded forgivingly — nikkud and final-letter forms don't count against you.
- **Read aloud** — listen to a whole chapter or page with the built-in speech
  synthesis; the current sentence is highlighted as it plays. Any single word
  or sentence has its own listen button too.
- **Reading comfort** — paper, sepia, and dark themes plus four text sizes,
  remembered across visits. Installable as an app (PWA): after the first
  visit, reading works offline.
- **Simple Hebrew mode** — reading above your level? One tap rewrites the
  page into short, fully vocalized, everyday modern Hebrew (nothing skipped,
  nothing added), cached per page and toggleable like the nikkud view. Read
  the simple version first, then flip to the original — every feature (tap
  glosses, translations, read-aloud, quizzes, cloze) works on both.
- **AI tutor (optional)** — with your own API key from **Anthropic (Claude)**,
  **OpenAI (ChatGPT)**, or **Google (Gemini)**, the app can define *any* word
  you tap in *any* book, translate sentences, explain the **grammar** of any
  sentence point by point, **add nikkud** to unvocalized books page by page,
  rewrite pages in **simple Hebrew**, give deep-dive explanations with
  examples, and write a fresh comprehension quiz for any page. Configure it
  from the gear icon in the app.

## Put it online (GitHub Pages)

The repo includes a workflow that builds and publishes the app automatically.
One-time setup:

1. On GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Open the **Actions** tab, select **Deploy to GitHub Pages**, and click
   **Run workflow** (it also runs automatically on every push to `main`).

Your reader will be live at:

```
https://<your-username>.github.io/Hebrew_Reader/
```

The build is path-independent (`base: "./"`), so it also works on Netlify,
Vercel, Cloudflare Pages, or any static host — just serve the `dist/` folder.

## Run it locally

```bash
npm install
npm run dev        # development server
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

### Regenerating the Duolingo path

`public/duo/` is generated and committed, so an ordinary build needs nothing
extra. It has two inputs: the scraped course bundle in
`data/duolingo-hebrew-tree/` (the CSVs, the Tips & Notes, and the 84 unit
guidebooks), and `data/extended-units/`, which holds units 85-240 as written
JSON because nothing was scraped to generate them from. Both go through the
same card planner, and the second is invisible from anywhere downstream.

```bash
npm run build:duo    # data/duolingo-hebrew-tree/ + data/extended-units/ → public/duo/
npm run build:images # scrapes a photograph for every word that can have one
npm run check:duo    # builds a session for every unit and marks it
npm run check:sync   # the rules for merging progress between two devices
```

`check:duo` is the safety net for a course nobody will click through by hand:
it generates six sessions for each of the 240 units plus the eleven checkpoint
tests — 1,494 sessions, 23,338 exercises — and fails if any of them is
unanswerable, if a word bank is missing one of its own answer tokens, if two
multiple-choice options mean the same thing, if a checkpoint test draws on too
narrow a slice of its block or tries to teach a new word, or if the same seed
stops producing the same lesson. It checks the shape of the path too: no card
deeper than five lessons, no unit split into more than two, and a split unit's
nodes and lessons numbered straight through — both its cards answer to the same
unit number, so the node number is the only thing keeping their progress
apart.

**What a lesson is built from.** The course reports 8,305 sentences; 7,723 of
them were recovered from `POST /2017-06-30/sessions` — the endpoint the app
itself calls to start a lesson — and 7,615 of those could be placed on the
path. 6,731 arrived carrying the unit they were served in; the rest came from
whole-course practice and are placed at the unit that introduces their hardest
word. Each sentence keeps every English it was ever paired with, so a typed
answer is marked against all of them.

Tap-hints work on all of it. Only the 367 guidebook phrases came with
Duolingo's own hint tables, so the build assembles a **4,686-word glossary** —
guidebook hints first, then the course's own single-word `assist` challenges,
then the lexeme list, then a community vocabulary PDF for the rest — and gives
each unit the hints for the words its sentences actually use. The PDF is
typeset in Title Case with binyan tags, so those glosses are folded down to the
register Duolingo writes hints in, with real names left capitalised.

**Voice.** Only 338 sentences have a Duolingo recording — the CDN URLs exist
for guidebook phrases and nothing else — and the browser's own Hebrew voice is
missing on most desktops. So everything else is **spoken by a model**: OpenAI,
Gemini, or ElevenLabs, whichever you have a key for, chosen in *Path → You →
Voice*. Each sentence is generated once and cached in IndexedDB, so it replays
instantly, works offline afterwards, and is only ever paid for once; a lesson
warms the voices it is about to need while you answer the first exercise. The
turtle button slows the playback rather than regenerating it. With no key the
path falls back to the system voice, and with no system voice listening
exercises simply do not appear.

The button that plays it appears wherever there is Hebrew to hear, which is not
the same as wherever there is a recording — 338 sentences out of 13,944 have
one, and none of them is in a unit written for this app. It goes by the
language of the prompt instead: a sentence you are being asked to translate
*out of* Hebrew can always be heard, and one you are being asked to write *in*
Hebrew never can, because there the audio is withheld on purpose rather than
missing. The cloze is the other exception and keeps its recording-only button —
playing the whole line would read out the word it has taken away.

The same keys grade **speaking**, and grade it on sounds rather than spelling.
Chrome's recogniser claims Hebrew and usually is not installed with it: asked
for "אתה רוצה כוס מיץ?" it will happily answer "A to océ Kosmic", which is the
sentence, written by something that does not know it is Hebrew. Comparing that
to the Hebrew word by word fails every time, so a transcript that is not
Hebrew goes to the model, which can tell that those letters are the sentence
being said. Where a key allows it the mic is recorded and transcribed by
Whisper (or Gemini) in the first place, which mostly avoids the problem. With
neither, an unjudgeable transcript is *not* counted as a mistake — it says the
recogniser failed and lets you skip. Nothing is recorded or sent unless you
press the button, and it goes to your own key.

**Where it still runs thin.** 582 sentences of the published 8,305 were never
seen by the sweeps, and 48 more could not be placed in a unit.

**Provenance.** The course content is Duolingo's, scraped from
`duolingodata.com` payloads, the guidebook CDN and the session API with an
account owner's own token, and vendored here as a research artefact — see
`data/duolingo-hebrew-tree/README.md` for exactly what came from where, and
`data/duolingo-hebrew-tree/harvest_sentences.py` for how the bank was pulled.
It is not ours to relicense or republish as a course. The same holds for the
skill artwork in `src/assets/tree/` — the legacy tree's three sprite sheets,
scraped from duome.eu, whose provenance and terms are in the `SOURCE.md` beside
them. The pictures are Duolingo's.

Units 85-240 are the exception and are ours: written for this repository, no
scraped sentence, phrase, gloss or recording in them, and kept apart in
`data/extended-units/` precisely so the line stays visible. They reuse the
skill artwork, which is Duolingo's like the rest of it.

### Regenerating the offline shelf

`public/shelf/` is generated and committed, so an ordinary build and deploy
need nothing extra. To refresh it against a newer dump:

```bash
git clone --depth 1 https://github.com/projectbenyehuda/public_domain_dump
npm run build:shelf -- --dump ./public_domain_dump
```

The dump is ~3 GB, which is why it isn't a build dependency — the script reads
it, ranks the corpus vocabulary, scores every candidate work for readability,
picks a balanced shelf (capped at three works per author) and writes ~1.5 MB of
JSON. `--count` and `--per-author` tune the selection. Every work in that dump
is public domain; its licence asks that reuse credit "Project Ben-Yehuda
volunteers", which the shelf shows on each book.

**English titles and summaries.** Nothing in the dump carries an English title
or a description, and there's no offline way to derive one — so with an API key
the script asks for both, once per work. Either provider works; it uses
whichever key it finds:

```bash
OPENAI_API_KEY=sk-...      npm run build:shelf -- --dump ./public_domain_dump
ANTHROPIC_API_KEY=sk-ant-... npm run build:shelf -- --dump ./public_domain_dump
```

Get a key from [platform.openai.com](https://platform.openai.com/api-keys) or
[console.anthropic.com](https://console.anthropic.com/settings/keys). Set both
and it prefers Anthropic; `--provider openai|anthropic` overrides, and
`--model` and `--concurrency` tune the run.

The answers are cached in `scripts/shelf-english.json` and committed, so this
costs roughly a dollar or two **once** rather than on every rebuild — later
builds reuse the cache and skip the calls entirely, key or no key. Without a
key the shelf still builds; entries fall back to showing the book's opening
lines in Hebrew.

### Regenerating the curriculum

`public/curriculum/` is generated and committed:

```bash
npm run build:curriculum
```

No key, no dump, no network — the only input is the hand-authored syllabus in
`scripts/curriculum/`, so the output is reproducible and the diff is readable.

The split matters. `scripts/curriculum/lessons-1.mjs` … `lessons-6.mjs` hold the
teaching: what each lesson explains, in what order, with which words. The build
script turns that into practice — every table becomes questions with the other
rows as distractors, every vocabulary list becomes recognition, production,
listening and typing drills, every verb table becomes a conjugation quiz. That
keeps the authoring small enough to check by hand while the exercise count stays
high: 1,195 vocabulary entries across 90 lessons expand to 1,848 exercises.

`vocab-1.mjs` … `vocab-4.mjs` hold the themed packs — concrete nouns, verbs and
abstractions, the connective tissue, and the sets a reader needs rather than a
speaker: the fixed phrases, the Jewish year, the century of new words, the road
out, and the kingdom. Each declares which lesson it follows, and the build
script splices it in there, so a word set arrives once the grammar to use it
exists. A pack's exercise count scales with its size, and the drills that can't
be passed by elimination — typing and sentence building — are held back from
the cap rather than trimmed by it.

A word may be taught twice — a themed pack gathers up words the grammar lessons
introduced one at a time — and 76 of them are. That is only safe because the
drill builder throws away any wrong answer that matches the right one on either
side, spelling or gloss. Without it, a pack that re-teaches כֶּסֶף as *money,
silver* puts a second correct option into every question the earlier lesson
asks about *money*, and the learner is marked wrong for choosing it.

```bash
npm run check:curriculum
```

checks the things the build script has no reason to notice: a pack pointing at
a lesson that has been renamed, two lessons sharing an id — which is what
progress is stored against — a word list with the same word in it twice, a
gloss covering two different words in one lesson, a drill naming a data set
that isn't there, a lesson asking for a cloze with no sentences to cut, and a
pack more than a third of whose words were already taught, which is revision
wearing a theme.

Two data files are the exception and are written out by hand rather than
generated: `alphabet.mjs` (letters, finals, vowels, the dagesh) and `verbs.mjs`
(one fully-conjugated model verb per binyan). A general morphology engine would
be the tempting way to do the verbs and the wrong one — Hebrew's stem changes
depend on which consonants a root has, so an engine that looks right on כתב
quietly produces nonsense on a guttural or weak root. The model verbs are all
strong roots, so the patterns actually hold.

### Recording the key phrases

The voice above is generated in the browser, once per line per device, and it
needs a key and a network the first time. `build:audio` does the same job ahead
of time:

```bash
npm run build:audio -- --dry-run          # what it would cost, spending nothing
OPENAI_API_KEY=sk-... npm run build:audio
```

**4,731 lines, 42,251 characters**, billed per character at whatever
`gpt-4o-mini-tts` costs on the day. What it records is decided by what a lesson
actually plays rather than by what looks important — which is not the same
thing, and the difference is most of the value:

| | lines | characters | what it is for |
|---|---|---|---|
| the words | 3,977 | 20,395 | a vocabulary card is a Hebrew word and a speaker, and it plays on sight |
| the phrases | 754 | 21,856 | the lines a unit opens with, which the guidebook shows |
| `--sentences` | 4,415 | 112,428 | the lines a lesson dictates — unanswerable without hearing them |

That covers **97% of the vocabulary cards and 99% of the word multiple-choice**;
with `--sentences`, every dictation as well. The sentences shown for
translation are left to the generated voice, because covering those means all
13,944 of them and a third of a gigabyte.

It uses the same model and the same instructions `src/voice.js` uses in the
browser, so a word recorded here and a sentence spoken at runtime are the same
teacher. `--voice nova` picks another of the voices the app offers.

**Watch the disk, not the bill.** The characters are cheap and the megabytes
are not: the default 4,731 lines land at about 140 MB, because what comes back
is a 128 kbps mp3 whether the line is one word or twenty. `--sentences` more
than doubles the character count and records longer files, so size it with
`--limit 50` before committing to the whole run.

Speech at one voice, read slowly, does not need 128 kbps:

```bash
npm run shrink:audio
```

AAC at 32 kbps, which for the whole course is around 400 MB down to something
worth committing. It needs nothing installed — `afconvert` ships with macOS,
and ffmpeg is used instead where that is what the machine has. Files become
`.m4a` and `audio.json` is rewritten to name them; the player reads the name
out of the index rather than assuming a format, so nothing else changes.

Nothing is deleted until its replacement is on disk and is not empty, so an
encoder that fails leaves the mp3 it was given, still indexed and still
playable, and a second run picks up where the first stopped.

Do this **before the first commit**. Once the full-size files are in git they
stay in its history whatever the working tree says afterwards.

Output is `public/duo/audio/*.mp3` and `public/duo/audio.json`, which maps the
Hebrew line to the file that says it — keyed by the text itself, so there is no
hash for the two ends to disagree about. Nothing already in the index is asked
for again, and the index is written as the run goes, so an interrupted run
keeps what it paid for and a second run is free.

A line already carrying a Duolingo recording is left alone; those are read by
people. So the order a line is played in is: Duolingo's recording, then
anything this build made, then the voice generated in the browser, then the
system voice, then silence. The recordings are not precached — they are a
download the app makes only for someone who reaches the unit — but they are
kept for good once fetched, which is the point of shipping them at all.

The repository ships the index empty. Run the build and the app picks the
recordings up with no further change.

### Regenerating the graded readings

`public/course/` holds the frequency-graded corpus readings that each curriculum
level ends with. It is generated from the same dump as the shelf:

```bash
OPENAI_API_KEY=sk-... npm run build:course -- --dump ./public_domain_dump
```

The script ranks the corpus vocabulary, cuts the corpus into candidate spans at
four lengths, then for each unit picks the span best covered by everything
taught so far. Reading length grows with the band — Hebrew inflects heavily, so
coverage by surface form climbs slowly, and a beginner needs a sentence rather
than a paragraph. `--concurrency` and `--model` tune the glossing run, whose
answers cache in `scripts/course-glosses.json`. Without a key the course still
builds; the words ship bare and the reader's tap-to-translate fills them in.

### Harvesting the reading feed

`public/duo/feed/` is real Hebrew — pages of Hebrew Wikipedia, scored against
the course's own vocabulary so the reader is only ever handed what it can
actually read:

```bash
npm run build:feed
npm run build:feed -- --limit 400   # a quick pass while iterating
```

The seed is Wikipedia's own list of the articles every encyclopedia should
have, ten thousand of them, tagged by the topic subpage each is listed under
and read everyday-life first. Leads come back twenty at a time, the
four-alphabet parenthetical that opens every article is stripped, and each
sentence is scored on its own: an article is readable in patches, and averaged
whole, both the patches and the walls disappear.

What ships is a page rather than a sentence — the article's title and the
longest run of its opening sentences that keep passing, two at the least. The
run grows one sentence at a time and stops where the page would go over its
gloss budget, rather than being built long and then thrown away for it, which
cost a third of the harvest when it was the other way round. Every line keeps
its own score, so the English side can be filled in a sentence at a time by
somebody who can see how far they have got.

Every token goes through the same morphology the session builder weighs
sentences with, so ובעירנו is found under עיר — and whatever is left over after
that is genuinely new vocabulary, which gets listed rather than hidden. A page
may leave one word in twelve to the gloss and three at the most: a text with
nothing unknown in it is a test rather than a read, and the reader already
glosses a tapped word.

What comes back is worth stating plainly, because it is not what you would
guess. The obstacle is register rather than grammar: encyclopedic Hebrew leans
on כגון, מוגדר, תרכובת, מעמד and למעט, ordinary words that a 12,000-form course
index does not carry, and no amount of harvesting conjures them. Two
*consecutive* readable sentences are rarer still than one. From 10,040 articles
the feed carries 1,378 pages — 32 of them readable by unit 84, 200 more through
unit 160, and 1,146 after it. It is thin below unit 60, which is where the app
starts offering it, and that early stretch needs another answer.

It ships one file per twenty units behind a small index, so a learner at unit 80
does not download unit 200 to read one page. What was downloaded is kept in
`.cache/` and not committed, so re-scoring after a change to the morphology
costs only the time to read it back — which `npm run check:feed` will ask for,
since it re-derives every shipped number from the committed lexicon and fails
when they no longer agree. The text is CC BY-SA 4.0: every page names the
article it came from, and the index carries the licence and the link back.

**Reading one.** Practice → *Read an article* lays the page out as a page: the
Hebrew lead on the right under its own title, and an empty English column on
the left that you write, one sentence at a time. A finished sentence stands as
prose and the next one gets the box, so what builds up beside the Hebrew is the
article in your own words.

Nothing marks a translation of Wikipedia for free — there is no reference
English, which is exactly what makes it real Hebrew — so the marking is the
tutor's: it reads the Hebrew and rules on what you wrote, and *Hint* names the
one thing in the way (the hardest word, a prefix you may not have taken apart,
which word is the verb) without handing over the sentence. Tapping any word
still goes to Wiktionary and needs no key. Without a tutor key the page still
works as reading: the button becomes *Next sentence*, what you wrote stands
unmarked, and the bar says where to add one.

### English names and titles for the course

The course lists its readings by Hebrew title and author, which is no help to
the person the course is for. This fills both in:

```bash
npm run build:course:english
```

Author names come from `public/browse/authors.json` and need no key — that
alone names 55 of the 60. Titles need a provider key; with one, they are baked
in for every visitor:

```bash
OPENAI_API_KEY=sk-... npm run build:course:english
```

Without it the app translates titles in the browser instead, using the reader's
own AI key (Settings → *Titles in English*). Answers are batched one request per
list and kept in IndexedDB, so a shelf is never paid for twice. Re-running is
idempotent and only fills in what's missing.

### Regenerating the Ben-Yehuda writer directory

`public/browse/` is generated and committed, again from the same dump:

```bash
npm run build:authors -- --dump ./public_domain_dump
```

Ben-Yehuda's API can hand over any work by id but has no endpoint that lists
what it holds, and its search filters are undocumented — so the tab used to be a
search box you could only use if you already knew the answer. The dump's
catalogue supplies the missing index: this writes `authors.json` (504 writers
with 3+ works, named in English from Wikidata) plus one file per writer listing
every work and its id. Metadata only — around 2 MB of titles, no text — so
browsing costs no requests and no key; only the work you choose is fetched from
Ben-Yehuda. `--min-works` and `--max-works` tune the cut.

### Single-file version

```bash
npm run build:single
```

produces `dist-single/index.html` — the entire app (fonts included) in one
HTML file you can double-click, email to yourself, or drop onto any host.

## The AI tutor key

AI features call your chosen provider's API **directly from your browser**
with a key you paste into the app's settings (gear icon). Any one of these
works:

| Provider | Get a key at | Models offered |
| --- | --- | --- |
| Claude (Anthropic) | [console.anthropic.com](https://console.anthropic.com/settings/keys) | Sonnet 4.6 (default), Opus 5, Haiku 4.5 |
| ChatGPT (OpenAI) | [platform.openai.com](https://platform.openai.com/api-keys) | GPT-5.6 Luna (default), GPT-5.1, GPT-5 mini, GPT-4.1 |
| Gemini (Google) | [aistudio.google.com](https://aistudio.google.com/apikey) | 2.5 Flash (default), 3 Pro preview, 2.5 Flash-Lite |

- The key is stored only in your browser's localStorage and is sent only to
  the provider you chose. It is never embedded in the site or shared.
- Keys are kept per provider, so you can save one of each and switch freely —
  the app verifies a key with a tiny test request before saving it.
- Word lookups and translations cost a fraction of a cent each.

Without a key: reading, the built-in story, **the Sefaria and Wikisource
libraries**, word saving, **dictionary lookups (via Wiktionary)**,
spaced-repetition review, cloze practice, read-aloud, themes, and backups all
still work — only the context-aware AI definitions, translations, grammar
breakdowns, nikkud, and page quizzes are off.

## The Ben-Yehuda key (free, separate from the AI key)

[Project Ben-Yehuda](https://benyehuda.org/) — the Hebrew equivalent of
Project Gutenberg — serves its catalogue through an API that asks every app
for its own key. Keys are free, self-service, and issued instantly by email
at [benyehuda.org/api_keys/new](https://benyehuda.org/api_keys/new). Paste it
into *Browse → Ben-Yehuda*; like the AI keys, it
is stored only in your browser and sent only to Ben-Yehuda. Their guidance is
to stay under 50 requests a minute, which ordinary reading never approaches.

The writer directory in that tab ships with the app, so you can browse all 504
writers and 25,624 works without a key — the key is only asked for when you
open one.

Sefaria and Hebrew Wikisource need no key. All three send open CORS headers,
so the app talks to them directly from the browser and stays a static site
with no server of its own.

## Project layout

```
index.html                 app shell
src/App.jsx                UI — reader, library, review, cloze, settings
src/Browse.jsx             browse & download from the free public-domain libraries
src/Course.jsx             the curriculum — levels, lessons, graded readings
src/Lesson.jsx             the lesson player and its six kinds of exercise
src/duo/Duo.jsx            the Duolingo path — shell, HUD, session launcher
src/duo/Path.jsx           the tree: sections, skill rows, checkpoints, chests
src/duo/Session.jsx        the lesson player: combo, mistake requeue, test grading
src/duo/exercises.js       builds a session out of a unit's phrases and words — chooses which
                           sentences by what they exercise, marks the answers
src/duo/state.js           XP, crowns, streak, words, sentence schedules, how each unit is
                           going and how much of it has faded, achievements
src/duo/Screens.jsx        practice hub (drills, saved words, sentences), profile, sync, voice, settings
src/duo/Guidebook.jsx      key phrases, word list, Tips & Notes per unit
src/duo/md.jsx             the small Markdown renderer the notes need
src/duo/alphabet.js        the 22 letters and the vowel points, for the drills
src/duo/skillArt.js        picks a skill's cell out of Duolingo's icon sprite sheet
src/duo/unitNames.js       a short name for each of the 240 units, printed under its nodes
src/duo/audio.js           phrase audio + synthesised interface sounds
src/sync.js                progress transfer between devices: collect, merge, encode
src/cloud.js               automatic sync through a private GitHub gist
scripts/check-sync.mjs     asserts the merge loses nothing and is idempotent
src/voice.js               generated Hebrew speech (OpenAI / Gemini / ElevenLabs), cached; Whisper transcription
src/duo/duo.css            the path's own skin, themed from the reader's palette
data/duolingo-hebrew-tree/ the scraped Duolingo bundle (source data)
data/extended-units/       units 85-240, written for this repo rather than scraped
public/duo/                the generated path and unit files (committed)
scripts/build-duo.mjs      turns both of those into public/duo/
scripts/fetch-images.mjs   scrapes Wikimedia photographs for the vocabulary
scripts/check-duo.mjs      generates and marks a session for every unit, and counts what
                           the lessons are made of
scripts/check-pace.mjs     asserts units decay, that testing out is thinner evidence than
                           working through, and that the offers point the right way
scripts/build-lexicon.mjs  the word index: every word against the unit it first appears in
public/duo/lexicon.json    that index (generated, committed)
src/library.js             shelf + course + Sefaria / Wikisource / Ben-Yehuda / Wikibooks
public/shelf/              the graded offline shelf (generated, committed)
public/curriculum/         the taught course (generated, committed)
public/course/             frequency-graded readings (generated, committed)
public/browse/             the Ben-Yehuda writer directory (generated, committed)
scripts/build-shelf.mjs    regenerates the shelf from the Ben-Yehuda dump
scripts/build-course.mjs   regenerates the graded readings from the dump
scripts/build-curriculum.mjs  expands the syllabus into lessons and exercises
scripts/check-curriculum.mjs  ids, packs, repeated words, drills with no data behind them
scripts/curriculum/        the syllabus — six levels, hand-authored
scripts/build-authors.mjs  regenerates the writer directory from the same dump
scripts/build-course-english.mjs  English names and titles for the course
src/titles.js              English for Hebrew titles — batched, cached, optional
scripts/lib/ask.mjs        shared Claude/OpenAI helper for the build scripts
art/hoopoe-icon.png        the app icon, as drawn — every size is rendered from it
art/hoopoe-bird.png        the whole bird, which is the mark in the bar
scripts/build-icons.mjs    renders that bird into the PNGs and the inline favicon
scripts/lib/wikidata.mjs   English author names, shared by the build scripts
src/story.js               the built-in "Lavan" story + hand-written glossary
src/ai.js                  AI tutor calls — Anthropic / OpenAI / Gemini (gloss, deep dive, translate, grammar, nikkud, quiz)
src/srs.js                 Leitner spaced-repetition scheduling
src/cloze.js               fill-in-the-blank exercise builder
src/dict.js                free Wiktionary dictionary lookups (keyless)
src/pdf.js                 PDF import (pdf.js, lazy-loaded; RTL reconstruction)
src/epub.js                EPUB import (fflate)
src/text.js                Hebrew text helpers (nikkud, sentence split, speech)
src/storage.js             IndexedDB store (localStorage fallback + migration)
src/fonts.css              self-hosted webfonts (generated)
scripts/fetch-fonts.mjs    regenerates the font files from Google Fonts
.github/workflows/deploy.yml   GitHub Pages deployment
```

Fonts: [Frank Ruhl Libre](https://fonts.google.com/specimen/Frank+Ruhl+Libre)
and [Rubik](https://fonts.google.com/specimen/Rubik), both under the SIL Open
Font License, self-hosted so the app has no runtime font CDN dependency.
