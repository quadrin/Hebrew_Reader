/* apply-answer-fixes.mjs — put the answer fixes in data/answer-fixes.json onto
   the unit files in public/duo/, without rebuilding them. build-duo does the
   same as its last step; this is for when only the table has changed.

   Run: npm run build:answers */

import path from "node:path";
import { applyAnswerFixes, unmatchedFixes } from "./lib/answer-fixes.mjs";
import { restamp } from "./lib/senses.mjs";

const OUT = path.resolve(import.meta.dirname, "..", "public", "duo");
const changed = applyAnswerFixes(OUT);
console.log(changed.length ? changed.join("\n") : "every answer fix is already in place");
const missing = unmatchedFixes(OUT);
for (const f of missing) console.error(`no sentence in the course matches: ${f.he}${f.issue ? ` (issue #${f.issue})` : ""}`);
const stamped = restamp(OUT);
console.log(`\n${changed.length} changes${stamped ? ", course.json re-stamped" : ""}`);
if (missing.length) process.exitCode = 1;
