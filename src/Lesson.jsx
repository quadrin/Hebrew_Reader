/* The lesson player.

   A lesson is two halves. The first teaches: prose, tables, letter cards,
   conjugation tables — whatever the syllabus said this lesson explains. The
   second tests, one exercise at a time, and tells you why straight away,
   because a quiz that only scores you teaches nothing.

   Six kinds of exercise. Multiple choice carries the load, but a lesson you
   can pass by elimination hasn't been learned, so every lesson with
   vocabulary also makes you hear a word, sound one out, and type one. */

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, Check, X, Volume2, Eye, ArrowRight, RotateCcw, Plus, Dumbbell } from "lucide-react";
import { speakOne, removeNikkud } from "./text.js";

const bare = (s) => removeNikkud(String(s || "")).replace(/[^֐-׿ ]/g, "").trim();

export default function Lesson({
  C, HEB_FONT, UI_FONT, lesson, onClose, onDone, onLearnWords, onPractice, next, onNext,
}) {
  const [phase, setPhase] = useState("teach");   /* teach | practice | done */
  const [i, setI] = useState(0);
  const [got, setGot] = useState(0);
  const [wrong, setWrong] = useState([]);
  const top = useRef(null);

  useEffect(() => { top.current?.scrollIntoView({ block: "start" }); }, [phase, i]);

  const ex = lesson.exercises[i];
  const total = lesson.exercises.length;

  const answer = (correct) => {
    if (correct) setGot((n) => n + 1);
    else setWrong((w) => [...w, i]);
  };

  const advance = () => {
    if (i + 1 < total) setI(i + 1);
    else {
      setPhase("done");
      onDone({ score: got, of: total });
    }
  };

  const restart = () => { setI(0); setGot(0); setWrong([]); setPhase("practice"); };

  /* ---------------- the teaching half ---------------- */
  const Section = ({ s }) => {
    if (s.type === "text") return <p style={{ fontSize: 14.5, lineHeight: 1.65, color: C.ink, margin: "0 0 12px" }}>{s.body}</p>;
    if (s.type === "tip") return (
      <div style={{ background: C.blueSoft, border: `1px solid ${C.blueLine}`, borderRadius: 12, padding: "10px 13px", fontSize: 13.5, lineHeight: 1.6, color: C.blue, margin: "0 0 12px" }}>
        {s.body}
      </div>
    );
    if (s.type === "letters") return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8, margin: "0 0 14px" }}>
        {s.items.map((x) => (
          <button key={x.l} onClick={() => speakOne(x.name)} style={{
            background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12,
            padding: "10px 6px", textAlign: "center", cursor: "pointer", fontFamily: UI_FONT, color: C.ink,
          }}>
            <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 34, lineHeight: 1.1 }}>{x.l}</div>
            {x.final && <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 18, color: C.sub }}>final {x.final}</div>}
            <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>{x.en}</div>
            <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.35, marginTop: 2 }}>{x.sound}</div>
          </button>
        ))}
      </div>
    );
    if (s.type === "vowels" || s.type === "vavvowels") return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, margin: "0 0 14px" }}>
        {s.items.map((v) => (
          <div key={v.en} style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
            <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 30, lineHeight: 1.2 }}>{v.on}</div>
            <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 14, color: C.sub, marginTop: 2 }}>{v.name}</div>
            <div style={{ fontSize: 12.5, marginTop: 3 }}>{v.sound}</div>
          </div>
        ))}
      </div>
    );
    if (s.type === "finals") return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8, margin: "0 0 14px" }}>
        {s.items.map((f) => (
          <div key={f.l} style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
            <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 28 }}>{f.l} → {f.final}</div>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3 }}>{f.en}</div>
          </div>
        ))}
      </div>
    );
    if (s.type === "dagesh" || s.type === "sinshin") return (
      <div style={{ margin: "0 0 14px" }}>
        {s.items.map((d) => (
          <div key={d.en} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "10px 13px", marginBottom: 6 }}>
            <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 26 }}>{d.hard || d.l}</span>
            <span style={{ flex: 1, fontSize: 13.5 }}>{d.sound}</span>
            {d.example && <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 17 }}>{d.example}</span>}
          </div>
        ))}
      </div>
    );
    if (s.type === "confuse") return (
      <div style={{ margin: "0 0 14px" }}>
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 6 }}>Watch these pairs — they're the ones that cost time.</div>
        {s.items.map(([a, b]) => (
          <div key={a.l + b.l} style={{ display: "flex", alignItems: "center", gap: 14, background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "10px 13px", marginBottom: 6 }}>
            <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 30 }}>{a.l}</span>
            <span style={{ fontSize: 12.5, color: C.sub }}>{a.en}</span>
            <span style={{ color: C.sub }}>vs</span>
            <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 30 }}>{b.l}</span>
            <span style={{ fontSize: 12.5, color: C.sub }}>{b.en}</span>
          </div>
        ))}
      </div>
    );
    if (s.type === "table") return (
      <div style={{ margin: "0 0 14px", overflowX: "auto" }}>
        {s.caption && <div style={{ fontSize: 12.5, fontWeight: 600, color: C.sub, marginBottom: 5 }}>{s.caption}</div>}
        <table style={{ borderCollapse: "collapse", width: "100%", background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, overflow: "hidden", fontSize: 14 }}>
          <thead>
            <tr>{s.head.map((h, k) => (
              <th key={k} style={{ textAlign: "start", padding: "8px 11px", fontSize: 12, color: C.sub, fontWeight: 600, borderBottom: `1px solid ${C.line}` }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {s.rows.map((r, k) => (
              <tr key={k}>{r.map((cell, j) => (
                <td key={j} style={{ padding: "8px 11px", borderTop: k ? `1px solid ${C.line}` : "none" }}>
                  <Cell text={cell} />
                </td>
              ))}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    if (s.type === "examples") return (
      <div style={{ margin: "0 0 14px" }}>
        {s.items.map((e, k) => (
          <button key={k} onClick={() => speakOne(e.he)} style={{
            display: "block", width: "100%", textAlign: "start", background: C.card,
            border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "10px 13px", marginBottom: 6,
            cursor: "pointer", fontFamily: UI_FONT, color: C.ink,
          }}>
            <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 18, lineHeight: 1.6 }}>{e.he}</div>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>{e.en}</div>
          </button>
        ))}
      </div>
    );
    if (s.type === "binyan") return (
      <div style={{ margin: "0 0 14px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 19, fontWeight: 700 }}>{s.he}</span>
          <span style={{ fontSize: 13, color: C.sub }}>{s.en} · {s.tense}</span>
          <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 15, color: C.sub }}>{s.verb.root}</span>
          <span style={{ fontSize: 13, color: C.sub }}>{s.verb.en}</span>
        </div>
        <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
          {s.rows.map((r, k) => (
            <button key={r.label} onClick={() => speakOne(r.form)} style={{
              display: "flex", alignItems: "baseline", gap: 10, width: "100%", textAlign: "start",
              background: "transparent", border: "none", borderTop: k ? `1px solid ${C.line}` : "none",
              padding: "8px 13px", cursor: "pointer", fontFamily: UI_FONT, color: C.ink,
            }}>
              <span style={{ fontSize: 12.5, color: C.sub, minWidth: 96 }}>{r.label}</span>
              {r.he && <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 15, color: C.sub, minWidth: 62 }}>{r.he}</span>}
              <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 19, fontWeight: 600, flex: 1, textAlign: "end" }}>{r.form}</span>
            </button>
          ))}
        </div>
      </div>
    );
    if (s.type === "passives") return (
      <div style={{ margin: "0 0 14px" }}>
        {s.items.map((p) => (
          <div key={p.id} style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "10px 13px", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 18, fontWeight: 700 }}>{p.he}</span>
              <span style={{ fontSize: 13, color: C.sub }}>{p.en} — {p.note}</span>
            </div>
            <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 18, marginTop: 6 }}>
              {p.present.ms} · {p.past["3ms"]} · {p.future["3ms"]}
            </div>
          </div>
        ))}
      </div>
    );
    if (s.type === "weak") return (
      <div style={{ margin: "0 0 14px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 18, fontWeight: 700 }}>{s.item.he}</span>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.item.en}</span>
        </div>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.55, marginBottom: 6 }}>{s.item.why}</div>
        <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
          {s.item.forms.map((f, k) => (
            <div key={f.he + k} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "8px 13px", borderTop: k ? `1px solid ${C.line}` : "none" }}>
              <span style={{ fontSize: 12.5, color: C.sub, minWidth: 100 }}>{f.label}</span>
              <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 18, fontWeight: 600 }}>{f.he}</span>
              {f.note && <span style={{ fontSize: 12, color: C.sub, flex: 1, textAlign: "end" }}>{f.note}</span>}
            </div>
          ))}
        </div>
      </div>
    );
    return null;
  };

  /* Table cells are written "Hebrew — gloss"; render each part in its own
     direction so the dash doesn't jump to the wrong end of the line. */
  const Cell = ({ text }) => {
    const [he, en] = String(text).split(" — ");
    const isHe = /[֐-׿]/.test(he);
    return (
      <>
        <span dir={isHe ? "rtl" : "ltr"} style={isHe ? { fontFamily: HEB_FONT, fontSize: 17 } : undefined}>{he}</span>
        {en && <span style={{ color: C.sub, fontSize: 13 }}> — {en}</span>}
      </>
    );
  };

  if (phase === "teach") {
    return (
      <main style={{ paddingTop: 14 }} aria-label={`Lesson: ${lesson.title}`}>
        <span ref={top} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <button className="icon-btn" onClick={onClose} aria-label="Back to the course"><ChevronLeft size={20} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, color: C.sub, fontWeight: 600 }}>{lesson.levelName} · lesson {lesson.n} of {lesson.of}</div>
            <div style={{ fontWeight: 700, fontSize: 19, lineHeight: 1.25 }}>{lesson.title}</div>
          </div>
          <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 16, color: C.sub, flexShrink: 0 }}>{lesson.titleHe}</span>
        </div>

        <div style={{ paddingBottom: 24 }}>
          <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.55, marginBottom: 16 }}>{lesson.goal}</div>

          {lesson.sections.map((s, k) => <Section key={k} s={s} />)}

          {lesson.vocab.length > 0 && (
            <>
              <div className="field-label" style={{ marginTop: 20 }}>Words in this lesson</div>
              <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
                {lesson.vocab.map((w, k) => (
                  <button key={w.he + k} onClick={() => speakOne(w.he)} style={{
                    display: "flex", alignItems: "baseline", gap: 12, width: "100%", textAlign: "start",
                    background: "transparent", border: "none", borderTop: k ? `1px solid ${C.line}` : "none",
                    padding: "9px 14px", cursor: "pointer", fontFamily: UI_FONT, color: C.ink,
                  }}>
                    <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 19, fontWeight: 600, minWidth: 104 }}>{w.he}</span>
                    <span style={{ flex: 1, fontSize: 14 }}>{w.en}</span>
                    <span style={{ fontSize: 12, color: C.sub }}>{w.translit}</span>
                    <Volume2 size={14} color={C.sub} style={{ flexShrink: 0 }} />
                  </button>
                ))}
              </div>
              <button className="ghost-btn" style={{ marginTop: 10 }} onClick={() => onLearnWords(lesson.vocab)}>
                <Plus size={15} /> Add these {lesson.vocab.length} words to My Words
              </button>
            </>
          )}

          <button className="primary-btn" style={{ marginTop: 22 }} onClick={() => setPhase("practice")}>
            Practise — {total} exercises <ArrowRight size={16} />
          </button>
        </div>
      </main>
    );
  }

  if (phase === "done") {
    const pct = Math.round((got / total) * 100);
    const good = pct >= 80;
    return (
      <main style={{ paddingTop: 14 }} aria-label="Lesson complete">
        <span ref={top} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <button className="icon-btn" onClick={onClose} aria-label="Back to the course"><ChevronLeft size={20} /></button>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 19 }}>{lesson.title}</div>
        </div>
        <div style={{
          background: good ? C.greenSoft : C.soft, borderRadius: 16, padding: 20, textAlign: "center",
          color: good ? C.green : C.ink,
        }}>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{got}<span style={{ fontSize: 20, opacity: 0.6 }}> / {total}</span></div>
          <div style={{ fontSize: 14, marginTop: 4 }}>
            {good ? "That's the lesson learned." : pct >= 50 ? "Most of it landed — worth another run." : "Worth going back over the lesson."}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, paddingBottom: 24 }}>
          {lesson.vocab.length > 0 && (
            <button className="ghost-btn" onClick={() => onLearnWords(lesson.vocab)}>
              <Plus size={15} /> Add these {lesson.vocab.length} words to My Words
            </button>
          )}
          <button className="ghost-btn" onClick={restart}><RotateCcw size={15} /> Practise again</button>
          {lesson.vocab.length > 0 && (
            <button className="ghost-btn" onClick={() => onPractice(lesson.vocab)}>
              <Dumbbell size={15} /> Review these words as flashcards
            </button>
          )}
          <button className="ghost-btn" onClick={() => setPhase("teach")}>Read the lesson again</button>
          {next && (
            <button className="primary-btn" onClick={() => onNext(next)}>
              Next: {next.title} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </main>
    );
  }

  /* ---------------- practice ---------------- */
  return (
    <main style={{ paddingTop: 14 }} aria-label="Lesson practice">
      <span ref={top} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button className="icon-btn" onClick={() => setPhase("teach")} aria-label="Back to the lesson"><ChevronLeft size={20} /></button>
        <div style={{ flex: 1, height: 8, background: C.soft, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.round((i / total) * 100)}%`, background: C.green, transition: "width .3s" }} />
        </div>
        <span style={{ fontSize: 12.5, color: C.sub, fontVariantNumeric: "tabular-nums" }}>{i + 1}/{total}</span>
      </div>
      <div style={{ paddingBottom: 24 }}>
        <Exercise
          key={i} ex={ex} C={C} HEB_FONT={HEB_FONT} UI_FONT={UI_FONT}
          onAnswer={answer} onNext={advance} last={i + 1 === total}
        />
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* one exercise                                                        */
/* ------------------------------------------------------------------ */

function Exercise({ ex, C, HEB_FONT, UI_FONT, onAnswer, onNext, last }) {
  const [picked, setPicked] = useState(null);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [matched, setMatched] = useState({});      /* he → en, as pairs are made */
  const [pickedHe, setPickedHe] = useState(null);
  const [miss, setMiss] = useState(null);
  const [built, setBuilt] = useState([]);
  const done = picked !== null;

  /* Spoken exercises play as soon as they appear — the whole point is to hear
     it before seeing it. */
  useEffect(() => {
    if (ex.type === "listen") speakOne(ex.say, { rate: 0.8 });
  }, [ex]);

  const settle = (ok) => { setPicked(ok); onAnswer(ok); };

  const Next = () => (
    <button className="primary-btn" style={{ marginTop: 16 }} onClick={onNext}>
      {last ? "Finish" : "Next"} <ArrowRight size={16} />
    </button>
  );

  const Verdict = ({ ok, why }) => (
    <div style={{
      display: "flex", gap: 8, alignItems: "flex-start", marginTop: 14, borderRadius: 12,
      padding: "10px 13px", fontSize: 13.5, lineHeight: 1.55,
      background: ok ? C.greenSoft : C.redSoft, color: ok ? C.green : C.red,
    }}>
      {ok ? <Check size={16} strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} /> : <X size={16} strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} />}
      <span>{ok ? "Right." : "Not quite."} {why}</span>
    </div>
  );

  /* ---- multiple choice, including the listening variant ---- */
  if (ex.type === "choice" || ex.type === "listen") {
    return (
      <div>
        {ex.type === "listen" ? (
          <button className="ghost-btn" style={{ width: "auto", padding: "0 18px", height: 56 }} onClick={() => speakOne(ex.say, { rate: 0.8 })}>
            <Volume2 size={22} /> Play again
          </button>
        ) : ex.prompt ? (
          <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 52, textAlign: "center", lineHeight: 1.3, margin: "8px 0 4px" }}>
            {ex.prompt}
          </div>
        ) : null}
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.45, margin: "12px 0 14px" }}>{ex.q}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ex.options.map((o, k) => {
            const isRight = k === ex.correct;
            const show = done && (isRight || k === picked?.k);
            return (
              <button
                key={k}
                disabled={done}
                onClick={() => { setPicked({ k, ok: isRight }); onAnswer(isRight); }}
                style={{
                  background: show ? (isRight ? C.greenSoft : C.redSoft) : C.card,
                  border: `1.5px solid ${show ? (isRight ? C.green : C.red) : C.line}`,
                  color: show ? (isRight ? C.green : C.red) : C.ink,
                  borderRadius: 12, padding: "12px 14px", textAlign: ex.he ? "center" : "start",
                  cursor: done ? "default" : "pointer", fontFamily: ex.he ? HEB_FONT : UI_FONT,
                  fontSize: ex.he ? 22 : 15, direction: ex.he ? "rtl" : "ltr", width: "100%",
                }}
              >{o}</button>
            );
          })}
        </div>
        {done && <Verdict ok={picked.ok} why={picked.ok ? (ex.why || "") : (ex.why || `The answer is ${ex.options[ex.correct]}.`)} />}
        {done && <Next />}
      </div>
    );
  }

  /* ---- fill the gap in a real sentence ---- */
  if (ex.type === "cloze") {
    return (
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Which word belongs in the gap?</div>
        <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 14, padding: "16px 14px" }}>
          <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 22, lineHeight: 1.8, textAlign: "center" }}>
            {done ? ex.full : ex.sentence}
          </div>
          <div style={{ fontSize: 13.5, color: C.sub, marginTop: 8, textAlign: "center" }}>{ex.en}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {ex.options.map((o, k) => {
            const isRight = k === ex.correct;
            const show = done && (isRight || k === picked?.k);
            return (
              <button key={k} disabled={done} onClick={() => { setPicked({ k, ok: isRight }); onAnswer(isRight); }}
                style={{
                  background: show ? (isRight ? C.greenSoft : C.redSoft) : C.card,
                  border: `1.5px solid ${show ? (isRight ? C.green : C.red) : C.line}`,
                  color: show ? (isRight ? C.green : C.red) : C.ink,
                  borderRadius: 12, padding: "12px 14px", textAlign: "center",
                  cursor: done ? "default" : "pointer", fontFamily: HEB_FONT,
                  fontSize: 21, direction: "rtl", width: "100%",
                }}>{o}</button>
            );
          })}
        </div>
        {done && (
          <>
            <Verdict ok={picked.ok} why={picked.ok ? "" : <>It's <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 19 }}>{ex.options[ex.correct]}</span>.</>} />
            <button className="ghost-btn" style={{ marginTop: 10 }} onClick={() => speakOne(ex.full)}>
              <Volume2 size={15} /> Hear the sentence
            </button>
            <Next />
          </>
        )}
      </div>
    );
  }

  /* ---- sound it out, then check yourself ---- */
  if (ex.type === "read") {
    return (
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Sound this out.</div>
        <button onClick={() => speakOne(ex.he)} style={{
          width: "100%", background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 16,
          padding: "24px 12px", cursor: "pointer", fontFamily: UI_FONT, color: C.ink,
        }}>
          <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 44, lineHeight: 1.35 }}>{ex.he}</div>
          {revealed && (
            <>
              <div style={{ fontSize: 17, marginTop: 10, fontWeight: 600 }}>{ex.translit}</div>
              <div style={{ fontSize: 14, color: C.sub, marginTop: 2 }}>{ex.en}</div>
            </>
          )}
        </button>
        {!revealed ? (
          <button className="ghost-btn" style={{ marginTop: 12 }} onClick={() => { setRevealed(true); speakOne(ex.he); }}>
            <Eye size={15} /> Show me
          </button>
        ) : !done ? (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="ghost-btn" style={{ flex: 1 }} onClick={() => settle(false)}>Not yet</button>
            <button className="primary-btn" style={{ flex: 1 }} onClick={() => settle(true)}>I read it</button>
          </div>
        ) : <Next />}
      </div>
    );
  }

  /* ---- type it, ignoring vowel marks ---- */
  if (ex.type === "type") {
    const ok = bare(typed) === bare(ex.answer);
    return (
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.45, marginBottom: 4 }}>{ex.q}</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 12 }}>Sounds like “{ex.hint}”. Vowel marks aren't needed.</div>
        <input
          className="text-input" dir="rtl" lang="he" autoFocus
          style={{ width: "100%", fontFamily: HEB_FONT, fontSize: 22, textAlign: "center" }}
          value={typed} onChange={(e) => setTyped(e.target.value)} disabled={done}
          onKeyDown={(e) => { if (e.key === "Enter" && !done && typed.trim()) settle(ok); }}
          aria-label="Type the Hebrew"
        />
        {!done ? (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="ghost-btn" style={{ flex: 1 }} onClick={() => settle(false)}>Show me</button>
            <button className="primary-btn" style={{ flex: 1 }} disabled={!typed.trim()} onClick={() => settle(ok)}>Check</button>
          </div>
        ) : (
          <>
            <Verdict ok={picked} why={<>The answer is <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 19 }}>{ex.answer}</span>.</>} />
            <Next />
          </>
        )}
      </div>
    );
  }

  /* ---- pair them up ---- */
  if (ex.type === "match") {
    const hes = ex.pairs.map((p) => p[0]);
    const ens = ex.pairs.map((p) => p[1]).slice().sort();
    const allDone = Object.keys(matched).length === ex.pairs.length;
    const pick = (en) => {
      if (!pickedHe) return;
      const right = ex.pairs.find((p) => p[0] === pickedHe)?.[1] === en;
      if (right) {
        const next = { ...matched, [pickedHe]: en };
        setMatched(next);
        setPickedHe(null);
        if (Object.keys(next).length === ex.pairs.length) { setPicked(picked !== false); onAnswer(picked !== false); }
      } else {
        /* A wrong pair used to just deselect, which reads as a dead tap.
           Flash it instead, and remember the miss so the exercise isn't
           scored as correct once every pair is eventually found. */
        setMiss(en);
        setTimeout(() => setMiss(null), 500);
        setPickedHe(null);
        if (picked === null) setPicked(false);
      }
    };
    return (
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Match each word to its meaning.</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 14 }}>
          Tap a Hebrew word, then its meaning. {Object.keys(matched).length} of {ex.pairs.length} paired.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div role="group" aria-label="Hebrew words" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {hes.map((he) => {
              const taken = matched[he];
              return (
                <button key={he} disabled={!!taken} onClick={() => setPickedHe(he)} style={{
                  background: taken ? C.greenSoft : pickedHe === he ? C.blueSoft : C.card,
                  border: `1.5px solid ${taken ? C.green : pickedHe === he ? C.blue : C.line}`,
                  color: taken ? C.green : C.ink, borderRadius: 12, padding: "11px 8px",
                  fontFamily: HEB_FONT, fontSize: 19, direction: "rtl", cursor: taken ? "default" : "pointer",
                }}>{he}</button>
              );
            })}
          </div>
          <div role="group" aria-label="Meanings" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {ens.map((en) => {
              const taken = Object.values(matched).includes(en);
              const bad = miss === en;
              return (
                <button key={en} disabled={taken} onClick={() => pick(en)} style={{
                  background: taken ? C.greenSoft : bad ? C.redSoft : C.card,
                  border: `1.5px solid ${taken ? C.green : bad ? C.red : C.line}`,
                  color: taken ? C.green : bad ? C.red : C.ink, borderRadius: 12, padding: "11px 8px",
                  fontFamily: UI_FONT, fontSize: 14, cursor: taken ? "default" : "pointer",
                  transition: "background .15s, border-color .15s",
                }}>{en}</button>
              );
            })}
          </div>
        </div>
        {allDone && <Verdict ok={picked !== false} why={picked === false ? "You got there, but not first time." : "All matched."} />}
        {allDone && <Next />}
      </div>
    );
  }

  /* ---- tap the words into order ---- */
  if (ex.type === "build") {
    /* indices, not tokens — the tray is rendered by checking membership
       against the same index list `built` holds, and two words in one
       sentence can be identical */
    const left = ex.tokens.map((_, k) => k).filter((k) => !built.includes(k));
    const check = () => {
      const said = built.map((k) => ex.tokens[k]);
      settle(said.join(" ") === ex.answer.join(" "));
    };
    return (
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Put this into Hebrew.</div>
        <div style={{ fontSize: 14, color: C.sub, marginBottom: 14 }}>“{ex.en}”</div>
        <div dir="rtl" lang="he" style={{
          minHeight: 58, background: C.soft, borderRadius: 12, padding: 8, display: "flex",
          flexWrap: "wrap", gap: 6, alignContent: "flex-start", marginBottom: 12,
        }}>
          {built.map((k, pos) => (
            <button key={pos} onClick={() => !done && setBuilt(built.filter((_, p) => p !== pos))} style={{
              background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 10,
              padding: "7px 12px", fontFamily: HEB_FONT, fontSize: 19, cursor: done ? "default" : "pointer", color: C.ink,
            }}>{ex.tokens[k]}</button>
          ))}
        </div>
        <div dir="rtl" lang="he" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ex.tokens.map((t, k) => left.includes(k) && (
            <button key={k} onClick={() => !done && setBuilt([...built, k])} style={{
              background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 10,
              padding: "7px 12px", fontFamily: HEB_FONT, fontSize: 19, cursor: "pointer", color: C.ink,
            }}>{t}</button>
          ))}
        </div>
        {!done ? (
          <button className="primary-btn" style={{ marginTop: 16 }} disabled={built.length !== ex.tokens.length} onClick={check}>Check</button>
        ) : (
          <>
            <Verdict ok={picked} why={<><span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 19 }}>{ex.answer.join(" ")}</span></>} />
            <Next />
          </>
        )}
      </div>
    );
  }

  return null;
}
