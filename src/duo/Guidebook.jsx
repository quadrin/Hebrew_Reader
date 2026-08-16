/* The unit guidebook — key phrases, the words the unit teaches, and the grammar
   notes Duolingo wrote and then deleted from the app. Sixty-six of the
   eighty-four units still have their notes; the rest never had any. */

import { useState, useEffect } from "react";
import { X, Volume2, Loader, Dumbbell } from "lucide-react";

import { fetchUnit } from "./data.js";
import { playPhrase } from "./audio.js";
import { unitName } from "./unitNames.js";
import { skillArt } from "./skillArt.js";
import Markdown from "./md.jsx";

export default function Guidebook({ unit, onClose, onPractice }) {
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("phrases");
  const [hint, setHint] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let live = true;
    fetchUnit(unit.unit).then((d) => live && setDoc(d)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [unit.unit]);

  const tabs = [["phrases", "Key phrases"], ["sentences", "Sentences"], ["words", "Words"], ["notes", "Tips & notes"]];

  /* the bank is big enough that a unit's worth of it wants paging */
  const shown = doc ? doc.sentences.slice(0, page * 40) : [];

  return (
    <div className="d-sheet" onClick={onClose}>
      <div className="d-sheet-inner" onClick={(e) => e.stopPropagation()}>
        <div className="d-row" style={{ marginBottom: 6 }}>
          <div className="d-unit-badge">
            <span className="d-unit-icon" style={{ background: "var(--d-mute)", boxShadow: "none" }}>
              <span className="d-skill-art small" style={skillArt(unit.icon)} />
            </span>
            <span className="d-unit-name">{unitName(unit)}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div className="d-pill">UNIT {unit.unit} · {unit.cefr}</div>
            <div className="d-title" style={{ margin: "8px 0 2px" }}>{unit.objective || unit.skill}</div>
            <div className="d-sub">
              {unit.skill} · {unit.sentences ?? 0} sentences · {unit.phrases} key phrases · {unit.lexemes} words
            </div>
          </div>
          <button className="d-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <div className="d-tabs">
          {tabs.map(([id, label]) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {!doc && !err && <div className="d-center" style={{ padding: 30 }}><Loader className="spin" /></div>}
        {err && <div className="d-sub" style={{ padding: 16 }}>{err}</div>}

        {doc && tab === "phrases" && (
          <div style={{ marginTop: 14 }}>
            {doc.phrases.map((p, i) => (
              <div className="d-card" key={i}>
                <div className="d-row" style={{ alignItems: "flex-start" }}>
                  <button className="d-icon-btn" style={{ color: "var(--d-blue)", borderColor: "var(--d-blue)" }}
                    onClick={() => playPhrase(p.he, p.audio)} aria-label="Play">
                    <Volume2 size={18} />
                  </button>
                  <div style={{ flex: 1 }}>
                    <div className="d-prompt-he" dir="rtl" style={{ fontSize: 24 }}>
                      {p.he.split(/(\s+)/).map((w, k) => {
                        const clean = w.replace(/[.,!?;:"'׳״()]/g, "");
                        const t = p.tokens.find((x) => x.w === clean && x.h);
                        if (!t) return <span key={k}>{w}</span>;
                        return (
                          <span key={k} style={{ position: "relative", display: "inline-block" }}>
                            <span className="d-hint" onClick={() => setHint(hint === `${i}-${k}` ? null : `${i}-${k}`)}>{w}</span>
                            {hint === `${i}-${k}` && (
                              <span className="d-hint-pop" style={{ top: "100%", insetInlineStart: 0, marginTop: 3 }}>
                                {t.h.slice(0, 3).join(", ")}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                    <div className="d-sub" style={{ marginTop: 4 }}>{p.en}</div>
                  </div>
                </div>
              </div>
            ))}
            {!doc.phrases.length && <div className="d-sub">This unit's guidebook had no key phrases.</div>}
          </div>
        )}

        {doc && tab === "sentences" && (
          <div style={{ marginTop: 14 }}>
            <div className="d-sub" style={{ marginBottom: 10 }}>
              The sentences Duolingo serves in this unit, as harvested from its own session
              API. Tap a word for its meaning.
            </div>
            {shown.map((s, i) => (
              <div className="d-row" key={i} style={{ alignItems: "flex-start", padding: "9px 0", borderBottom: "1px solid var(--d-line)" }}>
                <button className="d-icon-btn" style={{ width: 32, height: 32, flexShrink: 0 }}
                  onClick={() => playPhrase(s.he, s.audio)} aria-label="Play">
                  <Volume2 size={14} />
                </button>
                <div style={{ flex: 1 }}>
                  <div className="d-prompt-he" dir="rtl" style={{ fontSize: 21 }}>
                    {s.he.split(/(\s+)/).map((w, k) => {
                      const bare = w.replace(/[^֐-׿]/g, "");
                      const h = doc.hints[bare];
                      if (!h) return <span key={k}>{w}</span>;
                      return (
                        <span key={k} style={{ position: "relative", display: "inline-block" }}>
                          <span className="d-hint" onClick={() => setHint(hint === `s${i}-${k}` ? null : `s${i}-${k}`)}>{w}</span>
                          {hint === `s${i}-${k}` && (
                            <span className="d-hint-pop" style={{ top: "100%", insetInlineStart: 0, marginTop: 3 }}>{h}</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                  <div className="d-sub" style={{ marginTop: 3 }}>
                    {s.en}
                    {s.alt?.length > 0 && <span style={{ opacity: .7 }}> · also: {s.alt[0]}</span>}
                  </div>
                </div>
                {s.audio && <span className="d-pill" style={{ flexShrink: 0 }}>audio</span>}
              </div>
            ))}
            {doc.sentences.length > shown.length && (
              <button className="d-btn ghost" style={{ marginTop: 12 }} onClick={() => setPage(page + 1)}>
                Show more ({doc.sentences.length - shown.length} left)
              </button>
            )}
            {!doc.sentences.length && <div className="d-sub">No sentences were recovered for this unit.</div>}
          </div>
        )}

        {doc && tab === "words" && (
          <div style={{ marginTop: 14 }}>
            {doc.words.map((w, i) => (
              <div className="d-row" key={i} style={{ padding: "8px 2px", borderBottom: "1px solid var(--d-line)" }}>
                <button className="d-icon-btn" onClick={() => playPhrase(w.he, "")} aria-label="Play"><Volume2 size={16} /></button>
                <span className="d-prompt-he" dir="rtl" style={{ fontSize: 22, flex: 1 }}>{w.he}</span>
                <span className="d-sub" style={{ flex: 1, textAlign: "end" }}>
                  {w.tr && <span style={{ opacity: .65, fontStyle: "italic" }}>{w.tr} · </span>}
                  {w.en}{w.alt?.length ? <span style={{ opacity: .7 }}> · {w.alt.slice(0, 2).join(", ")}</span> : null}
                </span>
              </div>
            ))}
            {doc.lexemes.length > doc.words.length && (
              <div className="d-sub" style={{ marginTop: 12 }}>
                The unit introduces {doc.lexemes.length} lexemes in all; {doc.words.length} of them came
                through the scrape with an English gloss attached.
              </div>
            )}
          </div>
        )}

        {doc && tab === "notes" && (
          <div style={{ marginTop: 14 }}>
            {doc.tips
              ? <Markdown text={doc.tips} />
              : <div className="d-sub">Duolingo never wrote Tips &amp; Notes for this skill.</div>}
          </div>
        )}

        <button className="d-btn" style={{ marginTop: 18 }} onClick={() => onPractice(unit)}>
          <Dumbbell size={17} /> Practice this unit
        </button>
      </div>
    </div>
  );
}
