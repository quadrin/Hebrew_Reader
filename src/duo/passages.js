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
   wall you bounce off, and it is why the early ones are five short lines —
   after eight units of this course you have about 150 words and almost none of
   the glue, no של, no עם, no גם, no בית. What the later ones can say, the
   early ones simply cannot; the constraint is the course's, not a style.

   Units 4 to 40 have one. The alphabet units at the start have no sentences to
   make one out of, and the rest of the path does not have one yet.

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

  21: {
    title: "משהו לאכול",
    titleEn: "Something to eat",
    blurb: "Everything, nothing, and something.",
    names: ["דני", "נועה"],
    lines: [
      { he: "דני רוצה משהו.", en: "Dani wants something." },
      { he: "אין לו כלום.", en: "He has nothing." },
      { who: "נועה", he: "יש לי הכל!", en: "I have everything!" },
      { he: "יש לו תפוח!", en: "He has an apple!" },
      { he: "אף אחד לא עצוב.", en: "Nobody is sad." },
    ],
    questions: [
      { q: "What does Dani have at the start?", opts: ["An apple", "Everything", "Nothing", "A cat"], correct: 2, ev: "אין לו כלום" },
      { q: "What does he end up with?", opts: ["An apple", "Cake", "Coffee", "Still nothing"], correct: 0, ev: "יש לו תפוח" },
    ],
  },

  22: {
    title: "עבודה חדשה",
    titleEn: "A new job",
    blurb: "What everyone does all day.",
    names: ["דני", "נועה"],
    lines: [
      { he: "לנועה יש עבודה חדשה.", en: "Noa has a new job." },
      { he: "העבודה שלה טובה.", en: "Her job is good." },
      { he: "דני מלצר.", en: "Dani is a waiter." },
      { he: "אבא שלו שופט.", en: "His dad is a judge." },
      { he: "הם תלמידים טובים.", en: "They are good students." },
    ],
    questions: [
      { q: "What is Dani's job?", opts: ["A judge", "A waiter", "A soldier", "A model"], correct: 1, ev: "דני מלצר" },
      { q: "Whose job is new?", opts: ["Dani's", "Noa's", "His dad's", "Nobody's"], correct: 1, ev: "לנועה יש עבודה חדשה" },
    ],
  },

  23: {
    title: "כי הוא עובד",
    titleEn: "Because he is working",
    blurb: "Two thoughts in one sentence.",
    names: ["דני", "נועה"],
    lines: [
      { he: "דני עובד במסעדה.", en: "Dani works at the restaurant." },
      { he: "נועה יודעת שהוא עובד.", en: "Noa knows that he is working." },
      { he: "הוא עובד אבל הוא גם אוהב חיות.", en: "He works, but he also loves animals." },
      { he: "אפילו הכלב אוהב את המסעדה.", en: "Even the dog loves the restaurant." },
      { he: "הוא לא אוכל כי הוא עדיין עובד.", en: "He isn't eating, because he is still working." },
    ],
    questions: [
      { q: "Why isn't Dani eating?", opts: ["He isn't hungry", "He is still working", "The food is bad", "He already ate"], correct: 1, ev: "כי הוא עדיין עובד" },
      { q: "Who else likes the restaurant?", opts: ["Noa", "The cat", "The dog", "Nobody"], correct: 2, ev: "אפילו הכלב אוהב את המסעדה" },
    ],
  },

  24: {
    title: "בחוץ ובפנים",
    titleEn: "Outside and inside",
    blurb: "Where everyone has ended up.",
    names: ["דני", "נועה"],
    lines: [
      { he: "הכלב יושב בחוץ.", en: "The dog is sitting outside." },
      { he: "בחוץ קר.", en: "It is cold outside." },
      { he: "החתול בפנים.", en: "The cat is inside." },
      { he: "דני יושב מאחורי המסעדה.", en: "Dani is sitting behind the restaurant." },
      { he: "אחרי העבודה הם חוזרים.", en: "After work they come back." },
    ],
    questions: [
      { q: "Which animal is inside?", opts: ["The dog", "The cat", "Both", "Neither"], correct: 1, ev: "החתול בפנים" },
      { q: "Where is Dani sitting?", opts: ["Inside", "Behind the restaurant", "Next to the cat", "At home"], correct: 1, ev: "דני יושב מאחורי המסעדה" },
    ],
  },

  25: {
    title: "שמלתה",
    titleEn: "Her dress",
    blurb: "Whose, said the short way.",
    names: ["דני", "נועה"],
    lines: [
      { he: "נועה לובשת את שמלתה.", en: "Noa is wearing her dress." },
      { he: "השמלה הלבנה יפה.", en: "The white dress is nice." },
      { he: "כלביה רצים אליה.", en: "Her dogs run to her." },
      { he: "ילדתי אוהבת את הכלבה.", en: "My girl loves the dog." },
      { he: "העבודה שלה טובה.", en: "Her job is good." },
    ],
    questions: [
      { q: "What colour is the dress?", opts: ["Orange", "Green", "White", "Blue"], correct: 2, ev: "השמלה הלבנה" },
      { q: "What do her dogs do?", opts: ["Sleep", "Bark", "Run to her", "Eat"], correct: 2, ev: "כלביה רצים אליה" },
    ],
  },

  26: {
    title: "מחפש את החתול",
    titleEn: "Looking for the cat",
    blurb: "The cat has gone somewhere again.",
    names: ["דני", "נועה"],
    lines: [
      { he: "דני מחפש את החתול.", en: "Dani is looking for the cat." },
      { he: "הוא חושב שהוא בחוץ.", en: "He thinks it is outside." },
      { he: "החתול מטפס.", en: "The cat is climbing." },
      { he: "נועה מסדרת את האוכל.", en: "Noa is arranging the food." },
      { he: "הכל בסדר.", en: "Everything is fine." },
    ],
    questions: [
      { q: "What is Dani doing?", opts: ["Eating", "Working", "Looking for the cat", "Climbing"], correct: 2, ev: "דני מחפש את החתול" },
      { q: "Where does he think the cat is?", opts: ["Inside", "Outside", "At the restaurant", "With Noa"], correct: 1, ev: "הוא חושב שהוא בחוץ" },
    ],
  },

  27: {
    title: "יום ראשון",
    titleEn: "Sunday",
    blurb: "A week, with times in it.",
    names: ["דני", "נועה"],
    lines: [
      { he: "היום יום ראשון.", en: "Today is Sunday." },
      { he: "הערב דני עובד.", en: "This evening Dani is working." },
      { he: "הוא עובד בשעה שש.", en: "He works at six o'clock." },
      { he: "בשבת הם נחים.", en: "On Saturday they rest." },
      { he: "יש לנו קצת זמן.", en: "We have a little time." },
      { he: "יום ההולדת של נועה בנובמבר.", en: "Noa's birthday is in November." },
    ],
    questions: [
      { q: "What time does Dani work?", opts: ["At six", "At noon", "At midnight", "It doesn't say"], correct: 0, ev: "בשעה שש" },
      { q: "When is Noa's birthday?", opts: ["In January", "In May", "In November", "On Saturday"], correct: 2, ev: "בנובמבר" },
    ],
  },

  28: {
    title: "קפה חזק",
    titleEn: "Strong coffee",
    blurb: "An ordinary day, described properly.",
    names: ["דני", "נועה"],
    lines: [
      { he: "הקפה חזק.", en: "The coffee is strong." },
      { he: "דני נחמד.", en: "Dani is nice." },
      { he: "הוא לא עשיר, אבל הוא שמח.", en: "He is not rich, but he is happy." },
      { he: "זה יום רגיל.", en: "It is an ordinary day." },
      { he: "החתול שלו מיוחד.", en: "His cat is special." },
    ],
    questions: [
      { q: "Is Dani rich?", opts: ["Yes", "No, but he is happy", "The passage doesn't say", "No, and he is sad"], correct: 1, ev: "הוא לא עשיר, אבל הוא שמח" },
      { q: "How is the coffee described?", opts: ["Weak", "Cheap", "Strong", "Cold"], correct: 2, ev: "הקפה חזק" },
    ],
  },

  29: {
    title: "תמיד בערב",
    titleEn: "Always in the evening",
    blurb: "How, and how often.",
    names: ["דני", "נועה"],
    lines: [
      { he: "דני תמיד עובד בערב.", en: "Dani always works in the evening." },
      { he: "הוא כמעט לא אוכל.", en: "He almost doesn't eat." },
      { he: "נועה אוכלת לאט.", en: "Noa eats slowly." },
      { he: "הכלב באמת שמח.", en: "The dog is really happy." },
      { he: "אחר כך הם חוזרים.", en: "Afterwards they come back." },
    ],
    questions: [
      { q: "How often does Dani work in the evening?", opts: ["Never", "Sometimes", "Always", "Barely"], correct: 2, ev: "דני תמיד עובד בערב" },
      { q: "How does Noa eat?", opts: ["Quickly", "Slowly", "Alone", "Barely"], correct: 1, ev: "נועה אוכלת לאט" },
    ],
  },

  30: {
    title: "המשפחה",
    titleEn: "The family",
    blurb: "Everybody at one table.",
    names: ["דני", "נועה"],
    lines: [
      { he: "לנועה יש שני אחים גדולים.", en: "Noa has two big brothers." },
      { he: "הסבתא שלה אוכלת איתם.", en: "Her grandma eats with them." },
      { he: "דני הוא בן דוד שלה.", en: "Dani is her cousin." },
      { he: "המשפחה כבר אוכלת.", en: "The family is already eating." },
      { he: "האוכל טעים!", en: "The food is tasty!" },
    ],
    questions: [
      { q: "How many brothers does Noa have?", opts: ["One", "Two", "Three", "None"], correct: 1, ev: "שני אחים גדולים" },
      { q: "Who is Dani to Noa?", opts: ["Her brother", "Her husband", "Her cousin", "Her grandson"], correct: 2, ev: "דני הוא בן דוד שלה" },
    ],
  },

  31: {
    title: "הדירה",
    titleEn: "The flat",
    blurb: "A tour of the place they live.",
    names: ["דני", "נועה"],
    lines: [
      { he: "הדירה של נועה קטנה.", en: "Noa's flat is small." },
      { he: "יש חדר שינה וחדר אוכל.", en: "There is a bedroom and a dining room." },
      { he: "המפתח על השולחן.", en: "The key is on the table." },
      { he: "השכנה מנקה את המדרגות.", en: "The neighbour is cleaning the stairs." },
      { he: "החתול על הגג!", en: "The cat is on the roof!" },
    ],
    questions: [
      { q: "Where is the key?", opts: ["In the bedroom", "On the table", "With the neighbour", "On the roof"], correct: 1, ev: "המפתח על השולחן" },
      { q: "Where has the cat got to?", opts: ["The stairs", "The dining room", "The roof", "The flat next door"], correct: 2, ev: "החתול על הגג" },
    ],
  },

  32: {
    title: "עוגת שוקולד",
    titleEn: "Chocolate cake",
    blurb: "Two nouns stuck together, all through lunch.",
    names: ["דני", "נועה"],
    lines: [
      { he: "נועה אוהבת עוגת שוקולד.", en: "Noa loves chocolate cake." },
      { he: "דני שותה מיץ תפוזים.", en: "Dani drinks orange juice." },
      { he: "על השולחן יש בקבוק מים.", en: "There is a bottle of water on the table." },
      { he: "הארוחות במסעדה מצוינות.", en: "The meals at the restaurant are excellent." },
      { he: "בתי הקפה טובים.", en: "The coffee shops are good." },
    ],
    questions: [
      { q: "What does Dani drink?", opts: ["Water", "Orange juice", "Wine", "Coffee"], correct: 1, ev: "דני שותה מיץ תפוזים" },
      { q: "What is said about the restaurant's meals?", opts: ["They are cheap", "They are excellent", "They are small", "They are spicy"], correct: 1, ev: "הארוחות במסעדה מצוינות" },
    ],
  },

  33: {
    title: "מה כולם רוצים",
    titleEn: "What everyone wants",
    blurb: "Wanting to do, rather than doing.",
    names: ["דני", "נועה"],
    lines: [
      { he: "דני רוצה לחזור.", en: "Dani wants to go back." },
      { he: "הוא צריך לעבוד.", en: "He has to work." },
      { he: "נועה רוצה לבשל.", en: "Noa wants to cook." },
      { he: "החתול רוצה לישון.", en: "The cat wants to sleep." },
      { he: "הכלב רוצה לרוץ ולשחק.", en: "The dog wants to run and play." },
    ],
    questions: [
      { q: "What does the cat want?", opts: ["To play", "To eat", "To sleep", "To go out"], correct: 2, ev: "החתול רוצה לישון" },
      { q: "What does Dani have to do?", opts: ["Cook", "Work", "Sleep", "Run"], correct: 1, ev: "הוא צריך לעבוד" },
    ],
  },

  34: {
    title: "יורד גשם",
    titleEn: "It's raining",
    blurb: "A day nobody wants to go out in.",
    names: ["דני", "נועה"],
    lines: [
      { he: "היום מעונן.", en: "Today is cloudy." },
      { he: "יורד גשם בחוץ.", en: "It is raining outside." },
      { he: "הכלב בפנים עכשיו.", en: "The dog is inside now." },
      { he: "הטמפרטורה עשרים מעלות.", en: "The temperature is twenty degrees." },
      { he: "השמש לא חזקה היום.", en: "The sun is not strong today." },
    ],
    questions: [
      { q: "What is the weather doing?", opts: ["Snowing", "Raining", "Very sunny", "Foggy"], correct: 1, ev: "יורד גשם בחוץ" },
      { q: "What is the temperature?", opts: ["Ten degrees", "Twenty degrees", "Thirty degrees", "It doesn't say"], correct: 1, ev: "עשרים מעלות" },
    ],
  },

  35: {
    title: "קרוב לחוף",
    titleEn: "Near the beach",
    blurb: "Where everything is, from here.",
    names: ["דני", "נועה"],
    lines: [
      { he: "דני גר ברחוב קרוב לחוף.", en: "Dani lives on a street near the beach." },
      { he: "הפארק חמש דקות מפה.", en: "The park is five minutes from here." },
      { he: "הילדים משחקים בפארק.", en: "The children play in the park." },
      { he: "גן החיות מעניין.", en: "The zoo is interesting." },
      { he: "אחר כך הם חוזרים הביתה.", en: "Afterwards they go home." },
    ],
    questions: [
      { q: "How far is the park?", opts: ["Five minutes", "Twenty minutes", "Next door", "It doesn't say"], correct: 0, ev: "חמש דקות מפה" },
      { q: "What is Dani's street near?", opts: ["The zoo", "The park", "The beach", "A bank"], correct: 2, ev: "קרוב לחוף" },
    ],
  },

  36: {
    title: "מוסיף סוכר",
    titleEn: "Adding sugar",
    blurb: "A shift at the restaurant, and a dinner invitation.",
    names: ["דני", "נועה"],
    lines: [
      { he: "דני מגיש את האוכל.", en: "Dani serves the food." },
      { he: "הוא מוסיף סוכר לקפה.", en: "He adds sugar to the coffee." },
      { he: "הוא מזמין את ההורים שלה.", en: "He invites her parents." },
      { he: "היא מבינה עברית.", en: "She understands Hebrew." },
      { he: "הוא מעדיף לבשל במטבח.", en: "He prefers to cook in the kitchen." },
    ],
    questions: [
      { q: "What does Dani add to the coffee?", opts: ["Milk", "Sugar", "Nothing", "Honey"], correct: 1, ev: "הוא מוסיף סוכר לקפה" },
      { q: "Who does he invite?", opts: ["His parents", "Her parents", "The neighbour", "Nobody"], correct: 1, ev: "הוא מזמין את ההורים שלה" },
    ],
  },

  37: {
    title: "החבר שלה",
    titleEn: "Her boyfriend",
    blurb: "Who everybody is to everybody else.",
    names: ["דני", "נועה"],
    lines: [
      { he: "דני ונועה זוג.", en: "Dani and Noa are a couple." },
      { he: "הוא החבר שלה.", en: "He is her boyfriend." },
      { he: "יש להם חבר ישראלי.", en: "They have an Israeli friend." },
      { he: "הבחור הזה אנגלי.", en: "That guy is English." },
      { he: "הוא בן אדם נחמד.", en: "He is a nice person." },
    ],
    questions: [
      { q: "What is Dani to Noa here?", opts: ["Her cousin", "Her boyfriend", "Her neighbour", "Her brother"], correct: 1, ev: "הוא החבר שלה" },
      { q: "Where is the guy from?", opts: ["Israel", "France", "England", "Australia"], correct: 2, ev: "הבחור הזה אנגלי" },
    ],
  },

  38: {
    title: "שלושים כיסאות",
    titleEn: "Thirty chairs",
    blurb: "Counting up the restaurant.",
    names: ["דני", "נועה"],
    lines: [
      { he: "במסעדה יש שלושים כיסאות.", en: "There are thirty chairs in the restaurant." },
      { he: "ויש עשרים שולחנות.", en: "And there are twenty tables." },
      { he: "זה היום הראשון של נועה.", en: "It is Noa's first day." },
      { he: "היא עובדת חמישים דקות.", en: "She works for fifty minutes." },
      { he: "יש לה פחות זמן היום.", en: "She has less time today." },
    ],
    questions: [
      { q: "How many chairs are there?", opts: ["Twenty", "Thirty", "Fifty", "A hundred"], correct: 1, ev: "שלושים כיסאות" },
      { q: "What day is it for Noa?", opts: ["Her last day", "Her first day", "Her birthday", "A day off"], correct: 1, ev: "היום הראשון של נועה" },
    ],
  },

  39: {
    title: "מחר",
    titleEn: "Tomorrow",
    blurb: "What can, must and might happen.",
    names: ["דני", "נועה"],
    lines: [
      { he: "מחר יום שישי.", en: "Tomorrow is Friday." },
      { he: "דני יכול לבקר בירושלים.", en: "Dani can visit Jerusalem." },
      { he: "נועה אמורה לבוא.", en: "Noa is supposed to come." },
      { he: "בשבת אפשר לישון.", en: "On Saturday you can sleep in." },
      { he: "מומלץ לבוא מחר.", en: "It is recommended to come tomorrow." },
    ],
    questions: [
      { q: "What day is tomorrow?", opts: ["Saturday", "Sunday", "Friday", "Monday"], correct: 2, ev: "מחר יום שישי" },
      { q: "Where can Dani visit?", opts: ["The beach", "Jerusalem", "The zoo", "The restaurant"], correct: 1, ev: "לבקר בירושלים" },
    ],
  },

  40: {
    title: "הפרק הראשון",
    titleEn: "The first chapter",
    blurb: "Noa starts studying, which is where you came in.",
    names: ["דני", "נועה"],
    lines: [
      { he: "נועה קוראת את הפרק הראשון.", en: "Noa is reading the first chapter." },
      { he: "יש לה קורס חדש.", en: "She has a new course." },
      { he: "היא צריכה לתרגל עברית.", en: "She needs to practise Hebrew." },
      { he: "ההסבר בעמוד הזה טוב.", en: "The explanation on this page is good." },
      { he: "דני מביא לה עט.", en: "Dani brings her a pen." },
    ],
    questions: [
      { q: "What is Noa reading?", opts: ["A newspaper", "The first chapter", "A presentation", "A map"], correct: 1, ev: "נועה קוראת את הפרק הראשון" },
      { q: "What does Dani bring her?", opts: ["Coffee", "A book", "A pen", "Cake"], correct: 2, ev: "דני מביא לה עט" },
    ],
  },
};

/* The units that close with a passage, in path order. Not every unit has one:
   the three alphabet units at the start have no sentences to make one out of. */
export const PASSAGE_UNITS = Object.keys(PASSAGES).map(Number).sort((a, b) => a - b);

export const passageFor = (unit) => PASSAGES[unit] || null;
