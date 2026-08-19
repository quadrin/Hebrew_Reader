/* Can each word in a root family actually come from that root?

   This is a floor, not a proof. Hebrew derivation is regular enough that a
   mechanical test catches the gross errors — a word missing a root consonant
   entirely, which is how the naive clustering ended up filing מעילים under
   ע-ל-מ and "biology" under ב-ל-ג. It cannot catch a plausible wrong member,
   because a plausible wrong member has the right letters in the right order:
   that is exactly what makes it plausible. The hand pass in roots.js is the
   real guarantee, and this stops the hand pass from slipping.

   A member is consistent with a root when the root's consonants appear in it
   in order. Weak letters (א ה ו י נ) may be missing, because they drop:
   ג-ו-ר gives גר, י-ד-ע gives מודע, נ-פ-ל gives יפול. Final forms count as
   their ordinary letters, so ם is מ.

   An impostor is checked the other way round. Its whole job in the odd-one-out
   drill is to look like it belongs and not belong, so it must NOT be
   consistent with the root — if it is, it is not an impostor but a member the
   author mislabelled.

   Run: npm run check:roots
*/

import { ROOTS, fitsRoot as consistent } from "../src/duo/roots.js";

const problems = [];
let families = 0, words = 0, impostors = 0, homographs = 0;
const byForm = {};

for (const f of ROOTS) {
  families++;
  if (!/^[֐-׿]+(-[֐-׿]+){2,3}$/.test(f.root)) problems.push(`${f.root}: not a hyphenated three or four letter root`);
  if (!f.sense) problems.push(`${f.root}: no sense given`);
  if ((f.words || []).length < 4) problems.push(`${f.root}: only ${(f.words || []).length} words — a family wants at least four`);

  const seen = new Map();
  for (const w of f.words || []) {
    words++;
    if (!w.he || !w.en || !w.form) { problems.push(`${f.root}: a word is missing he, en or form`); continue; }
    byForm[w.form.split(" ")[0]] = (byForm[w.form.split(" ")[0]] || 0) + 1;
    if (!consistent(w.he, f.root)) problems.push(`${f.root}: ${w.he} (${w.en}) cannot come from this root`);
    /* the same spelling twice is deliberate — מדבר speaks and מדבר a desert —
       but only when they mean different things */
    if (seen.has(w.he)) {
      homographs++;
      if (seen.get(w.he) === w.en) problems.push(`${f.root}: ${w.he} is listed twice with the same meaning`);
    }
    seen.set(w.he, w.en);
  }

  for (const im of f.impostors || []) {
    impostors++;
    if (!im.he || !im.en || !im.from) { problems.push(`${f.root}: an impostor is missing he, en or from`); continue; }
    if (consistent(im.he, f.root)) {
      problems.push(`${f.root}: ${im.he} is listed as an impostor but its letters fit this root — ` +
        `either it belongs in words, or the root it is said to come from (${im.from}) is wrong`);
    }
  }
}

console.log(`checked ${families} families, ${words} words, ${impostors} impostors`);
console.log(`  ${homographs} deliberate homographs (same spelling, different word)`);
console.log(`  by form: ${Object.entries(byForm).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`);

if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log("\nno problems");
