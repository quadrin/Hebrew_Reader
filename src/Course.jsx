/* Course — a taught Hebrew curriculum, six levels from the alphabet to
   nineteenth-century prose.

   The app's other path through Hebrew is the frequency-graded corpus: it picks
   readings by how much of each is built from words you've met, which is the
   right way to choose a book and the wrong way to start a language. So the
   corpus readings live here as practice at the end of each level, and the
   spine of the screen is the syllabus — letters, then nouns, then the verb
   system, then the older forms the library is actually written in. */

import { useState, useEffect, useRef } from "react";
import { ChevronRight, ChevronLeft, Loader, Check, ArrowRight, BookOpen, Lock } from "lucide-react";
import { fetchCurriculum, fetchLesson, fetchCourseUnit } from "./library.js";
import Lesson from "./Lesson.jsx";

export default function CourseScreen({
  C, HEB_FONT, UI_FONT, onImport, onLearnWords, onPractice, progress, onUnitProgress,
}) {
  const [index, setIndex] = useState(null);
  const [err, setErr] = useState("");
  const [level, setLevel] = useState(0);         /* 0 = the level list */
  const opened = useRef(false);
  const [lesson, setLesson] = useState(null);    /* the opened lesson's data */
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!index) {
      fetchCurriculum().then(setIndex).catch((e) => setErr(e.message || "couldn't read the curriculum"));
    }
  }, []);

  const done = (id) => !!progress?.[id]?.done;
  const levels = index?.levels || [];
  const allLessons = levels.flatMap((l) => l.lessons.map((x) => ({ ...x, level: l.level, levelName: l.name })));
  const next = allLessons.find((l) => !done(l.id)) || null;

  /* Open on the level you're in, not always at the alphabet — but only on the
     first load, or backing out of a level would bounce straight back in. */
  useEffect(() => {
    if (!opened.current && next) { opened.current = true; setLevel(next.level); }
  }, [next]);

  const openLesson = async (id) => {
    setLoading(true);
    setErr("");
    try {
      setLesson(await fetchLesson(id));
    } catch (e) {
      setErr(e.message || "couldn't open that lesson");
    } finally {
      setLoading(false);
    }
  };

  const openReading = async (n) => {
    setLoading(true);
    try {
      const u = await fetchCourseUnit(n);
      onImport({ title: u.reading.titleEn || u.reading.title, chapters: null, text: u.reading.text, src: u.src });
    } catch (e) {
      setErr(e.message || "couldn't open that reading");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- inside a lesson ---------------- */
  if (lesson) {
    const here = allLessons.findIndex((l) => l.id === lesson.id);
    return (
      <Lesson
        C={C} HEB_FONT={HEB_FONT} UI_FONT={UI_FONT}
        lesson={lesson}
        next={allLessons[here + 1] || null}
        onNext={(n) => openLesson(n.id)}
        onClose={() => setLesson(null)}
        onLearnWords={onLearnWords}
        onPractice={onPractice}
        onDone={({ score, of }) => onUnitProgress(lesson.id, { done: true, score, of })}
      />
    );
  }

  const levelDone = (l) => l.lessons.filter((x) => done(x.id)).length;
  const doneCount = allLessons.filter((l) => done(l.id)).length;

  /* ---------------- one level ---------------- */
  if (level > 0 && index) {
    const lv = levels.find((l) => l.level === level);
    return (
      <main style={{ paddingTop: 14 }} aria-label={`Level: ${lv.name}`}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button className="icon-btn" onClick={() => setLevel(0)} aria-label="All levels"><ChevronLeft size={20} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, color: C.sub, fontWeight: 600 }}>Level {lv.level}</div>
            <div style={{ fontWeight: 700, fontSize: 19 }}>{lv.name}</div>
          </div>
          <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 17, color: C.sub }}>{lv.nameHe}</span>
        </div>

        <div style={{ paddingBottom: 24 }}>
          <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.55 }}>{lv.blurb}</div>
          {loading && <div style={{ textAlign: "center", padding: "14px 0" }}><Loader size={18} color={C.blue} className="spin" /></div>}
          {err && <div style={{ marginTop: 12, fontSize: 13.5, color: C.red }}>{err}</div>}

          {lv.lessons.map((l) => (
            <button key={l.id} onClick={() => openLesson(l.id)} style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%",
              background: l.id === next?.id ? C.blueSoft : C.card,
              border: `1.5px solid ${l.id === next?.id ? C.blueLine : C.line}`,
              borderRadius: 14, padding: "12px 14px", marginTop: 8, cursor: "pointer",
              textAlign: "left", fontFamily: UI_FONT, color: C.ink, opacity: done(l.id) ? 0.75 : 1,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex",
                alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14,
                background: done(l.id) ? C.green : C.lvBg[Math.min(lv.level, 5) - 1],
                color: done(l.id) ? "#fff" : C.lvInk[Math.min(lv.level, 5) - 1],
              }}>{done(l.id) ? <Check size={17} strokeWidth={3} /> : l.n}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{l.title}</div>
                <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2, lineHeight: 1.45 }}>{l.goal}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  {l.words > 0 && <span className="chip" style={{ fontSize: 11.5, padding: "2px 8px" }}>{l.words} words</span>}
                  <span className="chip" style={{ fontSize: 11.5, padding: "2px 8px" }}>{l.exercises} exercises</span>
                  <span className="chip" style={{ fontSize: 11.5, padding: "2px 8px" }}>{l.minutes} min</span>
                  {progress?.[l.id]?.of > 0 && (
                    <span className="chip" style={{ fontSize: 11.5, padding: "2px 8px", background: C.greenSoft, color: C.green, border: "none", fontWeight: 600 }}>
                      {progress[l.id].score}/{progress[l.id].of}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
            </button>
          ))}

          {lv.readings?.length > 0 && (
            <>
              <div className="field-label" style={{ marginTop: 24 }}>Read something real</div>
              <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.55 }}>
                Public-domain passages picked so that most of the words in them are ones this level has
                covered. They open in the reader, where you can tap anything you don't know.
              </div>
              {lv.readings.map((r) => (
                <button key={r.n} onClick={() => openReading(r.n)} style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%", background: C.card,
                  border: `1.5px solid ${C.line}`, borderRadius: 14, padding: "12px 14px", marginTop: 8,
                  cursor: "pointer", textAlign: "left", fontFamily: UI_FONT, color: C.ink,
                }}>
                  <BookOpen size={17} color={C.sub} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {r.titleEn
                      ? <div style={{ fontWeight: 600, fontSize: 14.5 }}>{r.titleEn}</div>
                      : <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontWeight: 600, fontSize: 15.5 }}>{r.title}</div>}
                    <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>
                      {r.authorEn || r.author} · {r.coverage}% familiar · {r.minutes} min
                    </div>
                  </div>
                  <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
                </button>
              ))}
            </>
          )}
        </div>
      </main>
    );
  }

  /* ---------------- all levels ---------------- */
  return (
    <main style={{ paddingTop: 18 }} aria-label="Hebrew course">
      <div style={{ fontSize: 20, fontWeight: 700 }}>Hebrew course</div>

      {index && (
        <>
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 8, background: C.soft, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round((doneCount / allLessons.length) * 100)}%`, background: C.green, transition: "width .4s" }} />
            </div>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>
              {doneCount} of {allLessons.length} lessons
            </div>
          </div>

          {next && (
            <div style={{ background: C.card, border: `1.5px solid ${C.blueLine}`, borderRadius: 16, padding: 16, marginTop: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.blue, letterSpacing: ".06em", textTransform: "uppercase" }}>
                {doneCount ? "Carry on" : "Start here"}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6, lineHeight: 1.3 }}>{next.title}</div>
              <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>
                {next.levelName} · lesson {next.n} · {next.exercises} exercises · {next.minutes} min
              </div>
              <button className="primary-btn" style={{ marginTop: 12 }} onClick={() => openLesson(next.id)}>
                {doneCount ? "Continue" : "Begin"} <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      <div style={{ paddingBottom: 24 }}>
        {err && <div style={{ marginTop: 14, fontSize: 13.5, color: C.sub, lineHeight: 1.5 }}>The course isn't available in this build ({err}). The shelf and the libraries still work.</div>}
        {!index && !err && <div style={{ textAlign: "center", padding: "22px 0" }}><Loader size={20} color={C.blue} className="spin" /></div>}
        {loading && <div style={{ textAlign: "center", padding: "14px 0" }}><Loader size={18} color={C.blue} className="spin" /></div>}

        {levels.map((l) => {
          const got = levelDone(l);
          const reached = l.level === 1 || levelDone(levels[l.level - 2]) > 0 || got > 0;
          return (
            <button key={l.level} onClick={() => setLevel(l.level)} style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%", background: C.card,
              border: `1.5px solid ${C.line}`, borderRadius: 14, padding: "13px 14px", marginTop: 8,
              cursor: "pointer", textAlign: "left", fontFamily: UI_FONT, color: C.ink,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: "flex",
                alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16,
                background: got === l.lessons.length ? C.green : C.lvBg[Math.min(l.level, 5) - 1],
                color: got === l.lessons.length ? "#fff" : C.lvInk[Math.min(l.level, 5) - 1],
              }}>{got === l.lessons.length ? <Check size={20} strokeWidth={3} /> : l.level}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 15.5 }}>{l.name}</span>
                  <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 14, color: C.sub }}>{l.nameHe}</span>
                  {!reached && <Lock size={12} color={C.sub} />}
                </div>
                <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3, lineHeight: 1.45 }}>{l.blurb}</div>
                <div style={{ height: 5, background: C.soft, borderRadius: 999, overflow: "hidden", marginTop: 8 }}>
                  <div style={{ height: "100%", width: `${Math.round((got / l.lessons.length) * 100)}%`, background: C.lvInk[Math.min(l.level, 5) - 1] }} />
                </div>
                <div style={{ fontSize: 11.5, color: C.sub, marginTop: 4 }}>{got}/{l.lessons.length} lessons</div>
              </div>
              <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
            </button>
          );
        })}

        {index && (
          <div style={{ fontSize: 12, color: C.sub, marginTop: 16, lineHeight: 1.5, opacity: 0.85 }}>
            Six levels, {allLessons.length} lessons, from the alphabet to nineteenth-century prose. Readings
            are public domain, digitised by Project Ben-Yehuda volunteers.
          </div>
        )}
      </div>
    </main>
  );
}
