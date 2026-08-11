/* English names for Hebrew authors.

   Project Ben-Yehuda's catalogue links most authors to Wikidata, which is the
   authority on how a name is spelled in English — better than romanizing
   "נחמן מברסלב" ourselves and landing somewhere nobody searches for. */

import { sleep } from "./ask.mjs";

export async function englishAuthors(qids, { batch = 45, ua } = {}) {
  const out = new Map();
  const agent = ua || "Lavan Hebrew Reader build script (github.com/quadrin/Hebrew_Reader)";
  for (let i = 0; i < qids.length; i += batch) {
    const ids = qids.slice(i, i + batch);
    const url = "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json"
      + "&props=labels|descriptions&languages=en&ids=" + ids.join("|");
    /* Wikidata answers a burst of rebuilds with 429s, and a half-filled result
       would quietly ship Hebrew-only names — so back off and retry. */
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const r = await fetch(url, { headers: { "User-Agent": agent } });
        if (r.status === 429 || r.status >= 500) {
          const wait = Number(r.headers.get("retry-after")) * 1000 || 2000 * 2 ** attempt;
          console.log(`  ${r.status} from Wikidata — waiting ${Math.round(wait / 1000)}s`);
          await sleep(wait);
          continue;
        }
        if (!r.ok) throw new Error(`wikidata ${r.status}`);
        const data = await r.json();
        for (const [qid, e] of Object.entries(data.entities || {})) {
          const label = e?.labels?.en?.value;
          if (label) out.set(qid, { name: label, note: e?.descriptions?.en?.value || "" });
        }
        break;
      } catch (e) {
        if (attempt === 4) console.warn(`  batch failed (${e.message}) — those names stay Hebrew-only`);
        else await sleep(2000 * 2 ** attempt);
      }
    }
    await sleep(400);
  }
  return out;
}
