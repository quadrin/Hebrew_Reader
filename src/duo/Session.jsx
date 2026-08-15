/* A lesson.

   Fifteen or so exercises, five hearts, a bar that only moves when you are
   right, and a mistake you got wrong comes back before the end. That last rule
   is the one that makes the queue interesting: the session is not a list, it is
   a queue that grows when you are wrong and shrinks when you are right, and the
   progress bar is a ratio of the two. */

import { useState, useEffect, useRef } from "react";
import {
  X, Heart, Volume2, Turtle, Mic, MicOff, Delete, Zap, Gem,
} from "lucide-react";

import { checkAnswer, normHe, tokenizeHe } from "./exercises.js";
import { playPhrase, sfx, stopAudio, hasSpeechRecognition, warmAudio } from "./audio.js";
import {
  useDuo, loseHeart, recordWord, addMistake, clearMistakes, finishSession,
  questProgress, refillHearts, MAX_HEARTS, HEART_REFILL_COST, gainHeart,
} from "./state.js";

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

function Speaker({ text, audio, size = 46, slow = true }) {
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button
        className="d-btn blue"
        style={{ width: size + 12, height: size, padding: 0, borderRadius: 14 }}
        onClick={() => playPhrase(text, audio)}
        aria-label="Play"
      >
        <Volume2 size={size / 2} />
      </button>
      {slow && (
        <button
          className="d-icon-btn"
          onClick={() => playPhrase(text, audio, { rate: 0.6 })}
          aria-label="Play slowly"
          style={{ color: "var(--d-blue)", borderColor: "var(--d-blue)" }}
        >
          <Turtle size={19} />
        </button>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* One exercise                                                        */
/* ------------------------------------------------------------------ */
function Exercise({ ex, response, setResponse, locked, verdict, keyboardOn, onMatchDone }) {
  const heInput = useRef(null);

  useEffect(() => {
    /* audio-first exercises play themselves, as they do in the app */
    if (ex.type === "listen" && ex.audio) playPhrase(ex.text, ex.audio);
    if (ex.type === "new") playPhrase(ex.he, ex.audio);
  }, [ex.key]);

  /* ---------- word bank ---------- */
  if (ex.type === "bank" || ex.type === "listen") {
    const picked = response || [];
    const rtl = ex.lang === "he";
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
        <div className="d-question">{ex.instruction}</div>
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
    );
  }

  /* ---------- typed ---------- */
  if (ex.type === "type") {
    const he = ex.lang === "he";
    const type = (ch) => setResponse((response || "") + ch);
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
        {he && keyboardOn && (
          <div className="d-kbd">
            {HE_KEYS.slice(0, 20).map((k, i) => (
              <button key={i} onClick={() => type(k)}>{k}</button>
            ))}
            <button className="wide" onClick={() => type(" ")}>space</button>
            <button className="wide" onClick={() => setResponse((response || "").slice(0, -1))}>
              <Delete size={14} style={{ verticalAlign: "-2px" }} />
            </button>
          </div>
        )}
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
  if (ex.type === "speak") return <Speak ex={ex} setResponse={setResponse} locked={locked} />;

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
function Speak({ ex, setResponse, locked }) {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const rec = useRef(null);
  const supported = hasSpeechRecognition();

  useEffect(() => () => { try { rec.current?.stop(); } catch (e) {} }, []);

  const start = () => {
    if (!supported || locked) return;
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new Rec();
    rec.current = r;
    r.lang = "he-IL";
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.onresult = (e) => {
      const said = [...e.results[0]].map((a) => a.transcript).join(" ");
      setHeard(said);
      /* graded on overlap, not identity — dictation of a second language is
         never going to come back verbatim */
      const want = tokenizeHe(ex.prompt).map(normHe);
      const got = new Set(tokenizeHe(said).map(normHe));
      const hit = want.filter((w) => got.has(w)).length;
      setResponse(hit / Math.max(1, want.length) >= 0.55);
    };
    r.onerror = () => { setListening(false); setResponse(false); };
    r.onend = () => setListening(false);
    setListening(true);
    try { r.start(); } catch (e) { setListening(false); }
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
        onClick={start}
        disabled={!supported || locked}
        style={{ marginTop: 10 }}
      >
        {supported ? <><Mic size={18} /> {listening ? "Listening…" : "Tap and speak"}</> : <><MicOff size={18} /> Speaking isn't available here</>}
      </button>
      {heard && <div className="d-sub" style={{ marginTop: 10 }}>Heard: <span style={{ fontFamily: "var(--d-heb)" }}>{heard}</span></div>}
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
  const [ans, setAns] = useState({ at: 0, resp: null, verdict: null });
  const response = ans.at === at ? ans.resp : null;
  const verdict = ans.at === at ? ans.verdict : null;
  const setResponse = (v) => setAns((s) => ({ at, resp: v, verdict: s.at === at ? s.verdict : null }));
  const setVerdict = (v) => setAns((s) => ({ at, resp: s.at === at ? s.resp : null, verdict: v }));
  const [combo, setCombo] = useState(0);
  const [comboFlash, setComboFlash] = useState(0);
  const [done, setDone] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [noHearts, setNoHearts] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const startedAt = useRef(Date.now());
  const tally = useRef({ correct: 0, answered: 0, mistakes: 0, listen: 0, xp: 0 });
  const finished = useRef(false);

  const ex = queue[at];
  const total = queue.length;
  const unlimited = duo.settings.unlimitedHearts;
  const hearts = unlimited ? MAX_HEARTS : duo.hearts;

  useEffect(() => { warmAudio(); return () => stopAudio(); }, []);

  /* Enter checks, then continues; digits pick options — a lesson should be
     playable without lifting your hands off the keyboard. */
  useEffect(() => {
    const onKey = (e) => {
      if (done || quitting || noHearts) return;
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

  const canCheck = (() => {
    if (!ex || verdict) return false;
    switch (ex.type) {
      case "bank": case "listen": return (response || []).length > 0;
      case "type": return !!String(response || "").trim();
      case "select": case "blank": return response != null;
      case "speak": return response != null;
      case "new": return true;
      case "match": return false;
      default: return false;
    }
  })();

  const recordWords = (ok) => {
    for (const w of ex.words || []) recordWord(w.he, w.en, meta.unit, ok);
  };

  const check = () => {
    if (!ex) return;
    const payload = ex.type === "bank" || ex.type === "listen" ? (response || []).map((p) => p.t) : response;
    const res = checkAnswer(ex, payload);

    if (ex.type === "new") { recordWords(true); return next(true); }

    tally.current.answered++;
    if (ex.type === "listen") tally.current.listen++;

    if (res.ok) {
      tally.current.correct++;
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
      addMistake({ key: ex.key + ":" + (ex.display || ""), ex: { ...ex, key: undefined } });
      if (!unlimited) {
        const left = loseHeart();
        if (left <= 0) { setVerdict(res); setTimeout(() => setNoHearts(true), 700); return; }
      }
      /* the exercise comes back before the session can end */
      setQueue((q) => [...q, { ...ex, key: ex.key + "-again", retry: true }]);
    }
    setVerdict(res);
  };

  const next = (silent) => {
    stopAudio();
    if (at + 1 >= queue.length) return finish();
    setAt(at + 1);
    if (!silent) { /* nothing else to do — the effect clears the response */ }
  };

  const onMatchDone = (clean) => {
    tally.current.answered += ex.pairs.length;
    tally.current.correct += clean ? ex.pairs.length : Math.max(1, ex.pairs.length - 1);
    for (const p of ex.pairs) recordWord(p.he, p.en, meta.unit, clean);
    setTimeout(() => next(true), 400);
  };

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    const ms = Date.now() - startedAt.current;
    const t = tally.current;
    const perfect = t.mistakes === 0;
    /* a heart earned by practising, the way Duolingo hands one back */
    if (meta.heartReward) { gainHeart(1); sfx("heart"); }
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

  /* ---------------- results ---------------- */
  if (done) {
    const t = tally.current;
    const secs = Math.round((Date.now() - startedAt.current) / 1000);
    const acc = t.answered ? Math.round((t.correct / t.answered) * 100) : 100;
    return (
      <div className="d-session">
        <div className="d-session-body d-center" style={{ paddingTop: 40 }}>
          <div className="d-grow" style={{ fontSize: 46 }}>{t.mistakes === 0 ? "🏆" : "🎉"}</div>
          <div className="d-title" style={{ fontSize: 26, color: "var(--d-gold)" }}>
            {t.mistakes === 0 ? "Perfect lesson!" : "Lesson complete!"}
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

  /* ---------------- out of hearts ---------------- */
  if (noHearts) {
    return (
      <div className="d-session">
        <div className="d-session-body d-center" style={{ paddingTop: 50 }}>
          <Heart size={64} color="var(--d-red)" fill="var(--d-red)" style={{ opacity: .35 }} />
          <div className="d-title" style={{ fontSize: 24 }}>You ran out of hearts!</div>
          <div className="d-sub">Refill to keep going, or leave and let them come back on their own — one every {30} minutes.</div>
          <div style={{ marginTop: 22, textAlign: "start" }}>
            <button className="d-btn gold" disabled={duo.gems < HEART_REFILL_COST} onClick={() => {
              if (refillHearts()) { sfx("gem"); setNoHearts(false); }
            }}>
              <Gem size={17} /> Refill for {HEART_REFILL_COST}
            </button>
            <button className="d-btn blue" style={{ marginTop: 10 }} onClick={() => onExit({ practiceForHeart: true })}>
              <Heart size={17} /> Practice to earn one heart
            </button>
            <button className="d-btn ghost" style={{ marginTop: 10 }} onClick={onExit}>End session</button>
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
        <div className={`d-stat heart ${hearts === 0 ? "dim" : ""}`}>
          {unlimited ? <><Heart size={20} fill="var(--d-red)" />∞</> : <><Heart size={20} fill={hearts ? "var(--d-red)" : "none"} />{hearts}</>}
        </div>
      </div>

      <div className="d-session-body">
        <Exercise
          ex={ex}
          response={response}
          setResponse={setResponse}
          locked={!!verdict}
          verdict={verdict ? verdict.ok : null}
          keyboardOn={duo.settings.keyboard}
          onMatchDone={onMatchDone}
        />
      </div>

      <div className={`d-footer ${verdict ? (verdict.ok ? "ok" : "no") : ""}`}>
        <div className="d-footer-inner">
          {verdict ? (
            <>
              <div className="d-verdict" style={{ color: verdict.ok ? "var(--d-green-dark)" : "var(--d-red-dark)" }}>
                {verdict.ok ? (ex.type === "new" ? "" : "Nicely done!") : "Correct solution:"}
                {!verdict.ok && verdict.solution && (
                  <small><span className={/[֐-׿]/.test(verdict.solution) ? "sol" : ""}>{verdict.solution}</span></small>
                )}
                {!verdict.ok && ex.type === "listen" && <small>{ex.solutionEn}</small>}
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
                <button className="d-btn" style={{ width: 200, marginInlineStart: "auto" }} disabled={!canCheck} onClick={check}>
                  {ex.type === "new" ? "Continue" : "Check"}
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
