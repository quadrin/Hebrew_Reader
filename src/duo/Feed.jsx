/* Hebrew that Hebrew speakers wrote, at the level you have reached.

   Every other text in the course was written to teach: the unit sentences, the
   key phrases, the closing passages. That is right at the start and wrong
   later, and the unit called "Read: News" containing sentences about
   journalism rather than any news is what wrong looks like. This hands over a
   paragraph of an encyclopedia article instead — chosen because the vocabulary
   in it is vocabulary the course has taught, and shipped with the two or three
   words it knows you have not met.

   There is no English. That is the point: the reader taps a word it does not
   know and Wiktionary answers, the same way the book reader already works, and
   what is left is a paragraph of Hebrew read as Hebrew. The words the feed
   flagged are named up front, because being told which three words are new
   before starting is the difference between reading and decoding.
*/

import { Fragment, useEffect, useState } from "react";
import { X, ExternalLink, Shuffle, Loader } from "lucide-react";

import { fetchFeed } from "./data.js";
import { wiktionaryLookup } from "../dict.js";
import { mulberry32 } from "./rand.js";

/* Punctuation travels with the word for display and comes off for the lookup:
   ⁧בירה,⁩ is ⁧בירה⁩ to a dictionary and not to a reader. */
const lookupOf = (t) => t.replace(/[.,!?;:"'׳״()־–—]/g, "");

function Word({ token }) {
  const [state, setState] = useState(null);   /* null | "…" | {g, n} | "none" */

  const tap = async () => {
    if (state) { setState(null); return; }
    const w = lookupOf(token);
    if (!w) return;
    setState("…");
    try { setState(await wiktionaryLookup(w)); }
    catch { setState("none"); }
  };

  return (
    <span className="d-feed-word-wrap">
      <button className={`d-feed-word${state ? " on" : ""}`} onClick={tap}>{token}</button>
      {state && (
        <span className="d-feed-gloss" dir="ltr">
          {state === "…" ? "looking it up…"
            : state === "none" ? "no dictionary entry"
            : <>{state.g}{state.n ? <em className="d-feed-gloss-more">{state.n}</em> : null}</>}
        </span>
      )}
    </span>
  );
}

export default function Feed({ unit, onClose }) {
  const [state, setState] = useState({ status: "loading" });
  const [n, setN] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchFeed(unit)
      .then((feed) => alive && setState({ status: "ready", ...feed }))
      .catch((e) => alive && setState({ status: "failed", why: e.message }));
    return () => { alive = false; };
  }, [unit]);

  if (state.status === "loading") {
    return (
      <div className="duo d-passage-wrap d-center" style={{ padding: 60 }}>
        <Loader className="spin" size={26} color="var(--d-green)" />
      </div>
    );
  }

  const items = state.items || [];
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
              ? "The feed could not be loaded. It is a download, so this needs a connection the first time."
              : `Nothing in the feed is readable at unit ${unit} yet. Real Hebrew starts arriving around unit 40.`}
          </p>
        </div>
      </div>
    );
  }

  /* Hardest first among what is readable, so the paragraph on offer is at the
     top of the range rather than in the middle of it — the whole argument for
     scoring the feed is that it can put you at the edge of what you can read.
     Seeded off the pick number so "another" is a different text and re-opening
     the screen is not a reshuffle. */
  const ranked = [...items].sort((a, b) => b.at - a.at);
  const pool = ranked.slice(0, Math.max(12, Math.ceil(ranked.length * 0.25)));
  const item = pool[Math.floor(mulberry32(n + 1)() * pool.length)];
  const article = (state.index?.article || "") + encodeURIComponent(item.src);

  return (
    <div className="duo d-passage-wrap">
      <div className="d-passage-bar">
        <button className="d-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Read something real</div>
          <div className="d-sub" style={{ fontSize: 12.5 }}>
            Readable from unit {item.at} · {items.length} texts open to you
          </div>
        </div>
      </div>

      <div className="d-passage">
        {item.gloss.length > 0 && (
          <div className="d-feed-new">
            <span className="d-sub">New here:</span>
            {item.gloss.map((g) => <span key={g} className="d-feed-new-word" dir="rtl">{g}</span>)}
          </div>
        )}

        {/* The space between two words is a text node JSX will not write for
            you, and without it the paragraph comes out as one unbroken run of
            Hebrew — which is exactly how it read the first time. */}
        <p className="d-feed-text" dir="rtl">
          {item.he.split(/\s+/).map((t, i) => (
            <Fragment key={i}>{i > 0 ? " " : null}<Word token={t} /></Fragment>
          ))}
        </p>

        <div className="d-feed-foot">
          <button className="d-btn" onClick={() => setN((x) => x + 1)}>
            <Shuffle size={15} /> Another
          </button>
          {/* CC BY-SA asks for the author and a route back, and the article is
              both — so it is a link and not a footnote. */}
          <a className="d-feed-src" href={article} target="_blank" rel="noreferrer noopener">
            {item.src} <ExternalLink size={12} />
          </a>
        </div>
        <p className="d-feed-licence">
          {state.index?.source} · {state.index?.license}
        </p>
      </div>
    </div>
  );
}
