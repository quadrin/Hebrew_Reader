/* Answer reports — "I think my answer was right", sent where Claude reads it.

   The course ships one English translation per sentence and marks much of
   what else a learner writes as wrong. The grader catches some of that, but
   not all, and some course translations are simply wrong. A report is the
   learner's way of saying so: the sentence, the course's answer, what they
   wrote or think is right (or nothing), and a comment if they want one.

   It becomes a GitHub issue on the app's own repository, labelled
   answer-report. A scheduled Claude session reads those once a day, decides
   each one, puts the fixes that hold up into data/answer-fixes.json, and
   answers and closes the issue (docs/answer-reports.md).

   The issue is posted with the GitHub token cloud sync already holds, when
   that token may write issues on the repository. When it may not — or there
   is no token — the report opens as a filled-in GitHub page instead, one tap
   from sent. Offline, the report waits on the device and goes on the next
   launch, or when the connection comes back. */

import { getToken } from "./cloud.js";

export const REPORT_REPO = "quadrin/Hebrew_Reader";
export const REPORT_LABEL = "answer-report";
const QUEUE_KEY = "duchifat-answer-reports";
const API = "https://api.github.com";
const MAX_KEPT = 50;

const load = (storage) => {
  try { return JSON.parse(storage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
};
const save = (storage, list) => {
  try { storage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-MAX_KEPT))); } catch { /* sent or not, the screen still says so */ }
};

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/* What the report says, made safe to hold and to post: every field a short
   single line, except the comment, which may run to a short paragraph. */
export function makeReport({ unit, kind, lang, he, en, reference, given, gaveUp, comment }) {
  return {
    v: 1,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    unit: Number.isFinite(unit) ? unit : null,
    kind: clip(kind, 30),
    lang: lang === "he" ? "he" : lang === "en" ? "en" : "",
    he: clip(he, 400),
    en: clip(en, 400),
    reference: clip(reference, 400),
    given: clip(given, 400),
    gaveUp: !!gaveUp,
    comment: String(comment ?? "").trim().slice(0, 1000),
  };
}

export function issueTitle(r) {
  const what = r.given ? `"${clip(r.given, 60)}"` : "no answer";
  return `[answer report] ${clip(r.he, 60)} — ${what}`;
}

/* Written for a person first, with the same facts as JSON at the end for the
   session that handles it. Anything a learner typed is quoted as code, so it
   cannot turn into a mention, a link or a heading. */
export function issueBody(r) {
  const code = (s) => (s ? "`` " + s.replace(/`/g, "'") + " ``" : "_(blank)_");
  const direction = r.lang === "he" ? "English → Hebrew" : r.lang === "en" ? "Hebrew → English" : "—";
  const lines = [
    "A learner reported this answer from the app.",
    "",
    `- **Hebrew:** ${code(r.he)}`,
    `- **English:** ${code(r.en)}`,
    `- **Asked:** ${direction}${r.kind ? ` (${r.kind})` : ""}${r.unit != null ? `, unit ${r.unit}` : ""}`,
    `- **Course's answer:** ${code(r.reference)}`,
    `- **Learner's answer:** ${r.gaveUp && !r.given ? "_pressed \"I don't know\"_" : code(r.given)}`,
    "",
    "**Comment:**",
    "",
    r.comment ? r.comment.split("\n").map((l) => `> ${l.replace(/@/g, "@​")}`).join("\n") : "_(none)_",
    "",
    "<!-- answer-report",
    /* "--" and "@" only ever occur inside a JSON string, where \u002d and
       \u0040 read the same: a comment cannot end the HTML comment early, and
       no mention in it reaches anybody */
    JSON.stringify(r).replace(/--/g, "-\\u002d").replace(/@/g, "\\u0040"),
    "-->",
  ];
  return lines.join("\n");
}

/* The page GitHub opens for a new issue, already filled in. Used when the
   app cannot post the issue itself. */
export function issueUrl(r) {
  const q = new URLSearchParams({ title: issueTitle(r), body: issueBody(r), labels: REPORT_LABEL });
  return `https://github.com/${REPORT_REPO}/issues/new?${q}`;
}

async function post(r, { token, fetcher }) {
  let res;
  try {
    res = await fetcher(`${API}/repos/${REPORT_REPO}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: issueTitle(r), body: issueBody(r), labels: [REPORT_LABEL] }),
    });
  } catch {
    return { state: "queued" };
  }
  if (res.ok) {
    const issue = await res.json().catch(() => ({}));
    return { state: "sent", url: issue.html_url || "", number: issue.number || null };
  }
  /* not allowed to write issues there, or no such repository for this
     token: the person can still post it themselves */
  if ([401, 403, 404, 410, 422].includes(res.status)) return { state: "manual", url: issueUrl(r) };
  return { state: "queued" };
}

/* Send one report: posted, kept for later, or handed to the person to post. */
export async function submitReport(report, {
  storage = globalThis.localStorage, fetcher = globalThis.fetch, token = getToken(), online = globalThis.navigator?.onLine !== false,
} = {}) {
  if (!token) return { state: "manual", url: issueUrl(report) };
  if (!online) {
    save(storage, [...load(storage), report]);
    return { state: "queued" };
  }
  const result = await post(report, { token, fetcher });
  if (result.state === "queued") save(storage, [...load(storage), report]);
  return result;
}

/* Send whatever is waiting. Reports the token may not post stay waiting: the
   person was already offered the GitHub page for them when they were made. */
let flushing = null;
export function flushReports({
  storage = globalThis.localStorage, fetcher = globalThis.fetch, token = getToken(), online = globalThis.navigator?.onLine !== false,
} = {}) {
  if (flushing) return flushing;
  flushing = (async () => {
    const waiting = load(storage);
    if (!token || !online || !waiting.length) return { sent: 0, left: waiting.length };
    const left = [];
    let sent = 0;
    for (const r of waiting) {
      const result = await post(r, { token, fetcher });
      if (result.state === "sent") sent++;
      else if (result.state === "queued") left.push(r);
    }
    save(storage, left);
    return { sent, left: left.length };
  })().finally(() => { flushing = null; });
  return flushing;
}

export const waitingReports = (storage = globalThis.localStorage) => load(storage).length;
