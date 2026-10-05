/* check:reports — answer reports and the fixes that come out of them.

   src/reports.js: what a report holds, how it is written into an issue (safe
   against anything a learner types), and where it goes — posted, kept for
   later, or handed to GitHub's own page. scripts/lib/answer-fixes.mjs: that a
   fix lands on the sentence it names and nowhere else, adds without
   duplicating, and that every entry in data/answer-fixes.json matches a
   sentence in the course.

   Run: npm run check:reports */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { makeReport, issueBody, issueTitle, issueUrl, submitReport, flushReports, waitingReports, REPORT_REPO, REPORT_LABEL } =
  await import("../src/reports.js");
const { fixUnit, applyAnswerFixes, unmatchedFixes, readAnswerFixes } = await import("./lib/answer-fixes.mjs");

let passed = 0;
const pass = (name) => { passed++; console.log(`PASS ${name}`); };

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), map: m }; };
const base = {
  unit: 30, kind: "type", lang: "en", he: "הילדים משחקים בגן", en: "The children are playing in the park",
  reference: "The children are playing in the park", given: "The kids are playing in the park", gaveUp: false, comment: "",
};

/* ---------- the report ---------- */
{
  const r = makeReport({ ...base, given: "  The   kids\nplay  ", comment: "x".repeat(2000), unit: undefined });
  assert.equal(r.given, "The kids play");
  assert.equal(r.comment.length, 1000);
  assert.equal(r.unit, null);
  assert.equal(r.v, 1);
  assert.match(r.id, /^[a-z0-9]+-[a-z0-9]+$/);
  assert.equal(makeReport({ ...base, lang: "speech" }).lang, "");
  pass("a report is trimmed, bounded and versioned");
}
{
  const evil = makeReport({ ...base, given: "`rm` @someone", comment: "@everyone look\n# heading\n--> <script>x</script>" });
  const body = issueBody(evil);
  assert(!/(^|[^​])@everyone/.test(body), "a mention in the comment is defused");
  assert(body.includes("> # heading"), "the comment is quoted, so it cannot start a heading");
  const json = body.match(/<!-- answer-report\n([\s\S]*?)\n-->/);
  assert(json, "the data block survives a comment containing -->");
  assert.deepEqual(JSON.parse(json[1]), evil, "and reads back exactly");
  assert(issueTitle(evil).startsWith("[answer report] "));
  const blank = issueBody(makeReport({ ...base, given: "", gaveUp: true }));
  assert.match(blank, /pressed "I don't know"/);
  const url = new URL(issueUrl(evil));
  assert.equal(url.origin + url.pathname, `https://github.com/${REPORT_REPO}/issues/new`);
  assert.equal(url.searchParams.get("labels"), REPORT_LABEL);
  assert.equal(url.searchParams.get("body"), body);
  pass("the issue is readable, safe against what a learner types, and machine-readable");
}

/* ---------- where it goes ---------- */
const response = (status, json = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => json });
{
  const storage = memory(); const calls = [];
  const fetcher = async (url, init) => { calls.push({ url, init }); return response(201, { html_url: "https://github.com/x/1", number: 1 }); };
  const r = makeReport(base);
  const result = await submitReport(r, { storage, fetcher, token: "t", online: true });
  assert.deepEqual(result, { state: "sent", url: "https://github.com/x/1", number: 1 });
  assert.equal(calls[0].url, `https://api.github.com/repos/${REPORT_REPO}/issues`);
  assert.equal(calls[0].init.headers.Authorization, "Bearer t");
  assert.deepEqual(JSON.parse(calls[0].init.body).labels, [REPORT_LABEL]);
  assert.equal(waitingReports(storage), 0);
  pass("with a token that may write issues, the report is posted");
}
{
  const storage = memory(); let called = 0;
  const result = await submitReport(makeReport(base), { storage, fetcher: async () => { called++; }, token: "", online: true });
  assert.equal(result.state, "manual"); assert.match(result.url, /issues\/new/); assert.equal(called, 0);
  for (const status of [401, 403, 404]) {
    const res = await submitReport(makeReport(base), { storage, fetcher: async () => response(status), token: "t", online: true });
    assert.equal(res.state, "manual", `HTTP ${status} hands the report to GitHub's page`);
  }
  assert.equal(waitingReports(storage), 0, "nothing is queued that the token could never send");
  pass("without a token, or one that may not write issues, GitHub's page is offered");
}
{
  const storage = memory(); let calls = 0;
  const offline = await submitReport(makeReport(base), { storage, fetcher: async () => { calls++; }, token: "t", online: false });
  assert.equal(offline.state, "queued"); assert.equal(calls, 0);
  const failing = await submitReport(makeReport(base), { storage, fetcher: async () => { throw new TypeError("Failed to fetch"); }, token: "t", online: true });
  assert.equal(failing.state, "queued");
  const busy = await submitReport(makeReport(base), { storage, fetcher: async () => response(502), token: "t", online: true });
  assert.equal(busy.state, "queued");
  assert.equal(waitingReports(storage), 3);
  assert.deepEqual(await flushReports({ storage, fetcher: async () => response(201, {}), token: "t", online: false }), { sent: 0, left: 3 });
  let n = 0;
  const flaky = async () => (++n === 2 ? response(500) : response(201, {}));
  assert.deepEqual(await flushReports({ storage, fetcher: flaky, token: "t", online: true }), { sent: 2, left: 1 });
  assert.deepEqual(await flushReports({ storage, fetcher: async () => response(201, {}), token: "t", online: true }), { sent: 1, left: 0 });
  pass("offline or failing, the report waits and is sent later, once");
}

/* ---------- the fixes ---------- */
{
  const doc = {
    unit: 30,
    phrases: [{ he: "הַיְלָדִים מְשַׂחֲקִים בַּגַּן", en: "The children are playing in the park", alt: [] }],
    sentences: [
      { he: "הילדים משחקים בגן", en: "The children are playing in the park", alt: ["The children play in the park"] },
      { he: "הוא בא", en: "He comes", alt: [] },
    ],
  };
  const table = [
    { he: "הילדים משחקים בגן", acceptEn: ["The kids are playing in the park", "the children play in the park"], acceptHe: ["הילדים משחקים בפארק", "הילדים משחקים בגן"], issue: 1 },
    { he: "הוא בא", en: "He is coming", units: [31] },
  ];
  const changed = fixUnit(doc, table);
  assert.deepEqual(doc.sentences[0].alt, ["The children play in the park", "The kids are playing in the park"], "adds, without a case-only duplicate");
  assert.deepEqual(doc.sentences[0].heAlt, ["הילדים משחקים בפארק"], "never the sentence itself");
  assert.deepEqual(doc.phrases[0].alt, ["The kids are playing in the park", "the children play in the park"], "matches through vowel points");
  assert.equal(doc.sentences[1].en, "He comes", "a fix for another unit stays there");
  assert.equal(changed.length, 4);
  assert.deepEqual(fixUnit(doc, table), [], "applying twice changes nothing");
  const fixed = { unit: 31, sentences: [{ he: "הוא בא", en: "He comes", alt: ["He is coming", "He arrives"] }] };
  fixUnit(fixed, table);
  assert.equal(fixed.sentences[0].en, "He is coming");
  assert.deepEqual(fixed.sentences[0].alt, ["He arrives"], "the new English is not also an alternative, and the wrong one is dropped");
  pass("a fix lands on its sentence, adds without duplicates, and corrects English");
}
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "answer-fixes-"));
  fs.writeFileSync(path.join(dir, "unit-001.json"), JSON.stringify({ unit: 1, sentences: [{ he: "שלום", en: "Hello", alt: [] }] }));
  const table = [{ he: "שלום", acceptEn: ["Hi"] }, { he: "אין כזה", acceptEn: ["nothing"] }];
  assert.equal(applyAnswerFixes(dir, table).length, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "unit-001.json"), "utf8")).sentences[0].alt, ["Hi"]);
  assert.deepEqual(unmatchedFixes(dir, table).map((f) => f.he), ["אין כזה"]);
  fs.rmSync(dir, { recursive: true, force: true });
  pass("a fix that matches no sentence is reported");
}
{
  const out = path.resolve(import.meta.dirname, "..", "public", "duo");
  const table = readAnswerFixes();
  assert.deepEqual(unmatchedFixes(out, table), [], "every entry in data/answer-fixes.json matches a course sentence");
  for (const f of table) {
    assert(f.he && (f.acceptEn?.length || f.acceptHe?.length || f.en), `an entry with nothing to do: ${JSON.stringify(f)}`);
  }
  const before = fs.readdirSync(out).filter((f) => /^unit-\d+\.json$/.test(f)).map((f) => fs.readFileSync(path.join(out, f), "utf8"));
  const docs = before.map((t) => JSON.parse(t));
  for (const d of docs) fixUnit(d, table);
  assert.deepEqual(docs.map((d) => JSON.stringify(d)), before, "the unit files already carry every fix (run npm run build:answers)");
  pass(`data/answer-fixes.json (${table.length} entries) is valid and applied`);
}

{
  /* A Hebrew alternative from a fix reaches the exercise and counts. */
  const { buildSession, checkAnswer } = await import("../src/duo/exercises.js");
  const out = path.resolve(import.meta.dirname, "..", "public", "duo");
  const docs = [28, 29, 30].map((n) => JSON.parse(fs.readFileSync(path.join(out, `unit-${String(n).padStart(3, "0")}.json`), "utf8")));
  const extra = (he) => `${he} בבקשה`;
  const extraEn = (en) => `${en} indeed`;
  for (const d of docs) for (const x of [...(d.phrases || []), ...(d.sentences || [])]) { x.heAlt = [extra(x.he)]; x.alt = [...(x.alt || []), extraEn(x.en)]; }
  let ex = null;
  for (let i = 0; i < 40 && !ex; i++) {
    ex = buildSession({ unit: 30, docs, kind: "lesson", lessonIndex: i, settings: {} })
      .find((e) => e.type === "bank" && e.lang === "he" && Array.isArray(e.accepted) && e.accepted.length > 1) || null;
  }
  assert.ok(ex, "a write-it-in-Hebrew exercise was built");
  assert.equal(checkAnswer(ex, extra(ex.display)).ok, true, "the fixed alternative is accepted");
  assert.equal(checkAnswer({ ...ex, accepted: [ex.display] }, extra(ex.display)).ok, false, "and only because of the fix");
  pass("a Hebrew alternative from a fix is accepted in a lesson");

  /* and English ones, key phrases included — those used to drop their alt */
  const phrasesHe = new Set(docs.flatMap((d) => (d.phrases || []).map((x) => x.he)));
  let en = null;
  for (let i = 0; i < 60 && !en; i++) {
    en = buildSession({ unit: 30, docs, kind: "lesson", lessonIndex: i, settings: {} })
      .find((e) => e.type === "bank" && e.lang === "en" && phrasesHe.has(e.prompt)) || null;
  }
  assert.ok(en, "a translate-a-key-phrase exercise was built");
  assert.equal(checkAnswer(en, extraEn(en.display)).ok, true, "a key phrase's fixed English is accepted");
  pass("an English alternative from a fix is accepted, key phrases included");
}

console.log(`\ncheck:reports — ${passed} groups passed`);
