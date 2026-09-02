/* The unit-closing passage, on screen.

   Read first, then answer — the questions stay hidden until the text has been
   read through, because a comprehension question visible from the start turns
   reading into scanning for the answer.

   English is per line and hidden by default. A learner who reveals every line
   immediately has still read the Hebrew first, which is the whole difference
   between this and a translation exercise; one who reveals none has read a
   paragraph of Hebrew, which is the thing the course never otherwise asks for.
*/

import { useState } from "react";
import { X, Check, Eye, Volume2 } from "lucide-react";

import { playPhrase } from "./audio.js";

export default function Passage({ passage, unit, onClose, onDone }) {
  const [shown, setShown] = useState({});      /* line index -> English revealed */
  const [read, setRead] = useState(false);     /* moved on to the questions */
  const [picked, setPicked] = useState({});    /* question index -> option */

  const lines = passage.lines || [];
  const questions = passage.questions || [];
  const answered = questions.filter((_, i) => picked[i] !== undefined).length;
  const right = questions.filter((q, i) => picked[i] === q.correct).length;
  const allDone = answered === questions.length;

  return (
    <div className="duo d-passage-wrap">
      <div className="d-passage-bar">
        <button className="d-icon-btn" onClick={onClose} aria-label="Close the story"><X size={20} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{passage.titleEn}</div>
          <div className="d-sub" style={{ fontSize: 12.5 }}>Unit {unit} · {passage.blurb}</div>
        </div>
      </div>

      <div className="d-passage">
        <h2 className="d-passage-title" dir="rtl" lang="he">{passage.title}</h2>

        {lines.map((l, i) => (
          <div key={i} className="d-passage-line">
            {l.who && <div className="d-passage-who" dir="rtl" lang="he">{l.who}</div>}
            <div className="d-passage-he" dir="rtl" lang="he">
              <span style={{ flex: 1 }}>{l.he}</span>
              <button
                className="d-passage-say"
                onClick={() => playPhrase(l.he)}
                aria-label="Read this line aloud"
              ><Volume2 size={16} /></button>
            </div>
            {shown[i]
              ? <div className="d-passage-en">{l.en}</div>
              : (
                <button className="d-passage-reveal" onClick={() => setShown((p) => ({ ...p, [i]: true }))}>
                  <Eye size={13} /> English
                </button>
              )}
          </div>
        ))}

        {!read && questions.length > 0 && (
          <button className="d-btn" style={{ marginTop: 22 }} onClick={() => setRead(true)}>
            I've read it
          </button>
        )}

        {read && (
          <div style={{ marginTop: 26 }}>
            <div className="d-title" style={{ fontSize: 18 }}>Did you follow it?</div>
            {questions.map((q, qi) => {
              const chose = picked[qi];
              return (
                <div key={qi} className="d-card" style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{q.q}</div>
                  {q.opts.map((o, oi) => {
                    const isChosen = chose === oi;
                    const isRight = oi === q.correct;
                    const state = chose === undefined ? "" : isRight ? "ok" : isChosen ? "no" : "";
                    return (
                      <button
                        key={oi}
                        className={`d-option ${state}`}
                        style={{ marginBottom: 6, width: "100%" }}
                        disabled={chose !== undefined}
                        onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                      >
                        {o}
                        {chose !== undefined && isRight && <Check size={16} style={{ marginInlineStart: 8 }} />}
                      </button>
                    );
                  })}
                  {chose !== undefined && q.ev && (
                    <div className="d-sub" style={{ marginTop: 6 }}>
                      In the text: <span dir="rtl" lang="he" style={{ fontWeight: 700 }}>{q.ev}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {allDone && (
              <div style={{ marginTop: 20, textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 20 }}>
                  {right} of {questions.length} right
                </div>
                <button className="d-btn" style={{ marginTop: 12 }} onClick={() => onDone?.(right, questions.length)}>
                  Done
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
