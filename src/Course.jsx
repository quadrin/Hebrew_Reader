/* Course — a graded path through the corpus. Unit N teaches the next band of
   the frequency ranking and pairs it with a passage chosen to be almost
   readable with what you've been taught so far. The vocabulary goes into the
   same spaced-repetition store as tapped words, and the reading opens in the
   reader as an ordinary book.

   The screen is built around where you are in it, not around the sixty units
   as a list: a course you can't find your place in is a catalogue. So the top
   of the screen is your progress and the one unit to do next, each unit is
   three steps you tick off, and finishing one offers the next. */

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Loader, BookOpen, Check, Plus, Dumbbell, ArrowRight } from "lucide-react";
import { fetchCourseIndex, fetchCourseUnit } from "./library.js";
import { useEnglishTitles } from "./titles.js";

export default function CourseScreen({
  C, HEB_FONT, UI_FONT, onImport, onLearnWords, onPractice,
  progress, onUnitProgress, translateTitles,
}) {
  const [index, setIndex] = useState(null);
  const [err, setErr] = useState("");
  const [level, setLevel] = useState(null);
  const [unit, setUnit] = useState(null);       /* the opened unit's full data */
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!index) {
      fetchCourseIndex().then(setIndex).catch((e) => setErr(e.message || "couldn't read the course"));
    }
  }, []);

  const done = (n) => !!progress?.[n]?.learned;
  const units = index?.units || [];
  /* The next thing to do is the first unit whose words you haven't taken —
     everything on this screen is arranged around it. */
  const next = units.find((u) => !done(u.n)) || null;

  /* Open on the band you're actually in, not always at the beginning */
  useEffect(() => {
    if (level === null && next) setLevel(next.level);
  }, [next, level]);

  const openUnit = async (n) => {
    setLoading(true);
    setErr("");
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
    onUnitProgress(unit.n, { read: true });
    onImport({
      title: `Unit ${unit.n} · ${unit.reading.title}`,
      chapters: null,
      text: unit.reading.text,
      src: unit.src,
    });
  };

  const learnWords = () => {
    onLearnWords(unit.words.filter((w) => w.he));
    onUnitProgress(unit.n, { learned: true });
  };

  const levelColor = (l) => ({ ink: C.lvInk[l - 1], bg: C.lvBg[l - 1] });

  /* Ask for the whole course's titles at once rather than a level at a time,
     so switching bands doesn't stall. Anything the build already translated
     is skipped. */
  const en = useEnglishTitles(units.filter((u) => !u.titleEn).map((u) => u.title), translateTitles);
  const titleEn = (u) => u?.titleEn || en(u?.title);

  /* ---------------- one unit ---------------- */
  if (unit) {
    const { ink, bg } = levelColor(unit.level);
    const state = progress?.[unit.n] || {};
    const after = units.find((u) => u.n === unit.n + 1);

    const Step = ({ n, title, ticked, children }) => (
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{
            width: 22, height: 22, borderRadius: 999, flexShrink: 0, display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700,
            background: ticked ? C.green : C.soft, color: ticked ? "#fff" : C.sub,
          }}>{ticked ? <Check size={13} strokeWidth={3} /> : n}</span>
          <span style={{ fontWeight: 600, fontSize: 14.5 }}>{title}</span>
        </div>
        {children}
      </div>
    );

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
          </div>

          <Step n={1} title={`Learn ${unit.words.length} words`} ticked={state.learned}>
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
            <button className="primary-btn" style={{ marginTop: 10 }} onClick={learnWords} disabled={state.learned}>
              {state.learned ? <><Check size={16} /> Added to your words</> : <><Plus size={16} /> Learn these {unit.words.length} words</>}
            </button>
          </Step>

          <Step n={2} title="Read the passage" ticked={state.read}>
            <div style={{ background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
              <div dir="rtl" style={{ fontFamily: HEB_FONT, fontWeight: 600, fontSize: 16.5 }}>{unit.reading.title}</div>
              {titleEn(unit.reading) && (
                <div dir="ltr" style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{titleEn(unit.reading)}</div>
              )}
              {/* the separator stays in the ltr run — inside the rtl span it
                  renders on the far side of the Hebrew name */}
              <div dir="ltr" style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
                {unit.reading.authorEn}
                {unit.reading.authorEn && unit.reading.author ? " · " : ""}
                <span dir="rtl" style={{ fontFamily: HEB_FONT }}>{unit.reading.author}</span>
              </div>
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
          </Step>

          <Step n={3} title="Practise what you learned" ticked={false}>
            <button className="ghost-btn" onClick={() => onPractice(unit.words.filter((w) => w.he))} disabled={!state.learned}>
              <Dumbbell size={15} /> Review these {unit.words.length} words
            </button>
            {!state.learned && (
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>Take the words in step 1 first.</div>
            )}
          </Step>

          {after && (
            <button className="primary-btn" style={{ marginTop: 24 }} onClick={() => { setUnit(null); openUnit(after.n); }}>
              Next: unit {after.n} <ArrowRight size={16} />
            </button>
          )}

          <div style={{ fontSize: 12, color: C.sub, marginTop: 16, lineHeight: 1.5, opacity: 0.85 }}>
            {unit.src?.name} · {unit.src?.license} · digitised by {unit.src?.credit}
          </div>
        </div>
      </main>
    );
  }

  /* ---------------- the course ---------------- */
  const doneCount = units.filter((u) => done(u.n)).length;
  const wordsDone = units.filter((u) => done(u.n)).reduce((s, u) => s + u.newWords, 0);
  const shown = units.filter((u) => u.level === (level ?? 1));

  const UnitRow = ({ u, highlight }) => (
    <button
      onClick={() => openUnit(u.n)}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%",
        background: highlight ? C.blueSoft : C.card,
        border: `1.5px solid ${highlight ? C.blueLine : C.line}`,
        borderRadius: 14, padding: "12px 14px", marginTop: 8,
        cursor: "pointer", textAlign: "left", fontFamily: UI_FONT, color: C.ink,
        opacity: done(u.n) ? 0.72 : 1,
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: "flex",
        alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15,
        background: done(u.n) ? C.green : C.lvBg[u.level - 1],
        color: done(u.n) ? "#fff" : C.lvInk[u.level - 1],
      }}>{done(u.n) ? <Check size={19} strokeWidth={3} /> : u.n}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* what you'd actually be reading — in English first, since a learner
            picking a unit can't yet read the Hebrew line */}
        {titleEn(u) ? (
          <div dir="ltr" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{titleEn(u)}</div>
        ) : (
          <div dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 15.5, fontWeight: 600 }}>{u.title}</div>
        )}
        <div dir="ltr" style={{ fontSize: 12.5, color: C.sub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {u.authorEn}
          {u.authorEn && u.title && titleEn(u) ? " · " : ""}
          {titleEn(u) && <span dir="rtl" style={{ fontFamily: HEB_FONT }}>{u.title}</span>}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          <span className="chip" style={{ background: C.lvBg[u.level - 1], color: C.lvInk[u.level - 1], border: "none", fontWeight: 600, fontSize: 11.5, padding: "2px 8px" }}>
            +{u.newWords} words
          </span>
          <span className="chip" style={{ fontSize: 11.5, padding: "2px 8px" }}>{u.coverage}% familiar</span>
          <span className="chip" style={{ fontSize: 11.5, padding: "2px 8px" }}>{u.minutes} min</span>
        </div>
      </div>
      <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
    </button>
  );

  return (
    <main style={{ paddingTop: 18 }} aria-label="Hebrew course">
      <div style={{ fontSize: 20, fontWeight: 700 }}>Hebrew course</div>

      {index && (
        <>
          {/* Where you are, before anything else on the screen */}
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 8, background: C.soft, borderRadius: 999, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${Math.round((doneCount / units.length) * 100)}%`,
                background: C.green, transition: "width .4s",
              }} />
            </div>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>
              {doneCount} of {units.length} units · {wordsDone.toLocaleString()} of {index.vocabulary?.toLocaleString?.() || index.vocabulary} words
            </div>
          </div>

          {next ? (
            <div style={{ background: C.card, border: `1.5px solid ${C.blueLine}`, borderRadius: 16, padding: 16, marginTop: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.blue, letterSpacing: ".06em", textTransform: "uppercase" }}>
                {doneCount ? "Carry on" : "Start here"}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6, lineHeight: 1.3 }}>
                Unit {next.n}{titleEn(next) ? ` · ${titleEn(next)}` : ""}
              </div>
              {!titleEn(next) && (
                <div dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 15.5, marginTop: 2 }}>{next.title}</div>
              )}
              <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>
                {next.authorEn || next.author} · {next.newWords} new words · {next.coverage}% familiar · {next.minutes} min
              </div>
              <button className="primary-btn" style={{ marginTop: 12 }} onClick={() => openUnit(next.n)}>
                {doneCount ? "Continue" : "Begin"} unit {next.n} <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div style={{ background: C.greenSoft, border: `1px solid ${C.green}33`, borderRadius: 16, padding: 16, marginTop: 14, color: C.green, fontSize: 14, lineHeight: 1.5 }}>
              <Check size={16} strokeWidth={3} style={{ verticalAlign: "-3px", marginInlineEnd: 6 }} />
              All sixty units done — {index.vocabulary} words. The libraries are yours now.
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: 6, margin: "18px 0 4px", flexWrap: "wrap" }}>
        {(index?.levels || []).map((l) => {
          const band = units.filter((u) => u.level === l.level);
          const got = band.filter((u) => done(u.n)).length;
          const on = (level ?? 1) === l.level;
          return (
            <button
              key={l.level}
              className="chip"
              onClick={() => setLevel(l.level)}
              style={{
                border: `1.5px solid ${on ? C.lvInk[l.level - 1] : C.line}`,
                background: on ? C.lvBg[l.level - 1] : C.card,
                color: on ? C.lvInk[l.level - 1] : C.sub,
                borderRadius: 999, padding: "5px 11px", fontSize: 12.5,
                fontWeight: on ? 600 : 500, fontFamily: UI_FONT, cursor: "pointer",
              }}
            >
              {l.name} <span style={{ opacity: 0.75 }}>{got}/{band.length}</span>
            </button>
          );
        })}
      </div>

      <div style={{ paddingBottom: 24 }}>
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

        {shown.map((u) => <UnitRow key={u.n} u={u} highlight={u.n === next?.n} />)}

        {index && (
          <div style={{ fontSize: 12, color: C.sub, marginTop: 16, lineHeight: 1.5, opacity: 0.85 }}>
            Each unit teaches the next most useful band of words and pairs it with a real passage you can
            almost already read. Readings are public domain, digitised by {index.credit}
            {index.version ? ` · dump ${index.version}` : ""}
          </div>
        )}
      </div>
    </main>
  );
}
