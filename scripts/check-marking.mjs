/* Is a right answer marked right?

   The course ships one English translation per sentence and anything else is
   red, which is the single most dispiriting thing a language app can do: the
   learner reads the Hebrew, understands it, writes it down in English, and is
   told they are wrong because they wrote "I bring" where the course wrote "I
   am bringing". Hebrew has one present tense and English has two, so half the
   course's sentences have a second right answer nobody typed.

   The marker's tolerances are listed here as sentences rather than as rules,
   because that is how they fail: not as a broken function but as one more
   fair answer nobody thought of. The other half of the file is the answers
   that must stay wrong — the tolerance that accepts everything teaches
   nothing.

   Run: npm run check:marking
*/

import { normEn, sameAnswer } from "../src/duo/exercises.js";
import { EN_SYNONYMS } from "../src/duo/synonyms.js";

const marks = (given, want) => sameAnswer(normEn(given), normEn(want), "en");

/* Answers a person would be right to be annoyed about losing. */
const ACCEPT = [
  /* Hebrew's one present tense against English's two, both ways round */
  ["I bring the toolbox from the office", "I am bringing the toolbox from the office."],
  ["I am bringing the toolbox from the office", "I bring the toolbox from the office."],
  ["He eats bread every morning", "He is eating bread every morning."],
  ["She is singing a song", "She sings a song."],
  ["The child is drinking water", "The child drinks water."],
  ["We are eating in the garden", "We eat in the garden."],
  ["It goes to the sea", "It is going to the sea."],
  ["He is running in the park", "He runs in the park."],
  ["She is making food", "She makes food."],
  ["The woman studies at the university", "The woman is studying at the university."],

  /* contractions, whichever side does the contracting */
  ["This is not brainwashing it is education", "This isn't brainwashing, it's education!"],
  ["This isn't brainwashing, it's education", "This is not brainwashing, it is education!"],
  ["I am a teacher and she is a doctor", "I'm a teacher and she's a doctor."],
  ["They do not have a car", "They don't have a car."],
  ["We will not go there", "We won't go there."],
  ["You have not eaten", "You haven't eaten."],

  /* the apostrophe a phone actually types */
  ["This isn’t brainwashing, it’s education", "This isn't brainwashing, it's education!"],
  ["I’m going home", "I am going home."],

  /* a symbol is the word written short, and the course always writes the word */
  ["The body is 90% water", "The body is ninety percent water."],
  ["There is a 20% discount", "There's a twenty percent discount."],
  ["It is 30° outside", "It is thirty degrees outside."],
  ["It costs 50₪", "It costs fifty shekels."],
  ["mom & dad are here", "mom and dad are here"],

  /* and so is an ordinal */
  ["the 1st day of the year", "the first day of the year"],
  ["the 21st of May", "the twenty-first of May"],

  /* a word written short is the same word */
  ["Congrats on the new apartment!", "Congratulations on the new apartment!"],
  ["I am watching the TV", "I am watching the television."],
  ["He is talking on the phone", "He is talking on the telephone."],
  ["She has an exam tomorrow", "She has an examination tomorrow."],
  ["The ad is on the television", "The advertisement is on the TV."],
  ["He studies math at the uni", "He studies mathematics at the university."],
  ["Put the milk in the fridge", "Put the milk in the refrigerator."],
  ["It is 5 km from here", "It is five kilometers from here."],
  ["Ok, I am coming", "Okay, I am coming!"],
  ["I am going to the shop", "I am going to the store."],
  ["We play football on Saturday", "We play soccer on Saturday."],

  /* what the marker already forgave, which has to keep working */
  ["the woman is beautiful", "The woman is pretty."],
  ["I have 63 millimeters", "I have sixty-three millimeters."],
  ["the dog is big", "The dog is large!"],
];

/* Answers that are a different sentence, however close they look.

   The spelling budget this list is drawn around is the one the marker already
   had: a long sentence may be three edits out and still count, so a short word
   swapped for another short word — "to the office" for "from the office" — is
   not caught here and never was. That is the price of forgiving a typo without
   a dictionary, and it is not what this file changed. */
const REJECT = [
  ["I bring the toolbox from the kitchen", "I am bringing the toolbox from the office."],
  ["I ate bread", "I am eating bread."],
  ["I will eat bread", "I am eating bread."],
  ["This is brainwashing, it is not education", "This isn't brainwashing, it's education!"],
  ["the cat is big", "The dog is big."],
  ["I have 62 millimeters", "I have sixty-three millimeters."],
  ["the woman is tired", "The woman is pretty."],
  ["he is not eating", "he is eating"],
  ["The body is 80% water", "The body is ninety percent water."],
  ["the 2nd day of the year", "the first day of the year"],
  ["It is 6 km from here", "It is five kilometers from here."],
  ["I am watching the radio", "I am watching the television."],
];

const problems = [];

/* The synonym groups are written as disjoint on purpose — a word in two of
   them silently takes the second one's head, and a chain of overlapping groups
   ends up accepting "spicy" for "warm". Nothing says so at run time, so it is
   said here. */
const head = new Map();
for (const group of EN_SYNONYMS) {
  for (const word of group) {
    if (head.has(word)) problems.push(`"${word}" is in two synonym groups: ${head.get(word)} and ${group[0]}`);
    head.set(word, group[0]);
  }
}

for (const [given, want] of ACCEPT) {
  if (!marks(given, want)) problems.push(`marked wrong, and is not: ${JSON.stringify(given)} for ${JSON.stringify(want)}`);
}
for (const [given, want] of REJECT) {
  if (marks(given, want)) problems.push(`marked right, and is not: ${JSON.stringify(given)} for ${JSON.stringify(want)}`);
}

console.log(`checked ${ACCEPT.length} answers that have to be accepted and ${REJECT.length} that have to be refused`);
console.log(`  over ${EN_SYNONYMS.length} synonym groups, ${head.size} words`);
if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log("no problems");
