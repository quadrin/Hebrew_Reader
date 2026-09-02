/* An article, with the English side missing.

   The Hebrew is a real Wikipedia page — its own title, its own lead, its own
   link back — laid out as a page rather than as a exercise, because a
   paragraph pulled out of an article and set in a lesson frame is a lesson,
   and the point of this is that it is not one.

   Beside it the English column starts empty and you write it. One sentence at
   a time, top to bottom: the sentence you are on has a box, the ones you have
   finished stand as prose, and the ones below wait. What builds up on the left
   is the article you have read, in your own words, which is a different thing
   from having been shown a translation.

   The tutor is there for when you are stuck rather than instead of you. It
   marks what you write against the Hebrew — there is no reference English for
   a Wikipedia article, so the model reads the Hebrew and rules on your English
   — and a hint names the one thing in the way (the word, the prefix, which
   word is the verb) without handing over the sentence. Tapping a word still
   goes to the dictionary, which needs no key at all. */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { X, ExternalLink, Lightbulb, Check, Loader, RefreshCw, ArrowRight, Dumbbell } from "lucide-react";

import { fetchFeed } from "./data.js";
import { wiktionaryLookup } from "../dict.js";
import { fetchOpenRuling, fetchReadingHint, hasApiKey, AiError } from "../ai.js";
import { rng, hash } from "./rand.js";
import { bareHe } from "./exercises.js";

/* Punctuation travels with the word for display and comes off for the lookup:
   ⁧בירה,⁩ is ⁧בירה⁩ to a dictionary and not to a reader. */
const lookupOf = (t) => t.replace(/[.,!?;:"'׳״()־–—]/g, "");

/* Wiktionary writes for lexicographers. Its entry for ⁧הם⁩ is "they (the
   third-person masculine plural personal pronoun, masculine plural of הוא
   (hu'))", and then two more senses like it — 750 characters of grammar to
   answer "what does this mean". The parentheses come off and the first sense
   is kept, which for that entry leaves "they". */
const plain = (text) => {
  let t = String(text || "");
  for (let i = 0; i < 3; i++) t = t.replace(/\s*\([^()]*\)/g, "");
  t = t.split(/[;,] /)[0].replace(/\s+/g, " ").trim();
  return t.length > 64 ? t.slice(0, 61).trimEnd() + "…" : t;
};

function Word({ token, onMet }) {
  const [state, setState] = useState(null);   /* null | "…" | {g,pos} | "none" */

  const tap = async () => {
    if (state) { setState(null); return; }
    const w = lookupOf(token);
    if (!w) return;
    setState("…");
    try {
      const hit = await wiktionaryLookup(w);
      const g = plain(hit.g) || hit.g;
      setState({ g, pos: (hit.n || "").split(" · ")[0] });
      onMet(bareHe(w), g);
    } catch { setState("none"); }
  };

  return (
    <span className="d-art-word-wrap">
      <button className={`d-art-word${state ? " on" : ""}`} onClick={tap}>{token}</button>
      {state && (
        <span className="d-art-gloss" dir="ltr">
          {state === "…" ? "looking it up…"
            : state === "none" ? "no dictionary entry"
            : <>{state.g}{state.pos ? <em>{state.pos}</em> : null}</>}
        </span>
      )}
    </span>
  );
}

/* One sentence: the Hebrew on the right, and on the left either what you have
   written and had accepted, or the box you are writing it in. */
function Line({ line, index, state, active, graded, onMet, onSolve, onAsk }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");        /* the grader's reason, when it says no */
  const [hint, setHint] = useState("");
  const box = useRef(null);

  useEffect(() => { if (active && box.current) box.current.focus(); }, [active]);

  const check = async () => {
    const given = draft.trim();
    if (!given || busy) return;
    setBusy(true); setSaid(""); setHint("");
    try {
      const ruling = await fetchOpenRuling({ he: line.he, given });
      if (ruling.accept) onSolve(index, given);
      else setSaid(ruling.why || "Not quite — read it again.");
    } catch (e) {
      setSaid(e instanceof AiError && e.status === 0
        ? "A tutor key is needed to mark this. Settings → AI tutor."
        : "The tutor could not be reached. Try again in a moment.");
    } finally { setBusy(false); }
  };

  const ask = async () => {
    setBusy(true); setHint("");
    try { setHint(await onAsk(line.he, draft.trim())); }
    catch (e) {
      setHint(e instanceof AiError && e.status === 0
        ? "A tutor key is needed for hints. Settings → AI tutor."
        : "The tutor could not be reached.");
    } finally { setBusy(false); }
  };

  return (
    <div className={`d-art-line${active ? " active" : ""}${state ? " done" : ""}`}>
      <div className="d-art-en">
        {state ? <p className={state.unmarked ? "d-art-unmarked" : ""}>{state.text}</p>
          : active ? (
            <>
              <textarea
                ref={box} className="d-art-input" rows={2} value={draft}
                placeholder="What does this sentence say?"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); check(); } }}
              />
              <div className="d-art-actions">
                {/* Without a tutor key there is nobody to mark this against —
                    a Wikipedia article carries no reference English. Rather
                    than a button that can only fail, the sentence can be taken
                    as read: you still translated it, nothing says whether you
                    were right, and the page still gets to the end. */}
                {graded ? (
                  <button className="d-art-check" disabled={!draft.trim() || busy} onClick={check}>
                    {busy ? <Loader size={13} className="spin" /> : <Check size={13} />} Check
                  </button>
                ) : (
                  <button className="d-art-check" disabled={!draft.trim()}
                    onClick={() => onSolve(index, draft.trim(), true)}>
                    <ArrowRight size={13} /> Next sentence
                  </button>
                )}
                <button className="d-art-hint" disabled={busy} onClick={ask}>
                  <Lightbulb size={13} /> Hint
                </button>
              </div>
              {said && <p className="d-art-said">{said}</p>}
              {hint && <p className="d-art-tip"><Lightbulb size={12} /> {hint}</p>}
            </>
          ) : <p className="d-art-waiting">·</p>}
      </div>
      <div className="d-art-he" dir="rtl" lang="he">
        {line.he.split(/\s+/).map((t, i) => (
          <Fragment key={i}>{i > 0 ? " " : null}<Word token={t} onMet={onMet} /></Fragment>
        ))}
        {line.gloss.length > 0 && !state && (
          <div className="d-art-new">
            {line.gloss.map((g) => <span key={g} className="d-art-new-word">{g}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Article({ unit, onDrill, onClose }) {
  const [feed, setFeed] = useState({ status: "loading" });
  const [round, setRound] = useState(0);
  const [solved, setSolved] = useState({});         /* line index -> accepted English */
  const [met, setMet] = useState(() => new Map());  /* bare Hebrew -> the gloss shown */

  useEffect(() => {
    let alive = true;
    fetchFeed(unit)
      .then((f) => alive && setFeed({ status: "ready", ...f }))
      .catch((e) => alive && setFeed({ status: "failed", why: e.message }));
    return () => { alive = false; };
  }, [unit]);

  /* Hardest first among what is readable, so the article on offer sits at the
     top of the range rather than in the middle of it. Seeded, so a page
     survives a reload and only "another article" changes it. */
  const page = useMemo(() => {
    /* A page with no sentences under it is not a page: there is nothing to
       write against it, and every count below reads it as an article already
       read. One reaching here at all means a band held from an older feed, so
       it is passed over rather than offered. */
    const all = (feed.items || []).filter((i) => i.text?.length);
    if (!all.length) return null;
    const ranked = [...all].sort((a, b) => b.at - a.at);
    const pool = ranked.slice(0, Math.max(20, Math.ceil(ranked.length * 0.3)));
    return rng(hash(`article:${unit}:${round}`)).pick(pool);
  }, [feed.items, unit, round]);

  if (feed.status === "loading") {
    return <div className="duo d-art-wrap d-center" style={{ padding: 60 }}>
      <Loader className="spin" size={26} color="var(--d-green)" />
    </div>;
  }

  if (feed.status === "failed" || !page) {
    return (
      <div className="duo d-art-wrap">
        <div className="d-art-bar">
          <button className="d-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
          <div style={{ fontWeight: 800 }}>Read an article</div>
        </div>
        <p className="d-sub" style={{ padding: 24 }}>
          {feed.status === "failed"
            ? "The feed could not be loaded. It is a download, so the first time needs a connection."
            : `No article is readable at unit ${unit} yet. Whole paragraphs of real Hebrew start arriving around unit 60.`}
        </p>
      </div>
    );
  }

  const lines = page.text || [];
  /* Whether anything can mark an answer. The hint needs a key too, but a hint
     that cannot be fetched says so once; a Check that cannot mark is a button
     whose only outcome is an error. */
  const graded = hasApiKey();
  const done = lines.filter((_, i) => solved[i] != null).length;
  const active = lines.findIndex((_, i) => solved[i] == null);
  const finished = lines.length > 0 && active < 0;

  const restart = () => { setRound((r) => r + 1); setSolved({}); setMet(new Map()); };

  return (
    <div className="duo d-art-wrap">
      <div className="d-art-bar">
        <button className="d-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Read an article</div>
          <div className="d-sub" style={{ fontSize: 12.5 }}>
            {done} of {lines.length} sentences · readable from unit {page.at}
            {!graded && " · Settings → AI tutor to have these marked"}
          </div>
        </div>
        <button className="d-icon-btn" onClick={restart} aria-label="Another article"><RefreshCw size={18} /></button>
      </div>

      <div className="d-art-progress"><span style={{ width: `${lines.length ? (done / lines.length) * 100 : 0}%` }} /></div>

      <div className="d-art-page">
        <div className="d-art-titles">
          <div className="d-art-title-en">{finished ? "your English" : "English — you write this"}</div>
          <div className="d-art-title-he" dir="rtl" lang="he">
            <h1>{page.src}</h1>
            <div className="d-sub">מתוך ויקיפדיה, האנציקלופדיה החופשית</div>
          </div>
        </div>

        {lines.map((line, i) => (
          <Line
            key={i} line={line} index={i}
            state={solved[i]}
            active={i === active}
            graded={graded}
            onMet={(he, en) => setMet((p) => (p.has(he) ? p : new Map(p).set(he, en)))}
            onSolve={(n, given, unmarked) => setSolved((p) => ({ ...p, [n]: { text: given, unmarked } }))}
            onAsk={(he, given) => fetchReadingHint({ he, given })}
          />
        ))}

        <div className="d-art-foot">
          <a className="d-art-src" href={(feed.index?.article || "") + encodeURIComponent(page.src)}
            target="_blank" rel="noreferrer noopener">
            {page.src} <ExternalLink size={12} />
          </a>
          <span className="d-sub">{feed.index?.source} · {feed.index?.license}</span>
        </div>

        {finished && (
          <div className="d-art-done">
            <p><Check size={16} /> You read the whole thing.</p>
            <button className="d-btn" onClick={() => onDrill([page], met)}>
              <Dumbbell size={16} /> Practise its words
            </button>
            <button className="d-btn ghost" onClick={restart}>
              <ArrowRight size={16} /> Another article
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
