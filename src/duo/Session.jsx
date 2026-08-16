/* A lesson.

   Fifteen or so exercises, a bar that only moves when you are right, and a
   mistake comes back before the end. That last rule is what makes the queue
   interesting: the session is not a list, it is a queue that grows when you
   are wrong and shrinks when you are right, and the progress bar is a ratio of
   the two.

   A lesson cannot be lost: the hearts are gone, and a wrong answer costs only
   the time it takes to get it right. A test can be — it is played on three
   strikes, which is the one place a mistake still ends something, and ending
   it early beats making someone finish a test they have already failed.

   A mistake comes back exactly once either way. Requeueing every wrong answer
   until it came back right, with nothing to run out of, let one bad run grow
   without bound; returning it once bounds a session at twice its length.
   Grades count first attempts, so the second pass is for learning, not for
   marks. */

import { useState, useEffect, useRef } from "react";
import {
  X, Volume2, Turtle, Mic, MicOff, Delete, Zap, Loader, Heart,
} from "lucide-react";

import { checkAnswer, norm, normHe, tokenizeHe } from "./exercises.js";
import { playPhrase, sfx, stopAudio, hasSpeechRecognition, warmAudio } from "./audio.js";
import { canTranscribe, transcribeHebrew } from "../voice.js";
import {
  useDuo, recordWord, addMistake, clearMistakes, finishSession, questProgress, setSetting,
  rememberAccepted, acceptedFor,
} from "./state.js";
import { hasApiKey, fetchAnswerRuling, fetchMistakeNote, fetchSpeechRuling } from "../ai.js";

const HE_KEYS = [
  "פ", "ו", "ט", "א", "ר", "ק", "ם", "ן", "ך", "ף",
  "ל", "ח", "י", "ע", "כ", "ג", "ד", "ש", "ץ", "ה",
  "ת", "צ", "מ", "נ", "ב", "ס", "ז", "ג", "ר", "ן",
];

/* ------------------------------------------------------------------ */
/* Word with a tap-hint, the way Duolingo underlines what it can gloss  */
/* ------------------------------------------------------------------ */
function HintedHebrew({ text, hints, big }) {
  const [open, setOpen] = useState(null);
  const map = new Map((hints || []).filter((t) => t.h).map((t) => [t.w, t.h]));
  const words = String(text).split(/(\s+)/);
  return (
    <div className="d-prompt-he" dir="rtl" style={big ? { fontSize: 40 } : undefined}>
      {words.map((w, i) => {
        const clean = w.replace(/[.,!?;:"'׳״()]/g, "");
        const hint = map.get(clean);
        if (!hint) return <span key={i}>{w}</span>;
        return (
          <span key={i} style={{ position: "relative", display: "inline-block" }}>
            <span className="d-hint" onClick={() => setOpen(open === i ? null : i)}>{w}</span>
            {open === i && (
              <span className="d-hint-pop" style={{ top: "100%", insetInlineStart: 0, marginTop: 4 }}>
                {hint.slice(0, 3).join(", ")}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/* The first press on a sentence with no recording has to wait for the voice to
   be generated — a second or two — so the button says so rather than looking
   broken. Afterwards it is cached and instant. */
function Speaker({ text, audio, size = 46, slow = true }) {
  const [state, setState] = useState("idle");
  const busy = state === "loading";
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button
        className="d-btn blue"
        style={{ width: size + 12, height: size, padding: 0, borderRadius: 14 }}
        onClick={() => playPhrase(text, audio, { onState: setState })}
        aria-label={busy ? "Generating the voice" : "Play"}
      >
        {busy ? <Loader size={size / 2} className="spin" /> : <Volume2 size={size / 2} />}
      </button>
      {slow && (
        <button
          className="d-icon-btn"
          onClick={() => playPhrase(text, audio, { rate: 0.6, onState: setState })}
          aria-label="Play slowly"
          style={{ color: "var(--d-blue)", borderColor: "var(--d-blue)" }}
        >
          <Turtle size={19} />
        </button>
      )}
    </span>
  );
}

/* Typing Hebrew means having a Hebrew keyboard, which most people answering
   this course do not, so one is drawn under the box. */
function HebrewKeys({ value, onChange, disabled }) {
  const type = (ch) => !disabled && onChange((value || "") + ch);
  return (
    <div className="d-kbd">
      {HE_KEYS.slice(0, 20).map((k, i) => (
        <button key={i} onClick={() => type(k)} disabled={disabled}>{k}</button>
      ))}
      <button className="wide" onClick={() => type(" ")} disabled={disabled}>space</button>
      <button className="wide" onClick={() => !disabled && onChange((value || "").slice(0, -1))} disabled={disabled}>
        <Delete size={14} style={{ verticalAlign: "-2px" }} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One exercise                                                        */
/* ------------------------------------------------------------------ */
function Exercise({ ex, response, setResponse, locked, verdict, typing, judge, onToggleMode, onMatchDone }) {
  const heInput = useRef(null);

  useEffect(() => {
    /* audio-first exercises play themselves, as they do in the app */
    if (ex.type === "listen") playPhrase(ex.text, ex.audio);
    if (ex.type === "new") playPhrase(ex.he, ex.audio);
  }, [ex.key]);

  /* ---------- translation: typed, or from the word bank ---------- */
  if (ex.type === "bank" || ex.type === "listen") {
    const rtl = ex.lang === "he";
    const picked = Array.isArray(response) ? response : [];
    const take = (i) => {
      if (locked) return;
      sfx("tap");
      setResponse([...picked, { t: ex.tiles[i], i }]);
    };
    const drop = (n) => {
      if (locked) return;
      sfx("untap");
      setResponse(picked.filter((_, k) => k !== n));
    };
    return (
      <>
        <div className="d-question">
          {ex.type === "listen" && typing ? "Type what you hear" : ex.instruction}
        </div>
        {ex.type === "listen" ? (
          <div style={{ marginBottom: 20 }}><Speaker text={ex.text} audio={ex.audio} size={58} /></div>
        ) : (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 20 }}>
            {ex.audio && <Speaker text={ex.prompt} audio={ex.audio} size={40} slow={false} />}
            <div style={{ flex: 1 }}>
              {ex.promptLang === "he"
                ? <HintedHebrew text={ex.prompt} hints={ex.hints} />
                : <div className="d-prompt-en">{ex.prompt}</div>}
            </div>
          </div>
        )}

        {typing ? (
          <>
            <textarea
              className={`d-input ${rtl ? "he" : ""}`}
              rows={2}
              dir={rtl ? "rtl" : "ltr"}
              value={typeof response === "string" ? response : ""}
              disabled={locked}
              autoFocus
              placeholder={rtl ? "כתוב כאן" : "Type in English"}
              onChange={(e) => setResponse(e.target.value)}
            />
            {rtl && <HebrewKeys value={typeof response === "string" ? response : ""} onChange={setResponse} disabled={locked} />}
          </>
        ) : (
          <>
            <div className={`d-answer-line ${rtl ? "rtl" : ""}`}>
              {picked.map((p, n) => (
                <button key={n} className={`d-tile ${rtl ? "he" : ""}`} onClick={() => drop(n)}>{p.t}</button>
              ))}
            </div>
            <div className={`d-bank ${rtl ? "rtl" : ""}`}>
              {ex.tiles.map((t, i) => (
                <button
                  key={i}
                  className={`d-tile ${rtl ? "he" : ""} ${picked.some((p) => p.i === i) ? "spent" : ""}`}
                  onClick={() => take(i)}
                >{t}</button>
              ))}
            </div>
          </>
        )}

        {!locked && (
          <button className="d-switch" onClick={onToggleMode}>
            {typing ? "Use word bank" : "Type the answer"}
          </button>
        )}
      </>
    );
  }

  /* ---------- typed ---------- */
  if (ex.type === "type") {
    const he = ex.lang === "he";
    return (
      <>
        <div className="d-question">{ex.instruction}</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 18 }}>
          {ex.audio && <Speaker text={ex.prompt} audio={ex.audio} size={40} slow={false} />}
          <div style={{ flex: 1 }}>
            {ex.promptLang === "he"
              ? <HintedHebrew text={ex.prompt} hints={ex.hints} />
              : <div className="d-prompt-en">{ex.prompt}</div>}
          </div>
        </div>
        <textarea
          ref={heInput}
          className={`d-input ${he ? "he" : ""}`}
          rows={2}
          dir={he ? "rtl" : "ltr"}
          value={response || ""}
          disabled={locked}
          placeholder={he ? "כתוב כאן" : "Type in English"}
          onChange={(e) => setResponse(e.target.value)}
        />
        {he && <HebrewKeys value={response || ""} onChange={setResponse} disabled={locked} />}
      </>
    );
  }

  /* ---------- multiple choice ---------- */
  if (ex.type === "select") {
    const heOpts = ex.optionLang === "he";
    return (
      <>
        <div className="d-question">{ex.instruction}</div>
        {ex.prompt && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18 }}>
            {ex.promptLang === "he" && <Speaker text={ex.prompt} audio="" size={40} slow={false} />}
            <div className={ex.promptBig ? "d-big-letter" : "d-prompt-he"} dir="rtl">{ex.prompt}</div>
          </div>
        )}
        {ex.options.map((o, i) => {
          const state = verdict == null ? (response === i ? "sel" : "")
            : i === ex.answerIndex ? "ok" : response === i ? "no" : "";
          return (
            <button
              key={i}
              className={`d-option ${heOpts ? "he" : ""} ${state}`}
              style={ex.big ? { fontSize: 34, justifyContent: "center" } : undefined}
              disabled={locked}
              onClick={() => { sfx("tap"); setResponse(i); if (heOpts) playPhrase(o.he, ""); }}
            >
              <span className="num">{i + 1}</span>
              <span style={{ flex: 1 }}>{o.he}</span>
            </button>
          );
        })}
      </>
    );
  }

  /* ---------- fill the blank ---------- */
  if (ex.type === "blank") {
    return (
      <>
        <div className="d-question">{ex.instruction}</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 8 }}>
          {ex.audio && <Speaker text={ex.full} audio={ex.audio} size={40} slow={false} />}
          <div className="d-prompt-he" dir="rtl" style={{ flex: 1 }}>
            {ex.sentence.map((w, i) => (
              w === null
                ? <span key={i} style={{
                    display: "inline-block", minWidth: 74, borderBottom: "3px solid var(--d-line)",
                    margin: "0 6px", color: "var(--d-blue)",
                  }}>{response != null ? ex.options[response].he : " "}</span>
                : <span key={i}>{w} </span>
            ))}
          </div>
        </div>
        <div className="d-sub" style={{ marginBottom: 16 }}>{ex.translation}</div>
        {ex.options.map((o, i) => {
          const state = verdict == null ? (response === i ? "sel" : "")
            : i === ex.answerIndex ? "ok" : response === i ? "no" : "";
          return (
            <button key={i} className={`d-option he ${state}`} disabled={locked}
              onClick={() => { sfx("tap"); setResponse(i); }}>
              <span className="num">{i + 1}</span>
              <span style={{ flex: 1 }}>{o.he}</span>
            </button>
          );
        })}
      </>
    );
  }

  /* ---------- pair matching ---------- */
  if (ex.type === "match") return <Match ex={ex} onDone={onMatchDone} />;

  /* ---------- speaking ---------- */
  if (ex.type === "speak") return <Speak ex={ex} setResponse={setResponse} locked={locked} judge={judge} />;

  /* ---------- a new word ---------- */
  if (ex.type === "new") {
    return (
      <div className="d-center" style={{ paddingTop: 12 }}>
        <div className="d-pill" style={{ background: "var(--d-green-soft)", color: "var(--d-green-dark)" }}>NEW WORD</div>
        <div className="d-prompt-he d-grow" style={{ fontSize: 54, margin: "22px 0 6px" }} dir="rtl">{ex.he}</div>
        <div style={{ fontSize: 21, fontWeight: 700 }}>{ex.en}</div>
        {ex.alt?.length > 0 && <div className="d-sub" style={{ marginTop: 6 }}>also: {ex.alt.slice(0, 3).join(", ")}</div>}
        <div style={{ marginTop: 22 }}><Speaker text={ex.he} audio="" size={54} slow={false} /></div>
      </div>
    );
  }

  return null;
}

/* ------------------------------------------------------------------ */
function Match({ ex, onDone }) {
  const [heSel, setHeSel] = useState(null);
  const [enSel, setEnSel] = useState(null);
  const [gone, setGone] = useState([]);
  const [bad, setBad] = useState(false);
  const missed = useRef(0);

  useEffect(() => { setHeSel(null); setEnSel(null); setGone([]); missed.current = 0; }, [ex.key]);

  const resolve = (he, en) => {
    const pair = ex.pairs.find((p) => p.he === he);
    if (pair && pair.en === en) {
      sfx("tap");
      const next = [...gone, he, en];
      setGone(next);
      setHeSel(null); setEnSel(null);
      if (next.length >= ex.pairs.length * 2) {
        sfx("correct");
        onDone(missed.current === 0);
      }
    } else {
      missed.current++;
      sfx("wrong");
      setBad(true);
      setTimeout(() => { setBad(false); setHeSel(null); setEnSel(null); }, 500);
    }
  };

  return (
    <>
      <div className="d-question">{ex.instruction}</div>
      <div className={`d-match ${bad ? "d-shake" : ""}`}>
        <div>
          {ex.he.map((h) => (
            <button
              key={h}
              className={`d-option he ${gone.includes(h) ? "gone" : ""} ${heSel === h ? (bad ? "no" : "sel") : ""}`}
              onClick={() => { setHeSel(h); playPhrase(h, ""); if (enSel) resolve(h, enSel); }}
            >{h}</button>
          ))}
        </div>
        <div>
          {ex.en.map((e) => (
            <button
              key={e}
              className={`d-option ${gone.includes(e) ? "gone" : ""} ${enSel === e ? (bad ? "no" : "sel") : ""}`}
              onClick={() => { setEnSel(e); if (heSel) resolve(heSel, e); }}
            >{e}</button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Speaking, two ways. Chrome's own recogniser claims Hebrew and mostly is not
   installed with it, so when there is a key that can transcribe, the mic is
   recorded and sent to the model instead — which does hear Hebrew. Either way
   the grade is on word overlap, not identity: nobody's second-language
   dictation comes back verbatim. */
function Speak({ ex, setResponse, locked, judge }) {
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [heard, setHeard] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const rec = useRef(null);
  const media = useRef(null);
  const byModel = canTranscribe();
  const supported = byModel || hasSpeechRecognition();

  useEffect(() => () => {
    try { rec.current?.stop(); } catch (e) {}
    try { media.current?.stop(); } catch (e) {}
  }, []);

  /* Three ways this can go. The recogniser came back in Hebrew: compare words.
     It came back in Latin letters — which is what browser recognition does with
     Hebrew about half the time — then only a model can tell whether those
     letters are the sentence being said. And if neither is possible, the honest
     answer is that we could not hear it, which is not the learner's mistake and
     is not marked as one. */
  const grade = async (said) => {
    setHeard(said);
    const hasHebrew = /[֐-׿]/.test(said);

    if (hasHebrew) {
      const want = tokenizeHe(ex.prompt).map(normHe);
      const got = new Set(tokenizeHe(said).map(normHe));
      const hit = want.filter((w) => got.has(w)).length;
      if (hit / Math.max(1, want.length) >= 0.55) { setResponse(true); return; }
    }

    if (judge) {
      setThinking(true);
      try {
        const ruling = await fetchSpeechRuling({ he: ex.prompt, en: ex.translation, heard: said });
        setThinking(false);
        setNote(ruling.why || "");
        setResponse(!!ruling.accept);
        return;
      } catch (e) {
        setThinking(false);
      }
    }

    if (!hasHebrew) {
      /* the recogniser did not produce Hebrew and nothing can judge it — say
         so rather than failing someone for their microphone */
      setErr("the recogniser didn't come back in Hebrew, so this one can't be marked — skip it");
      setResponse(null);
      return;
    }
    setResponse(false);
  };

  const stopRecording = () => {
    try { media.current?.stop(); } catch (e) {}
  };

  const startModel = async () => {
    setErr("");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setErr("the microphone isn't available");
      return;
    }
    const chunks = [];
    const mr = new MediaRecorder(stream);
    media.current = mr;
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setListening(false);
      setThinking(true);
      try {
        const said = await transcribeHebrew(new Blob(chunks, { type: mr.mimeType || "audio/webm" }));
        if (said) grade(said); else { setErr("nothing was heard"); setResponse(false); }
      } catch (e) {
        setErr(e.message || "couldn't transcribe that");
      } finally {
        setThinking(false);
      }
    };
    setListening(true);
    mr.start();
    /* a spoken sentence of this length never needs more than eight seconds */
    setTimeout(() => { if (media.current === mr && mr.state === "recording") mr.stop(); }, 8000);
  };

  const startBrowser = () => {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new Rec();
    rec.current = r;
    r.lang = "he-IL";
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.onresult = (e) => grade([...e.results[0]].map((a) => a.transcript).join(" "));
    r.onerror = () => { setListening(false); setResponse(false); };
    r.onend = () => setListening(false);
    setListening(true);
    try { r.start(); } catch (e) { setListening(false); }
  };

  const press = () => {
    if (!supported || locked || thinking) return;
    if (listening) { stopRecording(); return; }
    if (byModel) startModel(); else startBrowser();
  };

  return (
    <>
      <div className="d-question">{ex.instruction}</div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18 }}>
        <Speaker text={ex.prompt} audio={ex.audio} size={44} slow={false} />
        <div style={{ flex: 1 }}>
          <div className="d-prompt-he" dir="rtl">{ex.prompt}</div>
          <div className="d-sub">{ex.translation}</div>
        </div>
      </div>
      <button
        className={`d-btn ${listening ? "red" : "blue"}`}
        onClick={press}
        disabled={!supported || locked || thinking}
        style={{ marginTop: 10 }}
      >
        {!supported ? <><MicOff size={18} /> Speaking isn't available here</>
          : thinking ? <><Loader size={18} className="spin" /> Listening back…</>
          : listening ? <><Mic size={18} /> Recording — tap to stop</>
          : <><Mic size={18} /> Tap and speak</>}
      </button>
      {byModel && !heard && !err && (
        <div className="d-sub" style={{ marginTop: 8 }}>Your recording goes to your own transcription key.</div>
      )}
      {heard && (
        <div className="d-sub" style={{ marginTop: 10 }}>
          Heard: <span style={{ fontFamily: "var(--d-heb)" }} dir="auto">{heard}</span>
        </div>
      )}
      {note && <div className="d-sub" style={{ marginTop: 6, opacity: .85 }}>{note}</div>}
      {err && <div className="d-sub" style={{ marginTop: 10, color: "var(--d-red)" }}>{err}</div>}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The session                                                         */
/* ------------------------------------------------------------------ */
export default function Session({ items, meta, onExit, onFinish }) {
  const duo = useDuo();
  const [queue, setQueue] = useState(() => items.map((x) => ({ ...x })));
  const [at, setAt] = useState(0);
  /* The answer is stamped with the exercise it belongs to. Clearing it in an
     effect after the index moves leaves one render where a word bank is handed
     the previous exercise's typed string, which is a crash rather than a
     glitch — so nothing is carried across an index change at all. */
  /* Answering is typed by default; the word bank is one tap away, and which
     one you last used is remembered for the rest of the course. */
  const [mode, setMode] = useState(duo.settings.wordBank ? "bank" : "type");
  const [judging, setJudging] = useState(false);
  const aiGrader = duo.settings.aiGrading !== false && hasApiKey();
  const aiNotes = duo.settings.aiNotes !== false && hasApiKey();
  /* Rulings in flight, keyed by sentence and answer. Started while the answer
     is still being typed, so pressing Check usually finds one already back. */
  const rulings = useRef(new Map());
  const lastWrong = useRef(null);
  /* the explanation under a red bar, once it arrives */
  const [note, setNote] = useState(null);
  const notes = useRef(new Map());
  const [ans, setAns] = useState({ at: 0, resp: null, verdict: null });
  const response = ans.at === at ? ans.resp : null;
  const verdict = ans.at === at ? ans.verdict : null;
  const setResponse = (v) => setAns((s) => ({ at, resp: v, verdict: s.at === at ? s.verdict : null }));
  const setVerdict = (v) => setAns((s) => ({ at, resp: s.at === at ? s.resp : null, verdict: v }));
  const [combo, setCombo] = useState(0);
  const [comboFlash, setComboFlash] = useState(0);
  const [done, setDone] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [skipped, setSkipped] = useState(0);
  /* A test is played on strikes; everything else on nothing at all. */
  const strikeLimit = meta.strikes || 0;
  const isTest = strikeLimit > 0;
  const [strikes, setStrikes] = useState(0);
  const [failed, setFailed] = useState(null);
  const startedAt = useRef(Date.now());
  const tally = useRef({ correct: 0, answered: 0, first: 0, firstOk: 0, mistakes: 0, listen: 0, xp: 0 });
  const finished = useRef(false);
  const struck = useRef(false);
  const atRef = useRef(0);

  const ex = queue[at];
  const total = queue.length;

  useEffect(() => { warmAudio(); return () => stopAudio(); }, []);

  /* Enter checks, then continues; digits pick options — a lesson should be
     playable without lifting your hands off the keyboard. */
  useEffect(() => {
    const onKey = (e) => {
      if (done || quitting || failed) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (verdict) next(); else if (canCheck) check();
      } else if (/^[1-9]$/.test(e.key) && ex && (ex.type === "select" || ex.type === "blank") && !verdict) {
        const i = Number(e.key) - 1;
        if (i < ex.options.length) setResponse(i);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!ex && !done) {
    /* nothing generated — better to say so than to hang on a blank screen */
    return (
      <div className="d-session">
        <div className="d-session-body d-center" style={{ paddingTop: 60 }}>
          <div className="d-title">This lesson has no material yet</div>
          <div className="d-sub">The unit's phrases could not be loaded.</div>
          <button className="d-btn" style={{ marginTop: 20 }} onClick={onExit}>Back to the path</button>
        </div>
      </div>
    );
  }

  atRef.current = at;
  const typing = mode === "type";

  const toggleMode = () => {
    const next = typing ? "bank" : "type";
    setMode(next);
    setSetting("wordBank", next === "bank");
    setResponse(null);
  };

  const canCheck = (() => {
    if (!ex || verdict) return false;
    switch (ex.type) {
      case "bank": case "listen":
        return typeof response === "string" ? !!response.trim() : (response || []).length > 0;
      case "type": return !!String(response || "").trim();
      case "select": case "blank": return response != null;
      case "speak": return response != null;
      case "new": return true;
      case "match": return false;
      default: return false;
    }
  })();

  /* What the grader is asked about: the Hebrew, the course's English, and the
     answer. `sentenceOf` is also the key an accepted answer is remembered
     under. */
  const sentenceOf = (x) => x.text || (x.promptLang === "he" ? x.prompt : x.display) || "";

  const askRuling = (x, given) => {
    const key = `${sentenceOf(x)}|${given}`;
    if (rulings.current.has(key)) return rulings.current.get(key);
    const job = fetchAnswerRuling({
      he: sentenceOf(x),
      en: x.lang === "he" ? x.prompt : x.display,
      given,
      lang: x.lang,
    }).catch(() => null);
    rulings.current.set(key, job);
    return job;
  };

  /* An answer with nothing in common with the reference is not a paraphrase,
     it is a different sentence — worth an instant red rather than a wait. */
  const worthAsking = (x, given) => {
    const want = new Set(norm(x.display, x.lang).split(" ").filter(Boolean));
    const got = norm(given, x.lang).split(" ").filter(Boolean);
    /* nothing in the answer's own language — Latin typed at a Hebrew prompt —
       is not a paraphrase to weigh up */
    if (!got.length) return false;
    /* a one or two word reference can be paraphrased with no words in common
       ("mom" / "mother"), so those are always worth asking about */
    if (want.size <= 2) return true;
    return got.some((w) => want.has(w));
  };

  /* Judge while they are still typing: by the time Check is pressed the answer
     has usually already been ruled on, and the wait is nothing. */
  useEffect(() => {
    if (!aiGrader || verdict || typeof response !== "string") return;
    const given = response.trim();
    if (given.length < 3 || !ex) return;
    const t = setTimeout(() => {
      if (checkAnswer(ex, given).ok) return;        /* already right */
      if (!worthAsking(ex, given)) return;
      askRuling(ex, given);
    }, 450);
    return () => clearTimeout(t);
  }, [response, at]);

  const recordWords = (ok) => {
    for (const w of ex.words || []) recordWord(w.he, w.en, meta.unit, ok);
  };

  const check = async () => {
    if (!ex || struck.current || judging) return;
    const payload = (ex.type === "bank" || ex.type === "listen") && Array.isArray(response)
      ? response.map((p) => p.t)
      : response;

    /* Anything a grader has already allowed for this sentence counts as an
       accepted answer, so the same wording is never argued about twice. */
    const sentence = ex.text || (ex.promptLang === "he" ? ex.prompt : ex.display) || "";
    const remembered = acceptedFor(duo, sentence);
    const marked = { ...ex, accepted: [...(ex.accepted || []), ...remembered] };
    let res = checkAnswer(marked, payload);

    if (ex.type === "new") { recordWords(true); return next(true); }

    /* The course ships one accepted translation per sentence and marks
       everything else wrong, so a typed answer gets a second opinion. The
       request was very likely started while it was being typed; this waits a
       moment for it and then stops waiting — a ruling that lands late still
       counts, it just arrives as an upgrade rather than as a delay. */
    let pending = null;
    if (!res.ok && typeof payload === "string" && aiGrader && worthAsking(ex, payload)) {
      const job = askRuling(ex, payload);
      setJudging(true);
      const ruling = await Promise.race([job, new Promise((r) => setTimeout(() => r("later"), 700))]);
      setJudging(false);
      if (ruling && ruling !== "later" && ruling.accept) {
        rememberAccepted(sentence, payload);
        res = { ok: true, solution: ex.display, judged: ruling.why || "Same meaning." };
      } else if (ruling === "later") {
        pending = { job, given: payload, at, key: ex.key, solution: ex.display };
      }
    }

    tally.current.answered++;
    /* the grade is what you knew, not what you learned mid-session */
    if (!ex.retry) tally.current.first++;
    if (ex.type === "listen") tally.current.listen++;

    if (res.ok) {
      tally.current.correct++;
      if (!ex.retry) tally.current.firstOk++;
      const c = combo + 1;
      setCombo(c);
      if (c >= 3 && c % 3 === 0) { setComboFlash(c); setTimeout(() => setComboFlash(0), 1000); }
      questProgress("combo", c, "max");
      if (ex.type === "listen") questProgress("listen", tally.current.listen, "max");
      sfx("correct");
      recordWords(true);
      if (ex.fromMistake) clearMistakes([ex.fromMistake]);
    } else {
      tally.current.mistakes++;
      setCombo(0);
      sfx("wrong");
      recordWords(false);
      const mistakeKey = ex.key + ":" + (ex.display || "");
      addMistake({ key: mistakeKey, ex: { ...ex, key: undefined } });
      explainMistake(ex, typeof payload === "string" ? payload : (payload || []).join(" "));
      if (pending) watchLateRuling(pending, { mistakeKey, sentence, struckOne: !!strikeLimit, retried: !!ex.retry });
      if (strikeLimit) {
        const used = strikes + 1;
        setStrikes(used);
        setVerdict(res);
        if (used >= strikeLimit) {
          /* the reveal stays up for a moment before the test ends — but the
             session is over as of now, so nothing else can be answered */
          struck.current = true;
          setTimeout(() => setFailed({ strikes: used, at: Math.min(at + 1, items.length), of: items.length }), 900);
          return;
        }
        /* a struck exercise still comes back, so the test can teach it */
        if (!ex.retry) setQueue((q) => [...q, { ...ex, key: ex.key + "-again", retry: true }]);
        return;
      }
      /* it comes back once, later in the session, and only once */
      if (!ex.retry) setQueue((q) => [...q, { ...ex, key: ex.key + "-again", retry: true }]);
    }
    setVerdict(res);
  };

  /* A ruling that came back after the red bar. If it accepts, everything the
     wrong answer cost is handed back: the strike, the mistake, the requeued
     copy, and the mark. */
  /* Fetched after the verdict is on screen, never before it: the bar going red
     is not allowed to wait on anything. */
  const explainMistake = (x, given) => {
    if (!aiNotes || !given) return;
    const key = `${sentenceOf(x)}|${given}`;
    if (notes.current.has(key)) { setNote({ at: atRef.current, text: notes.current.get(key) }); return; }
    setNote({ at: atRef.current, text: "" });
    fetchMistakeNote({
      he: sentenceOf(x),
      en: x.lang === "he" ? x.prompt : x.display,
      given,
      lang: x.lang,
    })
      .then((text) => {
        if (!text) return;
        notes.current.set(key, text);
        setNote((n) => (n && n.at === atRef.current ? { ...n, text } : n));
      })
      .catch(() => setNote((n) => (n && !n.text ? null : n)));
  };

  const watchLateRuling = (pending, cost) => {
    pending.job.then((ruling) => {
      if (!ruling || ruling === "later" || !ruling.accept) return;
      if (finished.current || pending.at !== atRef.current) return;
      rememberAccepted(cost.sentence, pending.given);
      clearMistakes([cost.mistakeKey]);
      setQueue((q) => q.filter((item) => item.key !== pending.key + "-again"));
      if (cost.struckOne) { setStrikes((n) => Math.max(0, n - 1)); struck.current = false; }
      tally.current.mistakes = Math.max(0, tally.current.mistakes - 1);
      tally.current.correct++;
      if (!cost.retried) tally.current.firstOk++;
      sfx("correct");
      setNote(null);
      setVerdict({ ok: true, solution: pending.solution, judged: (ruling.why || "Same meaning.") + " (counted after all)" });
    });
  };

  const next = (silent) => {
    if (struck.current) return;      /* the test has already ended */
    stopAudio();
    if (at + 1 >= queue.length) return finish();
    setAt(at + 1);
    if (!silent) { /* nothing else to do — the effect clears the response */ }
  };

  const onMatchDone = (clean) => {
    const scored = clean ? ex.pairs.length : Math.max(1, ex.pairs.length - 1);
    tally.current.answered += ex.pairs.length;
    tally.current.correct += scored;
    if (!ex.retry) { tally.current.first += ex.pairs.length; tally.current.firstOk += scored; }
    for (const p of ex.pairs) recordWord(p.he, p.en, meta.unit, clean);
    setTimeout(() => next(true), 400);
  };

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    const ms = Date.now() - startedAt.current;
    const t = tally.current;
    const perfect = t.mistakes === 0;

    const base = meta.xp ?? 10;
    const comboBonus = Math.min(10, Math.floor(t.correct / 5) * 2);
    const perfectBonus = perfect ? 5 : 0;
    const xp = base + comboBonus + perfectBonus;
    t.xp = xp;
    sfx("complete");
    finishSession({
      unit: meta.unit, node: meta.node, xp, correct: t.correct, answered: t.answered,
      ms, perfect, kind: meta.kind, advance: meta.advance,
    });
    setDone(true);
  };

  /* ---------------- a test failed ---------------- */
  if (failed) {
    return (
      <div className="d-session">
        <div className="d-session-body d-center" style={{ paddingTop: 60 }}>
          <div style={{ fontSize: 46 }}>🔒</div>
          <div className="d-title" style={{ fontSize: 24 }}>Not this time</div>
          <div className="d-sub" style={{ maxWidth: 420, margin: "0 auto" }}>
            {strikeLimit} mistakes ends the test — you were {failed.at} of {failed.of} in.
            Nothing is lost: no streak, no progress, and no hearts to wait on. Take it again,
            or work through the lessons instead.
          </div>
        </div>
        <div className="d-footer">
          <div className="d-footer-inner">
            <button className="d-btn ghost" style={{ width: 180 }} onClick={onExit}>Back to the path</button>
            <button className="d-btn" style={{ flex: 1 }} onClick={() => onExit({ retry: true })}>Try again</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- results ---------------- */
  if (done) {
    const t = tally.current;
    const secs = Math.round((Date.now() - startedAt.current) / 1000);
    const acc = t.first ? Math.round((t.firstOk / t.first) * 100) : 100;
    return (
      <div className="d-session">
        <div className="d-session-body d-center" style={{ paddingTop: 40 }}>
          <div className="d-grow" style={{ fontSize: 46 }}>{t.mistakes === 0 ? "🏆" : "🎉"}</div>
          <div className="d-title" style={{ fontSize: 26, color: "var(--d-gold)" }}>
            {isTest ? "Test passed!" : t.mistakes === 0 ? "Perfect lesson!" : "Lesson complete!"}
          </div>
          <div style={{ display: "flex", gap: 10, margin: "18px 0" }}>
            <div className="d-stat-card"><div><div className="k">Total XP</div><div className="v">{t.xp}</div></div></div>
            <div className="d-stat-card blue"><div><div className="k">Speedy</div><div className="v">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</div></div></div>
            <div className="d-stat-card green"><div><div className="k">{acc >= 90 ? "Amazing" : "Good"}</div><div className="v">{acc}%</div></div></div>
          </div>
          {duo.boost > Date.now() && (
            <div className="d-pill" style={{ background: "var(--d-purple)", color: "#fff" }}><Zap size={13} /> XP boost doubled this</div>
          )}
          <div className="d-sub" style={{ marginTop: 8 }}>
            {meta.title} · {t.correct} of {t.answered} right
          </div>
        </div>
        <div className="d-footer">
          <div className="d-footer-inner">
            <button className="d-btn" onClick={() => onFinish({ xp: t.xp, perfect: t.mistakes === 0 })}>Continue</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- the exercise ---------------- */
  const progress = Math.round((at / Math.max(1, total)) * 100);
  return (
    <div className="d-session">
      {comboFlash > 0 && <div className="d-combo">{comboFlash} in a row!</div>}

      <div className="d-session-top">
        <button className="d-icon-btn" onClick={() => setQuitting(true)} aria-label="Quit"><X size={20} /></button>
        <div className="d-bar"><i style={{ width: `${progress}%` }} /></div>
        {isTest && (
          <div className="d-stat" style={{ color: "var(--d-red)" }} title={`${strikeLimit - strikes} mistakes left`}>
            {Array.from({ length: strikeLimit }, (_, i) => (
              <Heart key={i} size={19} fill={i < strikeLimit - strikes ? "var(--d-red)" : "none"}
                style={{ opacity: i < strikeLimit - strikes ? 1 : 0.35 }} />
            ))}
          </div>
        )}
      </div>

      <div className="d-session-body">
        <Exercise
          ex={ex}
          response={response}
          setResponse={setResponse}
          locked={!!verdict}
          verdict={verdict ? verdict.ok : null}
          typing={typing}
          judge={aiGrader}
          onToggleMode={toggleMode}
          onMatchDone={onMatchDone}
        />
      </div>

      <div className={`d-footer ${verdict ? (verdict.ok ? "ok" : "no") : ""}`}>
        <div className="d-footer-inner">
          {verdict ? (
            <>
              <div className="d-verdict" style={{ color: verdict.ok ? "var(--d-green-dark)" : "var(--d-red-dark)" }}>
                {verdict.ok
                  ? ex.type === "new" ? "" : verdict.judged ? "Another correct answer" : "Nicely done!"
                  : "Correct solution:"}
                {verdict.judged && (
                  <small>
                    {verdict.judged}
                    {verdict.solution && <> The course's own: <span className={/[֐-׿]/.test(verdict.solution) ? "sol" : ""}>{verdict.solution}</span></>}
                  </small>
                )}
                {!verdict.ok && verdict.solution && (
                  <small><span className={/[֐-׿]/.test(verdict.solution) ? "sol" : ""}>{verdict.solution}</span></small>
                )}
                {!verdict.ok && ex.type === "listen" && <small>{ex.solutionEn}</small>}
                {!verdict.ok && note && note.at === at && (
                  note.text
                    ? <small style={{ opacity: .95, fontWeight: 500 }}>{note.text}</small>
                    : <small style={{ opacity: .6, fontWeight: 500 }}>working out what went wrong…</small>
                )}
              </div>
              <button className={`d-btn ${verdict.ok ? "" : "red"}`} style={{ width: 200 }} onClick={() => next()}>Continue</button>
            </>
          ) : (
            <>
              {ex.type === "speak" && (
                <button className="d-btn ghost" style={{ width: 180 }} onClick={() => { setSkipped(skipped + 1); next(true); }}>
                  Can't speak now
                </button>
              )}
              {ex.type === "listen" && (
                <button className="d-btn ghost" style={{ width: 180 }} onClick={() => { setSkipped(skipped + 1); next(true); }}>
                  Can't listen now
                </button>
              )}
              {ex.type === "match" ? (
                <div className="d-sub" style={{ flex: 1 }}>Tap a Hebrew word, then its English.</div>
              ) : (
                <button className="d-btn" style={{ width: 200, marginInlineStart: "auto" }} disabled={!canCheck || judging} onClick={check}>
                  {judging ? <><Loader size={16} className="spin" /> Checking</> : ex.type === "new" ? "Continue" : "Check"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {quitting && (
        <div className="d-sheet" onClick={() => setQuitting(false)}>
          <div className="d-sheet-inner" onClick={(e) => e.stopPropagation()}>
            <div className="d-title d-center">Are you sure you want to quit?</div>
            <div className="d-sub d-center" style={{ marginBottom: 18 }}>You'll lose the progress in this lesson.</div>
            <button className="d-btn red" onClick={onExit}>Quit</button>
            <button className="d-btn ghost" style={{ marginTop: 10 }} onClick={() => setQuitting(false)}>Keep learning</button>
          </div>
        </div>
      )}
    </div>
  );
}
