/* Unit-closing passages — something connected to read, at the end of a unit.

   The course teaches in sentences, and a sentence is not what language is. You
   can answer a thousand of them and still never have read a paragraph, because
   nothing in a lesson ever refers back to anything: every item is a new world
   with a new cast, and the skill that carries a reader — holding onto who
   "he" is across two lines — is the one skill the format cannot practise.

   So a unit ends with a text. Same characters throughout: Dani and Noa, and
   the white cat from the reader's own story, so that finishing the path is
   reading one thing rather than ninety unrelated ones.

   The constraint is the whole point, and it is checked rather than trusted:
   every passage must be at least 95% built from words its own unit and the
   ones before it have taught, measured by `npm run check:passages` against the
   course's real data. That is what makes it a text you can read instead of a
   wall you bounce off, and it is why the early ones are four lines long — after
   eight units of this course you have about 150 words and almost none of the
   glue, no של, no עם, no גם. The passages grow because the vocabulary does.

   No nikkud, which is what the path's own sentences do and what the learner
   has been reading all through it.

   A line may name a speaker (`who`), which makes the passage a conversation
   rather than prose; the early units have far more to say as dialogue than as
   narration, since greeting someone is the first thing they can actually do.
*/

export const PASSAGES = {
  4: {
    title: "שלום",
    titleEn: "Hello",
    blurb: "Two people meet.",
    names: ["דני", "נועה"],
    lines: [
      { who: "נועה", he: "שלום! מה נשמע?", en: "Hello! How's it going?" },
      { who: "דני", he: "בסדר, תודה. מה שלומך?", en: "Fine, thanks. How are you?" },
      { who: "נועה", he: "טוב, תודה רבה. אני נועה.", en: "Good, thank you very much. I'm Noa." },
      { who: "דני", he: "אני דני. להתראות, נועה!", en: "I'm Dani. Goodbye, Noa!" },
      { who: "נועה", he: "להתראות!", en: "Goodbye!" },
    ],
    questions: [
      { q: "How does Dani answer “how's it going?”", opts: ["Goodbye", "Fine, thanks", "Sorry", "Good luck"], correct: 1, ev: "בסדר, תודה" },
      { q: "Who says their name first?", opts: ["Noa", "Dani", "Neither of them", "Both at once"], correct: 0, ev: "אני נועה" },
    ],
  },

  5: {
    title: "מי זה?",
    titleEn: "Who is this?",
    blurb: "Naming the people you have just met.",
    names: ["דני", "נועה"],
    lines: [
      { he: "זה דני. הוא ילד.", en: "This is Dani. He is a boy." },
      { he: "זאת נועה. היא ילדה.", en: "This is Noa. She is a girl." },
      { he: "הם ילדים.", en: "They are children." },
      { he: "האישה היא אמא.", en: "The woman is a mom." },
      { he: "הגבר הוא אבא.", en: "The man is a dad." },
    ],
    questions: [
      { q: "What does the passage say Noa is?", opts: ["A woman", "A mom", "A girl", "A man"], correct: 2, ev: "היא ילדה" },
      { q: "Together, Dani and Noa are called:", opts: ["men", "children", "women", "dads"], correct: 1, ev: "הם ילדים" },
    ],
  },

  6: {
    title: "יש לו כלב",
    titleEn: "He has a dog",
    blurb: "What Dani has, and what he doesn't.",
    names: ["דני", "נועה"],
    lines: [
      { he: "לדני יש כלב.", en: "Dani has a dog." },
      { he: "הכלב אוכל לחם.", en: "The dog is eating bread." },
      { he: "אין לו מים.", en: "He doesn't have water." },
      { he: "יש לנו מים!", en: "We have water!" },
      { he: "הכלב שותה מים.", en: "The dog is drinking water." },
    ],
    questions: [
      { q: "What is the dog eating?", opts: ["Rice", "Bread", "An apple", "Nothing"], correct: 1, ev: "הכלב אוכל לחם" },
      { q: "What does the dog not have at first?", opts: ["Water", "Bread", "A name", "Milk"], correct: 0, ev: "אין לו מים" },
    ],
  },

  7: {
    title: "הכלב שמח",
    titleEn: "The dog is happy",
    blurb: "Saying what everyone is like.",
    names: ["דני", "נועה"],
    lines: [
      { he: "הכלב שמח.", en: "The dog is happy." },
      { he: "נועה שמחה.", en: "Noa is happy." },
      { he: "דני לא עצוב.", en: "Dani is not sad." },
      { he: "הכלב טוב. הוא לא רע.", en: "The dog is good. He is not bad." },
      { he: "האוכל טעים!", en: "The food is tasty!" },
    ],
    questions: [
      { q: "How is Dani feeling?", opts: ["Sad", "Not sad", "Bad", "The passage doesn't say"], correct: 1, ev: "דני לא עצוב" },
      { q: "What does the passage say about the dog?", opts: ["It is bad", "It is sad", "It is good", "It is hungry"], correct: 2, ev: "הכלב טוב" },
    ],
  },

  8: {
    title: "ארוחת בוקר",
    titleEn: "Breakfast",
    blurb: "The first meal of the path.",
    names: ["דני", "נועה"],
    lines: [
      { he: "דני רוצה ארוחת בוקר.", en: "Dani wants breakfast." },
      { he: "הוא אוכל לחם ותפוח.", en: "He is eating bread and an apple." },
      { he: "התפוח מתוק.", en: "The apple is sweet." },
      { he: "נועה שותה קפה.", en: "Noa is drinking coffee." },
      { he: "היא רוצה עוגה!", en: "She wants cake!" },
      { he: "בתיאבון!", en: "Bon appetit!" },
    ],
    questions: [
      { q: "What is Dani eating?", opts: ["Cake and coffee", "Bread and an apple", "Rice and fish", "Only bread"], correct: 1, ev: "הוא אוכל לחם ותפוח" },
      { q: "What does Noa want?", opts: ["Cake", "An apple", "Bread", "Water"], correct: 0, ev: "היא רוצה עוגה" },
      { q: "How is the apple described?", opts: ["Sour", "Sweet", "Bad", "Big"], correct: 1, ev: "התפוח מתוק" },
    ],
  },

  9: {
    title: "החתול",
    titleEn: "The cat",
    blurb: "A second animal moves in.",
    names: ["דני", "נועה"],
    lines: [
      { he: "לדני יש כלב וחתול.", en: "Dani has a dog and a cat." },
      { he: "הכלב נובח.", en: "The dog barks." },
      { he: "החתול לא נובח.", en: "The cat does not bark." },
      { he: "לחתול יש זנב.", en: "The cat has a tail." },
      { he: "החתול שותה חלב.", en: "The cat drinks milk." },
    ],
    questions: [
      { q: "Which of Dani's animals does not bark?", opts: ["The dog", "The cat", "Both of them", "Neither of them"], correct: 1, ev: "החתול לא נובח" },
      { q: "What does the cat drink?", opts: ["Water", "Juice", "Milk", "Coffee"], correct: 2, ev: "החתול שותה חלב" },
    ],
  },

  10: {
    title: "ספרים ועיתונים",
    titleEn: "Books and newspapers",
    blurb: "More than one of everything.",
    names: ["דני", "נועה"],
    lines: [
      { he: "לדני יש ספרים.", en: "Dani has books." },
      { he: "הספרים יפים.", en: "The books are nice." },
      { he: "נועה קוראת עיתונים.", en: "Noa reads newspapers." },
      { he: "יש להם חתולים.", en: "They have cats." },
      { he: "החתולים שותים חלב.", en: "The cats drink milk." },
      { he: "התפוחים טעימים.", en: "The apples are tasty." },
    ],
    questions: [
      { q: "What does Noa read?", opts: ["Books", "Newspapers", "Nothing", "Both books and newspapers"], correct: 1, ev: "נועה קוראת עיתונים" },
      { q: "What is said about the apples?", opts: ["They are tasty", "They are sour", "There are none", "They are nice"], correct: 0, ev: "התפוחים טעימים" },
    ],
  },

  11: {
    title: "החתול שלה",
    titleEn: "Her cat",
    blurb: "Saying whose is whose.",
    names: ["דני", "נועה"],
    lines: [
      { he: "זה הכלב שלי.", en: "This is my dog." },
      { he: "וזה החתול שלה.", en: "And this is her cat." },
      { he: "הספרים שלנו יפים.", en: "Our books are nice." },
      { he: "האוכל שלהם טעים.", en: "Their food is tasty." },
      { he: "החתול של נועה אוכל דג.", en: "Noa's cat eats fish." },
    ],
    questions: [
      { q: "Whose cat is it?", opts: ["Dani's", "Noa's", "Nobody's", "Theirs"], correct: 1, ev: "החתול של נועה" },
      { q: "What does the cat eat here?", opts: ["Milk", "Bread", "Fish", "An apple"], correct: 2, ev: "אוכל דג" },
    ],
  },

  12: {
    title: "הדרך ארוכה",
    titleEn: "The road is long",
    blurb: "What things are like, and where.",
    names: ["דני", "נועה"],
    lines: [
      { he: "הדרך ארוכה.", en: "The road is long." },
      { he: "המשאית גבוהה.", en: "The truck is tall." },
      { he: "החלב קר.", en: "The milk is cold." },
      { he: "הכלב רטוב!", en: "The dog is wet!" },
      { he: "החתול יבש.", en: "The cat is dry." },
    ],
    questions: [
      { q: "Which animal is wet?", opts: ["The cat", "The dog", "Both", "Neither"], correct: 1, ev: "הכלב רטוב" },
      { q: "How is the milk described?", opts: ["Hot", "Sweet", "Cold", "Empty"], correct: 2, ev: "החלב קר" },
    ],
  },

  13: {
    title: "היא אוהבת אותו",
    titleEn: "She loves him",
    blurb: "Saying who, without saying the name again.",
    names: ["דני", "נועה"],
    lines: [
      { he: "נועה רואה את החתול.", en: "Noa sees the cat." },
      { he: "היא אוהבת אותו.", en: "She loves him." },
      { he: "דני רואה את נועה.", en: "Dani sees Noa." },
      { he: "הוא רואה אותה.", en: "He sees her." },
      { he: "אנחנו צריכים אותם.", en: "We need them." },
      { he: "הם רואים אותנו.", en: "They see us." },
    ],
    questions: [
      { q: "In line two, who does “him” mean?", opts: ["Dani", "The cat", "The dog", "Noa"], correct: 1, ev: "היא אוהבת אותו" },
      { q: "Who does Dani see?", opts: ["The cat", "The dog", "Noa", "Nobody"], correct: 2, ev: "דני רואה את נועה" },
    ],
  },

  14: {
    title: "במסעדה",
    titleEn: "At the restaurant",
    blurb: "Ordering, and getting what you need.",
    names: ["דני", "נועה"],
    lines: [
      { who: "דני", he: "סליחה, אני רוצה מיץ.", en: "Excuse me, I'd like juice." },
      { who: "דני", he: "יש לכם עוגיות?", en: "Do you have cookies?" },
      { he: "דני צריך סכין ומפית.", en: "Dani needs a knife and a napkin." },
      { he: "המרק חריף.", en: "The soup is spicy." },
      { who: "נועה", he: "אני רוצה סלט.", en: "I'd like a salad." },
      { he: "בתיאבון!", en: "Bon appetit!" },
    ],
    questions: [
      { q: "What does Dani ask for first?", opts: ["A salad", "Juice", "Soup", "A knife"], correct: 1, ev: "אני רוצה מיץ" },
      { q: "What is said about the soup?", opts: ["It is cold", "It is sweet", "It is spicy", "It is salty"], correct: 2, ev: "המרק חריף" },
    ],
  },

  15: {
    title: "הכובע שלו",
    titleEn: "His hat",
    blurb: "What everyone is wearing.",
    names: ["דני", "נועה"],
    lines: [
      { he: "לדני יש כובע ומעיל.", en: "Dani has a hat and a coat." },
      { he: "הכובע שלו יפה.", en: "His hat is nice." },
      { he: "נועה צריכה משקפיים.", en: "Noa needs glasses." },
      { he: "יש לה שרשרת וצמיד.", en: "She has a necklace and a bracelet." },
      { he: "החולצה שלה יפה.", en: "Her shirt is nice." },
    ],
    questions: [
      { q: "What does Noa need?", opts: ["A hat", "A coat", "Glasses", "A shirt"], correct: 2, ev: "נועה צריכה משקפיים" },
      { q: "Whose hat is called nice?", opts: ["Dani's", "Noa's", "The cat's", "Nobody's"], correct: 0, ev: "הכובע שלו יפה" },
    ],
  },

  16: {
    title: "נועה כותבת",
    titleEn: "Noa is writing",
    blurb: "Everybody doing something, right now.",
    names: ["דני", "נועה"],
    lines: [
      { he: "נועה כותבת ספר.", en: "Noa is writing a book." },
      { he: "דני אומר: הספר שלה יפה!", en: "Dani says: her book is nice!" },
      { he: "הוא נותן לה עיתון.", en: "He gives her a newspaper." },
      { he: "הילדים חוזרים.", en: "The children are coming back." },
      { he: "הציפורים שרות.", en: "The birds are singing." },
    ],
    questions: [
      { q: "What is Noa writing?", opts: ["A newspaper", "A book", "A letter", "Nothing"], correct: 1, ev: "נועה כותבת ספר" },
      { q: "What does Dani give her?", opts: ["A book", "A newspaper", "A hat", "Coffee"], correct: 1, ev: "הוא נותן לה עיתון" },
    ],
  },

  17: {
    title: "כחול וירוק",
    titleEn: "Blue and green",
    blurb: "The same people, in colour.",
    names: ["דני", "נועה"],
    lines: [
      { he: "הכובע של דני כחול.", en: "Dani's hat is blue." },
      { he: "הצעיף שלו ירוק.", en: "His scarf is green." },
      { he: "נועה לובשת מכנסיים.", en: "Noa is wearing pants." },
      { he: "הכובע שלה כתום.", en: "Her hat is orange." },
      { he: "החתול לא צבעוני!", en: "The cat is not colourful!" },
    ],
    questions: [
      { q: "What colour is Dani's hat?", opts: ["Green", "Orange", "Blue", "Yellow"], correct: 2, ev: "הכובע של דני כחול" },
      { q: "Whose hat is orange?", opts: ["Dani's", "Noa's", "The cat's", "Nobody's"], correct: 1, ev: "הכובע שלה כתום" },
    ],
  },

  18: {
    title: "איתנו",
    titleEn: "With us",
    blurb: "Going somewhere, and who comes along.",
    names: ["דני", "נועה"],
    lines: [
      { he: "דני הולך עם נועה.", en: "Dani is going with Noa." },
      { he: "הכלב בא איתנו.", en: "The dog is coming with us." },
      { he: "נועה לומדת עברית.", en: "Noa is learning Hebrew." },
      { he: "דני קונה מיץ בשבילה.", en: "Dani buys juice for her." },
      { he: "היא רוצה ספר ממנו.", en: "She wants a book from him." },
    ],
    questions: [
      { q: "Who does Dani buy juice for?", opts: ["Himself", "Noa", "The dog", "The cat"], correct: 1, ev: "דני קונה מיץ בשבילה" },
      { q: "What is Noa learning?", opts: ["English", "Hebrew", "Nothing", "To cook"], correct: 1, ev: "נועה לומדת עברית" },
    ],
  },

  19: {
    title: "כמה ביצים",
    titleEn: "How many eggs",
    blurb: "Counting what is in the kitchen.",
    names: ["דני", "נועה"],
    lines: [
      { he: "לנועה יש עשר ביצים.", en: "Noa has ten eggs." },
      { he: "היא רוצה חמישה תפוחים.", en: "She wants five apples." },
      { he: "יש לה יותר מדי גזרים!", en: "She has too many carrots!" },
      { he: "לדני יש חתול אחד.", en: "Dani has one cat." },
      { he: "יש לו פחות אוכל.", en: "He has less food." },
    ],
    questions: [
      { q: "How many eggs does Noa have?", opts: ["Five", "One", "Ten", "Too many"], correct: 2, ev: "עשר ביצים" },
      { q: "What does she have too many of?", opts: ["Apples", "Eggs", "Cats", "Carrots"], correct: 3, ev: "יותר מדי גזרים" },
    ],
  },

  20: {
    title: "מי זה?",
    titleEn: "Who is that?",
    blurb: "Asking, at last, instead of only answering.",
    names: ["דני", "נועה"],
    lines: [
      { who: "נועה", he: "מי זה?", en: "Who is that?" },
      { who: "דני", he: "זה החתול שלי.", en: "That's my cat." },
      { who: "נועה", he: "איפה הכלב?", en: "Where is the dog?" },
      { who: "דני", he: "הוא אוכל.", en: "He's eating." },
      { who: "נועה", he: "כמה חתולים יש לךָ?", en: "How many cats do you have?" },
      { who: "דני", he: "אחד!", en: "One!" },
    ],
    questions: [
      { q: "What does Noa ask about the dog?", opts: ["What it eats", "Where it is", "Whose it is", "How many there are"], correct: 1, ev: "איפה הכלב" },
      { q: "How many cats does Dani have?", opts: ["One", "Two", "Ten", "He doesn't say"], correct: 0, ev: "אחד" },
    ],
  },
};

/* The units that close with a passage, in path order. Not every unit has one:
   the three alphabet units at the start have no sentences to make one out of. */
export const PASSAGE_UNITS = Object.keys(PASSAGES).map(Number).sort((a, b) => a - b);

export const passageFor = (unit) => PASSAGES[unit] || null;
