/* Course — a graded path through the corpus. Unit N teaches the next band of
   the frequency ranking and pairs it with a passage chosen to be almost
   readable with what you've been taught so far. The vocabulary goes into the
   same spaced-repetition store as tapped words, and the reading opens in the
   reader as an ordinary book. */

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Loader, BookOpen, Check, Plus } from "lucide-react";
import { fetchCourseIndex, fetchCourseUnit } from "./library.js";

export default function CourseScreen({ C, HEB_FONT, UI_FONT, onImport, onLearnWords, knownCount }) {
  const [index, setIndex] = useState(null);
  const [err, setErr] = useState("");
  const [level, setLevel] = useState(1);
  const [unit, setUnit] = useState(null);       /* the opened unit's full data */
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!index) {
      fetchCourseIndex().then(setIndex).catch((e) => setErr(e.message || "couldn't read the course"));
    }
  }, []);

  const openUnit = async (n) => {
    setLoading(true);
    setErr("");
    setAdded(false);
    try {
      setUnit(await fetchCourseUnit(n));
    } catch (e) {
      setErr(e.message || "couldn't open that unit");
    } finally {
      setLoading(false);
    }
  };

  const readPassage = () => {
    if (!unit) return;
    onImport({
      title: `Unit ${unit.n} · ${unit.reading.title}`,
      chapters: null,
      text: unit.reading.text,
      src: unit.src,
    });
  };

  const learnWords = () => {
    onLearnWords(unit.words.filter((w) => w.he));
    setAdded(true);
  };

  const levelColor = (l) => ({ ink: C.lvInk[l - 1], bg: C.lvBg[l - 1] });

  /* ---------------- one unit ---------------- */
  if (unit) {
    const { ink, bg } = levelColor(unit.level);
    return (
      <main style={{ paddingTop: 14 }} aria-label="Course unit">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <button className="icon-btn" onClick={() => setUnit(null)} aria-label="Back to the course"><ChevronLeft size={20} /></button>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 20 }}>Unit {unit.n}</div>
          <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: bg, color: ink }}>
            {unit.levelName}
          </span>
        </div>

        <div style={{ paddingBottom: 24 }}>
          <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.55 }}>
            {unit.words.length} new words, bringing you to {unit.knownAfter} of the commonest Hebrew words.
            The reading below is {unit.reading.coverage}% built from words at or before this unit.
          </div>

          <div className="field-label" style={{ marginTop: 18 }}>New words</div>
          <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
            {unit.words.map((w, i) => (
              <div key={w.he} style={{
                display: "flex", alignItems: "baseline", gap: 12, padding: "9px 14px",
                borderTop: i ? `1px solid ${C.line}` : "none",
              }}>
                <span dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 19, fontWeight: 600, minWidth: 96 }}>{w.he}</span>
                <span style={{ flex: 1, fontSize: 14, color: C.ink }}>{w.en || <span style={{ color: C.sub }}>tap it in the reading to look it up</span>}</span>
                {w.pos && <span style={{ fontSize: 11.5, color: C.sub }}>{w.pos}</span>}
              </div>
            ))}
          </div>

          <button className="primary-btn" style={{ marginTop: 12 }} onClick={learnWords} disabled={added}>
            {added ? <><Check size={16} /> Added to your words</> : <><Plus size={16} /> Learn these {unit.words.length} words</>}
          </button>

          <div className="field-label" style={{ marginTop: 22 }}>Reading</div>
          <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
            <div dir="rtl" style={{ fontFamily: HEB_FONT, fontWeight: 600, fontSize: 16.5 }}>{unit.reading.title}</div>
            <div dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 13, color: C.sub, marginTop: 2 }}>{unit.reading.author}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <span className="chip" style={{ background: bg, color: ink, border: "none", fontWeight: 600 }}>{unit.reading.coverage}% familiar</span>
              <span className="chip">{unit.reading.words} words</span>
              <span className="chip">{unit.reading.genre}</span>
            </div>
            <div dir="rtl" style={{
              fontFamily: HEB_FONT, fontSize: 15, color: C.sub, marginTop: 10, lineHeight: 1.7,
              display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {unit.reading.text}
            </div>
            <button className="primary-btn" style={{ marginTop: 12 }} onClick={readPassage}>
              <BookOpen size={16} /> Read it in the reader
            </button>
          </div>

          <div style={{ fontSize: 12, color: C.sub, marginTop: 16, lineHeight: 1.5, opacity: 0.85 }}>
            {unit.src?.name} · {unit.src?.license} · digitised by {unit.src?.credit}
          </div>
        </div>
      </main>
    );
  }

  /* ---------------- the unit list ---------------- */
  const units = (index?.units || []).filter((u) => u.level === level);
  return (
    <main style={{ paddingTop: 18 }} aria-label="Hebrew course">
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Hebrew course</div>
      <div>
        <div>
          <div style={{ display: "flex", gap: 6, margin: "10px 0 14px", flexWrap: "wrap" }}>
            {(index?.levels || []).map((l) => (
              <button
                key={l.level}
                className="chip"
                onClick={() => setLevel(l.level)}
                style={{
                  border: `1.5px solid ${level === l.level ? C.lvInk[l.level - 1] : C.line}`,
                  background: level === l.level ? C.lvBg[l.level - 1] : C.card,
                  color: level === l.level ? C.lvInk[l.level - 1] : C.sub,
                  borderRadius: 999, padding: "5px 11px", fontSize: 12.5,
                  fontWeight: level === l.level ? 600 : 500, fontFamily: UI_FONT, cursor: "pointer",
                }}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ paddingBottom: 24 }}>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
          Sixty units built from the corpus itself: each teaches the next most useful band of words and
          pairs it with a real passage you can almost already read. It runs from your first words to
          literary prose — {index?.vocabulary || "2,000+"} words in all.
          {knownCount > 0 && ` You already know ${knownCount}.`}
        </div>

        {err && (
          <div style={{ marginTop: 12, fontSize: 13.5, color: C.sub, lineHeight: 1.5 }}>
            The course isn't available in this build ({err}). The shelf and the libraries still work.
          </div>
        )}
        {!index && !err && (
          <div style={{ textAlign: "center", padding: "22px 0" }}><Loader size={20} color={C.blue} className="spin" /></div>
        )}
        {loading && (
          <div style={{ textAlign: "center", padding: "14px 0" }}><Loader size={18} color={C.blue} className="spin" /></div>
        )}

        {units.map((u) => (
          <button
            key={u.n}
            onClick={() => openUnit(u.n)}
            style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%", background: C.card,
              border: `1.5px solid ${C.line}`, borderRadius: 14, padding: "12px 14px", marginTop: 8,
              cursor: "pointer", textAlign: "left", fontFamily: UI_FONT, color: C.ink,
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: "flex",
              alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15,
              background: C.lvBg[u.level - 1], color: C.lvInk[u.level - 1],
            }}>{u.n}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{u.newWords} new words</div>
              <div dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 13.5, color: C.sub, marginTop: 2 }}>{u.title}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                <span className="chip" style={{ background: C.lvBg[u.level - 1], color: C.lvInk[u.level - 1], border: "none", fontWeight: 600, fontSize: 11.5, padding: "2px 8px" }}>
                  {u.coverage}% familiar
                </span>
                <span className="chip" style={{ fontSize: 11.5, padding: "2px 8px" }}>{u.knownAfter} words known</span>
                <span className="chip" style={{ fontSize: 11.5, padding: "2px 8px" }}>{u.minutes} min</span>
              </div>
            </div>
            <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
          </button>
        ))}

        {index && (
          <div style={{ fontSize: 12, color: C.sub, marginTop: 16, lineHeight: 1.5, opacity: 0.85 }}>
            Readings are public domain, digitised by {index.credit}
            {index.version ? ` · dump ${index.version}` : ""}
          </div>
        )}
      </div>
    </main>
  );
}
