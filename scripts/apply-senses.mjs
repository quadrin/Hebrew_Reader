/* apply-senses.mjs — put the gloss corrections in data/word-senses.json onto
   the unit files in public/duo/, without rebuilding them. build-duo does the
   same as its last step; this is for when only the table has changed.

   Run: npm run build:senses */

import path from "node:path";
import { applySenses, restamp } from "./lib/senses.mjs";

const OUT = path.resolve(import.meta.dirname, "..", "public", "duo");
const changed = applySenses(OUT);
console.log(changed.length ? changed.join("\n") : "every correction is already in place");
const stamped = restamp(OUT);
console.log(`\n${changed.length} words re-glossed${stamped ? ", course.json re-stamped" : ""}`);
