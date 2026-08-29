/* A reading session, and then practice built out of it.

   Every other text in the course was written to teach: the unit sentences, the
   key phrases, the closing passages. That is right at the start and wrong
   later, and a unit called "Read: News" holding sentences about journalism
   rather than any news is what wrong looks like. This hands over paragraphs of
   an encyclopedia article instead, chosen because the vocabulary in them is
   vocabulary the course has taught.

   Reading it is not the exercise, though — that was the first version of this
   screen and it belonged in a library rather than under Practice. You read
   five paragraphs, you star what you did not know, and then you answer about
   those words inside those sentences. The drill is built from the session's
   own text, so a gap falls on a word you looked up in the line you looked it
   up in, and what you get right goes on the same review schedule as everything
   the path teaches.

   There is no English anywhere in it. That is what makes it real, and it is
   also the limit: with no reference translation there is nothing to mark a
   typed translation against, so the exercises are the two that need no
   reference — the gap and the dictation.
*/

import { Fragment, useEffect, useMemo, useState } from "react";
import { X, ExternalLink, Star, Dumbbell, Loader, RefreshCw } from "lucide-react";

import { fetchFeed } from "./data.js";
import { wiktionaryLookup } from "../dict.js";
import { rng, hash } from "./rand.js";
import { bareHe } from "./exercises.js";

/* How much is a sitting. Five paragraphs is a page of reading and enough text
   for the drill to have somewhere to put six gaps without asking twice about
   the same line. */
const PARAGRAPHS = 5;

/* Punctuation travels with the word for display and comes off for the lookup:
   ⁧בירה,⁩ is ⁧בירה⁩ to a dictionary and not to a reader. */
const lookupOf = (t) => t.replace(/[.,!?;:"'׳״()־–—]/g, "");

/* Wiktionary writes for lexicographers. Its entry for ⁧הם⁩ — a word this course
   teaches in unit 5 — is "they (the third-person masculine plural personal
   pronoun, masculine plural of הוא (hu'))", and then two more senses like it.
   That is 750 characters of grammar to answer "what does this mean", and it
   buries the one word that was wanted.

   So the parentheses come off and only the first sense survives. What is left
   of that example is "they", which is the whole answer. */
const plain = (text) => {
  let t = String(text || "");
  for (let i = 0; i < 3; i++) t = t.replace(/\s*\([^()]*\)/g, "");
  t = t.split(/[;,] /)[0].replace(/\s+/g, " ").trim();
  return t.length > 64 ? t.slice(0, 61).trimEnd() + "…" : t;
};

function Word({ token, starred, onStar }) {
  const [state, setState] = useState(null);   /* null | "…" | {g,pos} | "none" */
  const bare = bareHe(lookupOf(token));
  const isStarred = starred.has(bare);

  const tap = async () => {
    if (state) { setState(null); return; }
    const w = lookupOf(token);
    if (!w) return;
    setState("…");
    try {
      const hit = await wiktionaryLookup(w);
      setState({ g: plain(hit.g) || hit.g, pos: (hit.n || "").split(" · ")[0] });
    } catch { setState("none"); }
  };

  return (
    <span className="d-feed-word-wrap">
      <button className={`d-feed-word${state ? " on" : ""}${isStarred ? " starred" : ""}`} onClick={tap}>
        {token}
      </button>
      {state && (
        <span className="d-feed-gloss" dir="ltr">
          {state === "…" ? "looking it up…"
            : state === "none" ? "no dictionary entry"
            : <>{state.g}{state.pos ? <em className="d-feed-gloss-more">{state.pos}</em> : null}</>}
          {/* The star is what turns reading into practice: it says "ask me
              about this", and the drill afterwards puts the gap on it. A word
              with no meaning behind it cannot be reviewed, so only a word that
              actually came back from the dictionary can be starred. */}
          {state !== "…" && state !== "none" && (
            <button className={`d-feed-star${isStarred ? " on" : ""}`}
              onClick={(e) => { e.stopPropagation(); onStar(bare, state.g); }}>
              <Star size={13} fill={isStarred ? "currentColor" : "none"} />
              {isStarred ? "Starred" : "Practise this"}
            </button>
          )}
        </span>
      )}
    </span>
  );
}

export default function Feed({ unit, onDrill, onClose }) {
  const [state, setState] = useState({ status: "loading" });
  const [round, setRound] = useState(0);
  /* bare Hebrew -> the English the reader was shown, which is what the review
     schedule files the word under */
  const [starred, setStarred] = useState(() => new Map());

  useEffect(() => {
    let alive = true;
    fetchFeed(unit)
      .then((feed) => alive && setState({ status: "ready", ...feed }))
      .catch((e) => alive && setState({ status: "failed", why: e.message }));
    return () => { alive = false; };
  }, [unit]);

  /* The sitting: hardest first among what is readable, so the paragraphs are at
     the top of the range rather than in the middle of it — the whole argument
     for scoring the feed is that it can put somebody at the edge of what they
     can read. Seeded, so a session survives a reload and only "New texts"
     changes it. */
  const items = useMemo(() => {
    const all = state.items || [];
    if (!all.length) return [];
    const ranked = [...all].sort((a, b) => b.at - a.at);
    const pool = ranked.slice(0, Math.max(PARAGRAPHS * 6, Math.ceil(ranked.length * 0.3)));
    const rand = rng(hash(`feed:${unit}:${round}`));
    /* A sitting of five single sentences is forty words, which is a warm-up
       and not a read — and the one thing a paragraph can practise that a
       sentence bank cannot is holding on to who "he" is from one line to the
       next. So the runs that carry more than one sentence go in first, and
       single lines fill up what is left. */
    const runs = rand.shuffle(pool.filter((i) => i.lines > 1));
    const singles = rand.shuffle(pool.filter((i) => i.lines === 1));
    return [...runs, ...singles].slice(0, PARAGRAPHS);
  }, [state.items, unit, round]);

  if (state.status === "loading") {
    return (
      <div className="duo d-passage-wrap d-center" style={{ padding: 60 }}>
        <Loader className="spin" size={26} color="var(--d-green)" />
      </div>
    );
  }

  if (state.status === "failed" || !items.length) {
    return (
      <div className="duo d-passage-wrap">
        <div className="d-passage-bar">
          <button className="d-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Read something real</div>
        </div>
        <div className="d-passage">
          <p className="d-sub">
            {state.status === "failed"
              ? "The feed could not be loaded. It is a download, so the first time needs a connection."
              : `Nothing in the feed is readable at unit ${unit} yet. Real Hebrew starts arriving around unit 40.`}
          </p>
        </div>
      </div>
    );
  }

  const star = (he, en) => setStarred((p) => {
    const next = new Map(p);
    if (next.has(he)) next.delete(he); else next.set(he, en);
    return next;
  });

  const article = (src) => (state.index?.article || "") + encodeURIComponent(src);
  const words = items.reduce((a, i) => a + i.n, 0);

  return (
    <div className="duo d-passage-wrap">
      <div className="d-passage-bar">
        <button className="d-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Read something real</div>
          <div className="d-sub" style={{ fontSize: 12.5 }}>
            {items.length} paragraphs · {words} words · {state.items.length} texts open to you
          </div>
        </div>
        <button className="d-icon-btn" onClick={() => { setRound((r) => r + 1); setStarred(new Map()); }}
          aria-label="Different texts"><RefreshCw size={18} /></button>
      </div>

      <div className="d-passage">
        <p className="d-sub" style={{ marginTop: 0 }}>
          Tap any word you don't know. Star the ones worth practising — the drill
          at the end is built from them and from the lines they are in.
        </p>

        {items.map((item, n) => (
          <div key={n} className="d-feed-item">
            {item.gloss.length > 0 && (
              <div className="d-feed-new">
                <span className="d-sub">New here:</span>
                {item.gloss.map((g) => <span key={g} className="d-feed-new-word" dir="rtl">{g}</span>)}
              </div>
            )}
            {/* The space between two words is a text node JSX will not write
                for you, and without it the paragraph comes out as one unbroken
                run of Hebrew — which is exactly how it read the first time. */}
            <p className="d-feed-text" dir="rtl">
              {item.he.split(/\s+/).map((t, i) => (
                <Fragment key={i}>{i > 0 ? " " : null}
                  <Word token={t} starred={starred} onStar={star} />
                </Fragment>
              ))}
            </p>
            <div className="d-feed-foot">
              {/* CC BY-SA asks for the author and a route back, and the article
                  is both — so it is a link and not a footnote. */}
              <a className="d-feed-src" href={article(item.src)} target="_blank" rel="noreferrer noopener">
                {item.src} <ExternalLink size={12} />
              </a>
              <span className="d-sub" style={{ fontSize: 12 }}>readable from unit {item.at}</span>
            </div>
          </div>
        ))}

        <button className="d-btn" style={{ marginTop: 26 }} onClick={() => onDrill(items, starred)}>
          <Dumbbell size={16} /> Practise what you read
          {starred.size > 0 && ` · ${starred.size} starred`}
        </button>
        <p className="d-feed-licence">{state.index?.source} · {state.index?.license}</p>
      </div>
    </div>
  );
}
