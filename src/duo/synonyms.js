/* Words the course would have accepted if it had thought of them.

   Every sentence ships with one English translation, and anything else is
   marked wrong — so "You see a pretty woman" lost to "You see a beautiful
   woman", though the course itself writes יָפָה as "pretty" seventy-four times
   and as "beautiful" thirty. The AI grader catches this when there is a key
   for it; most of the time there is not, and a learner who typed a perfectly
   good sentence just gets a red bar.

   So the marker knows which English words are the same word. Most of the list
   below was read out of the course's own glosses — every English word the
   course itself uses for one Hebrew word, which is exactly the set a learner
   may pick from — with the obvious junk (its pronoun tables, its conjugation
   labels) taken out and the everyday pairs it happens not to gloss twice put
   in. British and American spellings are here for the same reason.

   The groups are disjoint on purpose: "hot" goes with "warm" and not also
   with "spicy", because a chain of overlapping groups ends up accepting
   "spicy" for "warm". Each group's first word is the one both sides are
   rewritten to; which one it is does not matter, only that it is the same. */

export const EN_SYNONYMS = [
  /* people */
  ["mother", "mom", "mum", "mama"],
  ["father", "dad", "daddy", "papa"],
  ["grandmother", "grandma", "granny"],
  ["grandfather", "grandpa"],
  ["child", "kid"],
  ["daughter", "girl"],
  ["son", "boy"],
  ["woman", "lady", "wife"],
  ["man", "guy"],
  ["student", "pupil"],
  ["doctor", "physician"],
  ["president", "chairman", "leader"],
  ["citizen", "civilian"],
  ["judge", "referee"],
  ["audience", "crowd"],
  ["monkey", "ape"],
  ["chicken", "fowl", "poultry"],
  ["turtle", "tortoise"],

  /* what things are like */
  ["beautiful", "pretty", "lovely", "nice"],
  ["big", "large"],
  ["small", "little"],
  ["fast", "quick", "rapid"],
  ["happy", "glad"],
  ["sad", "unhappy"],
  ["angry", "mad"],
  ["hard", "difficult", "tough"],
  ["easy", "simple"],
  ["smart", "clever", "intelligent"],
  ["sick", "ill"],
  ["hot", "warm"],
  ["cold", "chilly"],
  ["tasty", "delicious", "yummy"],
  ["strange", "unusual", "odd", "peculiar"],
  ["whole", "entire", "complete"],
  ["ordinary", "regular", "normal"],
  ["dangerous", "perilous"],
  ["tall", "high"],
  ["naughty", "cheeky"],
  ["emotional", "sensitive"],
  ["compatible", "suited"],

  /* what people do */
  ["begin", "start"],
  ["finish", "end"],
  ["buy", "purchase"],
  ["speak", "talk"],
  ["study", "learn"],
  ["see", "look"],
  ["hear", "listen"],
  ["help", "assist"],
  ["fix", "repair", "mend"],
  ["build", "construct"],
  ["try", "attempt"],
  ["answer", "reply"],
  ["ask", "request"],
  ["allow", "permit"],
  ["contain", "include"],
  ["remember", "recall"],
  ["tell", "say"],
  ["walk", "go"],
  ["work", "operate", "function"],
  ["love", "like"],
  ["arrive", "reach"],
  ["break", "shatter"],
  ["mix", "stir"],
  ["cut", "chop", "slice"],
  ["ignore", "disregard"],
  ["change", "exchange", "swap"],

  /* things */
  ["house", "home"],
  ["apartment", "flat"],
  ["movie", "film"],
  ["picture", "photo", "photograph", "image"],
  ["story", "tale"],
  ["street", "road"],
  ["car", "automobile"],
  ["taxi", "cab"],
  ["sofa", "couch"],
  ["closet", "cupboard", "wardrobe"],
  ["pants", "trousers"],
  ["candy", "sweets"],
  ["vacation", "holiday"],
  ["trash", "garbage", "rubbish"],
  ["elevator", "lift"],
  ["gift", "present"],
  ["wallet", "purse"],
  ["drink", "beverage"],
  ["pepper", "capsicum"],
  ["hat", "cap"],
  ["coat", "cloak"],
  ["bracelet", "armlet"],
  ["bicycle", "bike"],
  ["pan", "skillet"],
  ["bowl", "dish"],
  ["forest", "woods"],
  ["cave", "cavern"],
  ["fog", "mist"],
  ["glacier", "iceberg"],
  ["salary", "wages"],
  ["speed", "velocity"],
  ["power", "strength"],
  ["danger", "risk"],
  ["feeling", "emotion"],
  ["personality", "character"],
  ["scenery", "landscape", "view"],
  ["path", "way", "route"],
  ["journey", "voyage", "trip"],
  ["phrase", "expression", "idiom"],
  ["choice", "option"],
  ["safety", "security"],
  ["reason", "motive"],
  ["value", "worth"],
  ["majority", "most"],
  ["quality", "trait"],
  ["inn", "motel"],
  ["petrol", "fuel"],
  ["coin", "currency"],
  ["doctorate", "phd"],
  ["period", "season"],
  ["skull", "cranium"],
  ["bush", "shrub"],
  ["string", "wire", "thread"],
  ["stage", "platform"],
  ["field", "pitch", "court"],
  ["tax", "fee"],
  ["sample", "specimen"],
  ["production", "manufacturing"],

  /* how and when */
  ["maybe", "perhaps"],
  ["almost", "nearly"],
  ["certainly", "definitely", "surely"],
  ["recently", "lately"],
  ["mainly", "mostly"],
  ["now", "currently"],
  ["really", "truly"],
  ["also", "too"],
  ["only", "just"],
  ["still", "yet"],
  ["among", "between"],

  /* the same word, spelled on the other side of the Atlantic */
  ["color", "colour"],
  ["colorful", "colourful"],
  ["favorite", "favourite"],
  ["neighbor", "neighbour"],
  ["flavor", "flavour"],
  ["behavior", "behaviour"],
  ["honor", "honour"],
  ["humor", "humour"],
  ["labor", "labour"],
  ["theater", "theatre"],
  ["center", "centre"],
  ["meter", "metre"],
  ["liter", "litre"],
  ["gray", "grey"],
  ["organize", "organise"],
  ["realize", "realise"],
  ["apologize", "apologise"],
  ["recognize", "recognise"],
];

/* word -> the word its group is written as */
const HEAD = new Map();
for (const group of EN_SYNONYMS) for (const member of group) HEAD.set(member, group[0]);

/* Inflection, for the regular cases: the list holds "buy", and a sentence is
   as likely to say "buys" or "buying". An irregular past — "bought" for "buy"
   — is only caught if it is in the list itself, which is why some are. */
const SUFFIXES = ["s", "es", "ed", "d", "ing"];

const inflect = (word, suffix) => {
  if (suffix === "ing") return `${word.replace(/([^aeiou])e$/, "$1")}ing`;
  if (suffix === "ed" || suffix === "d") return word.endsWith("e") ? `${word}d` : `${word}ed`;
  return /(s|x|z|ch|sh|o)$/.test(word) ? `${word}es` : `${word}s`;
};

function head(word) {
  const direct = HEAD.get(word);
  if (direct) return direct;
  for (const suffix of SUFFIXES) {
    if (!word.endsWith(suffix) || word.length <= suffix.length + 1) continue;
    const stem = word.slice(0, -suffix.length);
    const to = HEAD.get(stem) || (suffix === "ing" ? HEAD.get(`${stem}e`) : null);
    if (to) return inflect(to, suffix);
  }
  return word;
}

/* An already-normalised English sentence with every word that has a group
   written as that group's first word. Both the answer and what it is being
   marked against go through this, so which word that is does not matter. */
export const canonEn = (s) => String(s).split(" ").filter(Boolean).map(head).join(" ");
