import { useState, useEffect, useRef } from "react";
import {
  BookOpen, Bookmark, X, Sparkles, Languages, Volume2, Check,
  RotateCcw, Trash2, ChevronRight, ChevronLeft, GraduationCap, Star,
  Library, Plus, FileUp, Loader, Settings, Eye, EyeOff, KeyRound,
  Play, Square, Download, Upload, Puzzle, BarChart3, Keyboard, CircleCheck
} from "lucide-react";

import { CHAPTERS, GLOSS } from "./story.js";
import {
  stripWord, removeNikkud, splitSentences, paginateText, speak, warmSpeech,
  shuffle, speakOne, stopSpeech, answersMatch,
} from "./text.js";
import { extractPdf } from "./pdf.js";
import { extractEpub } from "./epub.js";
import { wiktionaryLookup } from "./dict.js";
import { storage, storageAvailable } from "./storage.js";
import { isDue, dueCount, srsAnswer, dueLabel, SRS_INTERVALS_DAYS } from "./srs.js";
import { buildBookCloze, buildSavedCloze, isContentWord } from "./cloze.js";
import {
  PROVIDERS, PROVIDER_IDS, getProvider, activate, getKeyFor, setKeyFor,
  getModelFor, setModelFor, hasApiKey, testApiKey,
  fetchQuickGloss, fetchDeepDive, fetchSentenceGlossed, fetchPageQuiz,
  fetchNikkud, fetchGrammar, fetchSimplePage,
} from "./ai.js";

/* ------------------------------------------------------------------ */
/* Design tokens — three reading themes                                */
/* ------------------------------------------------------------------ */
const THEMES = {
  paper: {
    paper: "#F5F3ED", card: "#FFFFFF", ink: "#1B2432", sub: "#5D6675",
    blue: "#1D4E89", blueSoft: "#E4EBF5", blueLine: "#B9CBE3",
    marker: "rgba(242, 201, 76, 0.45)", markerDeep: "#8F6A10",
    green: "#3E7C4F", greenSoft: "#E7F0E8", red: "#B3402E", redSoft: "#F7E7E3",
    line: "#E3E1D8", soft: "#EEEBE2", onAccent: "#FFFFFF",
  },
  sepia: {
    paper: "#F2E8D5", card: "#FBF4E3", ink: "#3D3222", sub: "#7A6F5C",
    blue: "#8C5A20", blueSoft: "#EFE2C8", blueLine: "#D8C4A0",
    marker: "rgba(242, 201, 76, 0.5)", markerDeep: "#8F6A10",
    green: "#5E7C4F", greenSoft: "#E7EDDA", red: "#A84B32", redSoft: "#F2DFD3",
    line: "#E2D5BC", soft: "#EBDFC9", onAccent: "#FFF8EC",
  },
  dark: {
    paper: "#151A22", card: "#1D242F", ink: "#E9E7E0", sub: "#9AA3B0",
    blue: "#8AB0E0", blueSoft: "#24344B", blueLine: "#3A537A",
    marker: "rgba(242, 201, 76, 0.28)", markerDeep: "#D9B14A",
    green: "#7CBB8C", greenSoft: "#1F3327", red: "#E08573", redSoft: "#3A2420",
    line: "#2A3441", soft: "#232B37", onAccent: "#10151C",
  },
};
let C = THEMES.paper;

const FONT_SCALES = [
  { id: 0.9, label: "S" },
  { id: 1, label: "M" },
  { id: 1.12, label: "L" },
  { id: 1.25, label: "XL" },
];

const HEB_FONT = "'Frank Ruhl Libre', 'SBL Hebrew', 'David', 'Times New Roman', serif";
const UI_FONT = "'Rubik', -apple-system, 'Segoe UI', sans-serif";
const STORAGE_KEY = "lavan-hebrew-reader-v1";
const BOOK_KEY = (id) => `lavan-book-${id}`;
const NIKKUD_KEY = (id) => `lavan-nikkud-${id}`;
const SIMPLE_KEY = (id) => `lavan-simple-${id}`;

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */
function SpeakBtn({ text, size = 16, style }) {
  return (
    <button className="icon-btn" style={style} onClick={(e) => { e.stopPropagation(); speak(text); }} aria-label="Listen">
      <Volume2 size={size} strokeWidth={2} />
    </button>
  );
}

function Word({ token, nikkud, saved, active, onTap, onUnsave, gloss, interlinear }) {
  const stripped = stripWord(token);
  const display = nikkud ? token : removeNikkud(token);
  /* Press-and-hold a saved (gold) word to un-save it right in the text.
     The hold timer arms on pointerdown; a scroll or drag cancels it, and a
     fired hold swallows the click that follows so the sheet doesn't open. */
  const hold = useRef({ t: null, fired: false });
  if (!stripped) {
    return interlinear ? (
      <span className="iword">
        <span className="igloss">{" "}</span>
        <span style={{ color: C.sub }}>{display}</span>
      </span>
    ) : (
      <span style={{ color: C.sub }}>{display} </span>
    );
  }
  const armHold = () => {
    /* a fresh press always clears the suppression flag — if the unsave
       re-rendered this word mid-hold, the browser never fired the click
       that would have consumed it, and a stale flag would eat the next tap */
    hold.current.fired = false;
    if (!saved || !onUnsave) return;
    clearTimeout(hold.current.t);
    hold.current.t = setTimeout(() => {
      hold.current.fired = true;
      try { navigator.vibrate?.(15); } catch (e) { /* no haptics */ }
      onUnsave(stripped);
    }, 550);
  };
  const cancelHold = () => clearTimeout(hold.current.t);
  const heSpan = (
    <span
      className="word"
      style={{
        background: active ? C.blueSoft : saved ? C.marker : "transparent",
        boxShadow: active ? `0 0 0 2px ${C.blueLine}` : "none",
      }}
      onPointerDown={armHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onContextMenu={(e) => { if (saved) e.preventDefault(); }}
      onClick={() => {
        if (hold.current.fired) { hold.current.fired = false; return; }
        onTap(stripped);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTap(stripped); } }}
    >
      {display}
    </span>
  );
  if (!interlinear) return <>{heSpan}{" "}</>;
  return (
    <span className="iword">
      <span className="igloss" dir="ltr" title={gloss || undefined}>{gloss || " "}</span>
      {heSpan}
    </span>
  );
}

function Sentence({
  sent, id, fontSize, nikkud, savedWords, activeWord, onTapWord, onUnsaveWord, open, enText,
  enLoading, glosses, onToggleEn, aiOn, onOpenSettings, playingNow,
  grammar, gramLoading, onGrammar, fav, onToggleFav, inlineGlosses,
}) {
  const tokens = sent.he.split(" ");
  /* Interlinear mode: while the translation is open, each word carries its
     English gloss right above it */
  const interlinear = open && Array.isArray(glosses);
  return (
    <div id={id} style={{ marginBottom: 4, ...(playingNow ? { background: C.blueSoft, borderRadius: 10, padding: "0 6px", transition: "background .2s" } : {}) }}>
      <div dir="rtl" style={{ fontFamily: HEB_FONT, fontSize, lineHeight: 2.05, color: C.ink }}>
        {tokens.map((t, i) => {
          /* a word the reader tapped shows its own gloss above it, even with
             the sentence translation closed */
          const s = stripWord(t);
          const tapG = !interlinear && s ? inlineGlosses?.[`${sent.he}#${s}`] : undefined;
          return (
            <Word
              key={i}
              token={t}
              nikkud={nikkud}
              saved={!!savedWords[s]}
              active={activeWord === s}
              onTap={(w) => onTapWord(w, sent)}
              onUnsave={onUnsaveWord}
              gloss={interlinear ? glosses[i] : (tapG ?? null)}
              interlinear={interlinear || tapG !== undefined}
            />
          );
        })}
        <button
          className="en-chip"
          style={{
            background: open ? C.blueSoft : "transparent",
            borderColor: open ? C.blueLine : C.line,
            color: open ? C.blue : C.sub,
          }}
          onClick={onToggleEn}
          aria-label="Show English translation"
        >
          <Languages size={13} strokeWidth={2.2} />
        </button>
        <button
          className="en-chip"
          style={{
            background: fav ? C.marker : "transparent",
            borderColor: fav ? "transparent" : C.line,
            color: fav ? C.markerDeep : C.sub,
          }}
          onClick={onToggleFav}
          aria-label={fav ? "Remove sentence from favorites" : "Save this sentence"}
          aria-pressed={!!fav}
        >
          <Star size={13} strokeWidth={2.2} fill={fav ? "currentColor" : "none"} />
        </button>
      </div>
      {open && (
        <div dir="ltr" className="en-reveal" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {enLoading ? (
              <span className="pulse" style={{ flex: 1 }}>Translating…</span>
            ) : enText ? (
              <>
                <span style={{ flex: 1 }}>{enText}</span>
                <SpeakBtn text={sent.he} size={15} />
                {!grammar && !gramLoading && (
                  <button className="icon-btn" onClick={() => onGrammar(sent)} aria-label="Grammar breakdown" title="Grammar breakdown">
                    <GraduationCap size={15} />
                  </button>
                )}
              </>
            ) : !aiOn ? (
              <span style={{ flex: 1 }}>
                Translations come from the AI tutor.{" "}
                <button className="inline-link" onClick={() => onOpenSettings("Sentence translation uses the AI tutor — add an API key from Claude, ChatGPT, or Gemini to turn it on.")}>
                  Add an API key
                </button>{" "}
                (Claude, ChatGPT, or Gemini) to enable them.
              </span>
            ) : (
              <span style={{ flex: 1 }}>Tap the icon to close and try again.</span>
            )}
          </div>
          {gramLoading && <span className="pulse" style={{ fontSize: 13 }}>Parsing the grammar…</span>}
          {grammar && (
            <ul style={{ margin: "2px 0 0", paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 3 }}>
              {grammar.map((p, i) => (
                <li key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Word bottom sheet                                                   */
/* ------------------------------------------------------------------ */
function WordSheet({ sheet, dive, aiOn, onAsk, onOpenSettings, onClose, savedNow, knownNow, onToggleSave, onToggleKnown, onRefresh }) {
  if (!sheet) return null;
  const { word, gloss, note, glossLoading, glossError, aiMissing, sent, freq, source } = sheet;
  const d = dive[word];
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Word details">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 38, fontWeight: 700, color: C.ink, lineHeight: 1.5 }}>{word}</span>
              <SpeakBtn text={word} size={18} />
              {!glossLoading && (
                <button className="icon-btn" onClick={() => onRefresh(sheet)} aria-label="Look this word up again" title="Look this word up again — replaces the saved meaning">
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
            <div style={{ fontSize: 17, color: C.ink, marginTop: 2, minHeight: 22 }}>
              {glossLoading ? <span className="pulse" style={{ color: C.sub, fontSize: 15 }}>Looking it up…</span>
                : glossError ? <span style={{ color: C.sub, fontSize: 15 }}>Lookup failed — try the tutor below.</span>
                : aiMissing && !gloss ? (
                  <span style={{ color: C.sub, fontSize: 15 }}>
                    No dictionary entry found. An{" "}
                    <button className="inline-link" onClick={() => onOpenSettings("The AI tutor can define any word you tap, in context — add an API key from Claude, ChatGPT, or Gemini.")}>
                      AI API key
                    </button>{" "}
                    lets the tutor define any word, in context.
                  </span>
                )
                : (gloss || "No quick gloss — ask the tutor below.")}
            </div>
            {note && !glossLoading && <div style={{ fontSize: 13.5, color: C.sub, marginTop: 5, lineHeight: 1.5 }}>{note}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button
                className="chip"
                style={savedNow
                  ? { color: C.markerDeep, background: C.marker, borderColor: "transparent", cursor: "pointer" }
                  : { cursor: "pointer" }}
                onClick={() => onToggleSave(word)}
                aria-pressed={savedNow}
                title={savedNow ? "Remove from My Words" : "Save to My Words"}
              >
                <Star size={13} fill={savedNow ? "currentColor" : "none"} strokeWidth={savedNow ? 0 : 2} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                {savedNow ? "In My Words · remove" : "Save to My Words"}
              </button>
              <button
                className="chip"
                style={knownNow
                  ? { color: C.green, background: C.greenSoft, borderColor: "transparent", cursor: "pointer" }
                  : { cursor: "pointer" }}
                onClick={() => onToggleKnown(word)}
                aria-pressed={knownNow}
                title="Known words are skipped by drills and counted by the page meter"
              >
                <CircleCheck size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                {knownNow ? "I know this" : "Mark as known"}
              </button>
              {source === "wiktionary" && !glossLoading && <span className="chip">Wiktionary</span>}
              {freq >= 2 && <span className="chip">appears {freq}× in this book</span>}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <div style={{ marginTop: 14 }}>
          {!d && (
            <button className="tutor-btn" onClick={() => onAsk(sheet)}>
              <Sparkles size={16} /> Ask the tutor about this word
            </button>
          )}
          {d?.loading && (
            <div className="tutor-box" style={{ color: C.sub, fontSize: 14 }}>
              <span className="pulse">The tutor is thinking…</span>
            </div>
          )}
          {d?.error && (
            <div className="tutor-box" style={{ fontSize: 14 }}>
              <div style={{ color: C.red, marginBottom: 8 }}>Couldn't reach the tutor. Check your connection and try again.</div>
              <button className="tutor-btn" onClick={() => onAsk(sheet, true)}><RotateCcw size={14} /> Try again</button>
            </div>
          )}
          {d?.data && (
            <div className="tutor-box">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {d.data.translit && <span className="chip" style={{ fontStyle: "italic" }}>{d.data.translit}</span>}
                {d.data.root && <span className="chip" dir="rtl">{d.data.root}</span>}
                {d.data.pos && <span className="chip">{d.data.pos}</span>}
              </div>
              {d.data.tip && <div style={{ fontSize: 14.5, color: C.ink, lineHeight: 1.55 }}>{d.data.tip}</div>}
              {Array.isArray(d.data.examples) && d.data.examples.length > 0 && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
                  {d.data.examples.map((ex, i) => (
                    <div key={i} style={{ marginBottom: i === d.data.examples.length - 1 ? 0 : 10 }}>
                      <div dir="rtl" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: HEB_FONT, fontSize: 20, color: C.ink, lineHeight: 1.8 }}>{ex.he}</span>
                        <SpeakBtn text={ex.he} size={14} />
                      </div>
                      <div style={{ fontSize: 13.5, color: C.sub }}>{ex.en}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {sent && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: C.sub }}>
            From: <span dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 15, color: C.ink }}>{sent.he}</span>
          </div>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Settings — AI tutor, reading preferences, and data                  */
/* ------------------------------------------------------------------ */
function SettingsSheet({ open, note, onClose, onChanged, prefs, onPrefs, wordCount, onExportBackup, onRestoreBackup, onExportAnki }) {
  const [provider, setProviderChoice] = useState(getProvider());
  const [key, setKey] = useState("");
  const [model, setModelChoice] = useState(() => getModelFor(getProvider()));
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState(null); /* {kind:'testing'|'ok'|'error', msg} */
  const restoreRef = useRef(null);

  const loadProvider = (p) => {
    setProviderChoice(p);
    setKey(getKeyFor(p));
    setModelChoice(getModelFor(p));
    setShowKey(false);
    setStatus(null);
  };

  useEffect(() => {
    if (open) loadProvider(getProvider());
  }, [open]);

  if (!open) return null;

  const P = PROVIDERS[provider];
  const activeProvider = getProvider();
  const tutorOn = hasApiKey();

  const save = async () => {
    const trimmed = key.trim();
    setModelFor(provider, model);
    if (!trimmed) {
      setKeyFor(provider, "");
      onChanged();
      setStatus({
        kind: "ok",
        msg: provider === activeProvider
          ? "Key removed — the tutor is off. The built-in story still works fully."
          : `${P.short} key removed.`,
      });
      return;
    }
    setStatus({ kind: "testing", msg: `Checking your ${P.short} key with a tiny test request…` });
    try {
      await testApiKey(provider, trimmed, model);
      setKeyFor(provider, trimmed);
      activate(provider);
      onChanged();
      setStatus({ kind: "ok", msg: `Connected — the tutor now runs on ${P.short}. Tap any word to try it.` });
    } catch (e) {
      const rejected = e.status === 401 || e.status === 403 ||
        /api key not valid|invalid api key|incorrect api key/i.test(e.message || "");
      setStatus({
        kind: "error",
        msg: rejected ? "That key was rejected — double-check it and try again."
          : e.status === 429 ? "The key works, but you're rate-limited right now — try again in a minute."
          : `Couldn't reach ${P.short}: ${e.message}`,
      });
    }
  };

  const removeKey = () => {
    setKey("");
    setKeyFor(provider, "");
    onChanged();
    setStatus({
      kind: "ok",
      msg: provider === activeProvider ? "Key removed — the tutor is off." : `${P.short} key removed.`,
    });
  };

  return (
    <>
      <div className="backdrop" style={{ zIndex: 75 }} onClick={onClose} />
      <div className="sheet" style={{ zIndex: 76 }} role="dialog" aria-label="Settings">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="quiz-badge"><KeyRound size={16} /></div>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 17 }}>Settings</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings"><X size={20} /></button>
        </div>

        {note && (
          <div style={{ background: C.blueSoft, border: `1px solid ${C.blueLine}`, borderRadius: 12, padding: "10px 12px", fontSize: 13.5, color: C.blue, marginTop: 12, lineHeight: 1.5 }}>
            {note}
          </div>
        )}

        {/* ---------- AI tutor ---------- */}
        <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, marginTop: 12 }}>
          Tap-to-define for new words, sentence translations, grammar breakdowns, nikkud, and page quizzes are
          powered by an AI tutor. Bring your own API key from Anthropic, OpenAI, or Google — the built-in
          story works fully without one.
        </div>

        {tutorOn && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 13, color: C.green, fontWeight: 500 }}>
            <Check size={14} strokeWidth={2.6} />
            Tutor is on — using {PROVIDERS[activeProvider].short} ({getModelFor(activeProvider)})
          </div>
        )}

        <div className="field-label">AI provider</div>
        <select className="text-input" aria-label="AI provider" value={provider} onChange={(e) => loadProvider(e.target.value)}>
          {PROVIDER_IDS.map((id) => (
            <option key={id} value={id}>{PROVIDERS[id].label}</option>
          ))}
        </select>

        <div className="field-label">{P.short} API key</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="text-input"
            style={{ flex: 1 }}
            type={showKey ? "text" : "password"}
            value={key}
            onChange={(e) => { setKey(e.target.value); setStatus(null); }}
            placeholder={P.keyPlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="ghost-btn" style={{ padding: "0 14px" }} onClick={() => setShowKey((v) => !v)} aria-label={showKey ? "Hide key" : "Show key"}>
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>
          Create one at{" "}
          <a className="inline-link" href={P.keyUrl} target="_blank" rel="noreferrer">
            {P.keyUrlLabel}
          </a>. Lookups cost a fraction of a cent each.
        </div>

        <div className="field-label">Tutor model</div>
        <select className="text-input" aria-label="Tutor model" value={model} onChange={(e) => setModelChoice(e.target.value)}>
          {P.models.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="primary-btn" style={{ flex: 2 }} disabled={status?.kind === "testing"} onClick={save}>
            {status?.kind === "testing" ? "Checking…" : key.trim() ? "Save & test" : "Save"}
          </button>
          {!!getKeyFor(provider) && (
            <button className="ghost-btn" style={{ flex: 1 }} onClick={removeKey}>Remove key</button>
          )}
        </div>

        {status && (
          <div style={{
            marginTop: 10, fontSize: 13.5, lineHeight: 1.5, borderRadius: 10, padding: "9px 12px",
            background: status.kind === "error" ? C.redSoft : status.kind === "ok" ? C.greenSoft : C.soft,
            color: status.kind === "error" ? C.red : status.kind === "ok" ? C.green : C.sub,
          }}>
            {status.msg}
          </div>
        )}

        {/* ---------- Reading ---------- */}
        <div className="field-label" style={{ marginTop: 22 }}>Theme</div>
        <div className="seg" role="group" aria-label="Theme">
          {[["paper", "Paper"], ["sepia", "Sepia"], ["dark", "Dark"]].map(([id, label]) => (
            <button key={id} className={prefs.theme === id ? "on" : ""} onClick={() => onPrefs({ ...prefs, theme: id })}>{label}</button>
          ))}
        </div>
        <div className="field-label">Text size</div>
        <div className="seg" role="group" aria-label="Text size">
          {FONT_SCALES.map((f) => (
            <button key={f.id} className={prefs.fontScale === f.id ? "on" : ""} onClick={() => onPrefs({ ...prefs, fontScale: f.id })}>{f.label}</button>
          ))}
        </div>

        {/* ---------- Your data ---------- */}
        <div className="field-label" style={{ marginTop: 22 }}>Your data</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="ghost-btn" onClick={onExportBackup}><Download size={15} /> Download backup (books, words, progress)</button>
          <button className="ghost-btn" onClick={() => restoreRef.current?.click()}><Upload size={15} /> Restore from backup</button>
          <input ref={restoreRef} type="file" accept=".json,application/json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onRestoreBackup(f); e.target.value = ""; }} />
          {wordCount > 0 && (
            <button className="ghost-btn" onClick={onExportAnki}><Download size={15} /> Export My Words as an Anki deck</button>
          )}
        </div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 8, lineHeight: 1.5 }}>
          Everything lives in this browser only — clearing site data erases it, so keep a backup.
          Backups never include your API keys.
        </div>

        <div style={{ marginTop: 14, fontSize: 12, color: C.sub, lineHeight: 1.55, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
          Your key is stored only in this browser and sent only to the provider you chose. When you use the
          tutor, the tapped word or sentence is sent to that provider to write the explanation — nothing else
          leaves your device. Keys for each provider are kept separately, so you can switch any time.
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Quiz (shared by the built-in story and generated page quizzes)      */
/* ------------------------------------------------------------------ */
function QuizBlock({ questions, picked, submitted, onPick, onSubmit, onRetry, footer, headerNote }) {
  const allAnswered = questions.every((_, qi) => picked[qi] !== undefined);
  const score = submitted ? questions.filter((q, qi) => picked[qi] === q.correct).length : 0;
  return (
    <div className="quiz-card">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div className="quiz-badge"><GraduationCap size={16} /></div>
        <div>
          <div dir="rtl" style={{ fontFamily: HEB_FONT, fontWeight: 700, fontSize: 20, color: C.ink }}>הֲבָנַת הַנִּקְרָא</div>
          <div style={{ fontSize: 12.5, color: C.sub, letterSpacing: 0.3, textTransform: "uppercase" }}>{headerNote}</div>
        </div>
      </div>

      {questions.map((q, qi) => (
        <div key={qi} style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 500, fontSize: 15.5, color: C.ink, marginBottom: 8 }}>{qi + 1}. {q.q}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {q.opts.map((opt, oi) => {
              const chosen = picked[qi] === oi;
              let bg = C.card, border = C.line, color = C.ink, icon = null;
              if (!submitted && chosen) { bg = C.blueSoft; border = C.blue; }
              if (submitted) {
                if (oi === q.correct) { bg = C.greenSoft; border = C.green; icon = <Check size={16} color={C.green} strokeWidth={2.6} />; }
                else if (chosen) { bg = C.redSoft; border = C.red; color = C.red; icon = <X size={16} color={C.red} strokeWidth={2.6} />; }
              }
              return (
                <button key={oi} className="opt" disabled={submitted} style={{ background: bg, borderColor: border, color }} onClick={() => onPick(qi, oi)}>
                  <span style={{ flex: 1, textAlign: "left" }}>{opt}</span>
                  {icon}
                </button>
              );
            })}
          </div>
          {submitted && q.ev && (
            <div className="evidence">
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 3, letterSpacing: 0.3, textTransform: "uppercase" }}>In the text</div>
              <div dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 19, color: C.ink, lineHeight: 1.9 }}>{q.ev}</div>
            </div>
          )}
        </div>
      ))}

      <div style={{ marginTop: 18 }}>
        {!submitted ? (
          <button className="primary-btn" disabled={!allAnswered} onClick={onSubmit}>Check my answers</button>
        ) : (
          <div>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: score === questions.length ? C.green : C.ink }}>{score} / {questions.length}</div>
              <div style={{ fontSize: 13.5, color: C.sub }}>
                {score === questions.length ? "!כָּל הַכָּבוֹד — perfect" : "Read the highlighted lines and try again if you like."}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ghost-btn" style={{ flex: 1 }} onClick={onRetry}><RotateCcw size={15} /> Retry</button>
              {footer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Flashcard review — spaced repetition (Leitner)                      */
/* ------------------------------------------------------------------ */
function Review({ words, onAnswer, onClose, typeAnswers, onToggleType }) {
  const [practice] = useState(() => !Object.keys(words).some((w) => isDue(words[w])));
  const [queue, setQueue] = useState(() => {
    const due = Object.keys(words).filter((w) => isDue(words[w]));
    return shuffle(due.length ? due : Object.keys(words));
  });
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedResult, setTypedResult] = useState(null); /* {correct, gaveUp} */
  const [got, setGot] = useState(0);
  const requeued = useRef({});
  const done = i >= queue.length;
  const word = queue[i];
  const entry = words[word] || {};
  /* typing needs a prompt to produce the word from — cards without a gloss
     fall back to the classic flip card */
  const canType = typeAnswers && !!entry.g;

  const answer = (knew) => {
    onAnswer(word, knew);
    if (knew) setGot((g) => g + 1);
    else if (!requeued.current[word]) {
      requeued.current[word] = true;
      setQueue((q) => [...q, word]); /* missed cards come back at the end */
    }
    setFlipped(false);
    setTyped("");
    setTypedResult(null);
    setI((x) => x + 1);
  };

  const checkTyped = () => {
    if (typedResult || !typed.trim()) return;
    setTypedResult({ correct: answersMatch(typed, word) });
  };

  /* the word's source sentence, with the word itself blanked out */
  const blankedSent = entry.sent
    ? entry.sent.split(" ").map((t) => (stripWord(t) === word ? "____" : t)).join(" ")
    : "";

  return (
    <div className="review-wrap">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", gap: 8 }}>
        <div style={{ flex: 1, fontSize: 13.5, color: C.sub, fontWeight: 500 }}>
          {done ? "Review finished" : `Card ${i + 1} of ${queue.length}${practice ? " · extra practice" : " · due today"}`}
        </div>
        {!done && (
          <button
            className="chip"
            style={{ cursor: "pointer", ...(typeAnswers ? { background: C.blueSoft, borderColor: C.blueLine, color: C.blue } : {}) }}
            onClick={onToggleType}
            aria-pressed={typeAnswers}
            title="Type the Hebrew from its meaning instead of flipping the card"
          >
            <Keyboard size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            {typeAnswers ? "Typing" : "Flip cards"}
          </button>
        )}
        <button className="icon-btn" onClick={onClose} aria-label="Close review"><X size={20} /></button>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px 40px" }}>
        {!done ? canType ? (
          <>
            <div className="flashcard" style={{ cursor: "default" }}>
              <div style={{ fontSize: 19, color: C.ink, textAlign: "center", lineHeight: 1.5 }}>{entry.g}</div>
              {blankedSent && (
                <div dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 16, color: C.sub, marginTop: 10, lineHeight: 1.8, textAlign: "center" }}>{blankedSent}</div>
              )}
              {typedResult && (
                <div style={{ marginTop: 14, textAlign: "center" }}>
                  <div dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 38, fontWeight: 700, color: typedResult.correct ? C.green : C.red, lineHeight: 1.5 }}>{word}</div>
                  <div style={{ marginTop: 4 }}><SpeakBtn text={word} size={18} /></div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6, color: typedResult.correct ? C.green : C.red }}>
                    {typedResult.correct ? "נָכוֹן! Correct" : typedResult.gaveUp ? "This one comes back later" : `You typed: ${typed}`}
                  </div>
                </div>
              )}
            </div>
            <form style={{ width: "100%", maxWidth: 360 }} onSubmit={(e) => { e.preventDefault(); checkTyped(); }}>
              {!typedResult ? (
                <>
                  <input
                    className="text-input"
                    dir="rtl"
                    style={{ fontFamily: HEB_FONT, fontSize: 20, marginTop: 18, textAlign: "center" }}
                    placeholder="הקלידו את המילה…"
                    aria-label="Type the Hebrew word"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <button type="button" className="ghost-btn" style={{ flex: 1 }} onClick={() => setTypedResult({ correct: false, gaveUp: true })}>Show answer</button>
                    <button type="submit" className="primary-btn" style={{ flex: 1, opacity: typed.trim() ? 1 : 0.5 }} disabled={!typed.trim()}>Check</button>
                  </div>
                </>
              ) : (
                <button type="button" className="primary-btn" style={{ width: "100%", marginTop: 18, background: typedResult.correct ? C.green : C.blue }} onClick={() => answer(typedResult.correct)}>
                  Next
                </button>
              )}
            </form>
          </>
        ) : (
          <>
            <div className="flashcard" onClick={() => setFlipped(true)}>
              <div dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 44, fontWeight: 700, color: C.ink, lineHeight: 1.6, textAlign: "center" }}>{word}</div>
              <div style={{ marginTop: 6 }}><SpeakBtn text={word} size={20} /></div>
              {flipped ? (
                <div style={{ marginTop: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 19, color: C.ink }}>{entry.g || "—"}</div>
                  {entry.n && <div style={{ fontSize: 13.5, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>{entry.n}</div>}
                  {entry.sent && (
                    <div dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 16, color: C.sub, marginTop: 8, lineHeight: 1.7 }}>{entry.sent}</div>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 16, fontSize: 13, color: C.sub, letterSpacing: 0.3 }}>tap to reveal</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22, width: "100%", maxWidth: 360 }}>
              <button className="ghost-btn" style={{ flex: 1, opacity: flipped ? 1 : 0.4 }} disabled={!flipped} onClick={() => answer(false)}>Again</button>
              <button className="primary-btn" style={{ flex: 1, background: C.green, opacity: flipped ? 1 : 0.4 }} disabled={!flipped} onClick={() => answer(true)}>Got it</button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 44 }}>🐈</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.ink, marginTop: 8 }}>{got} of {queue.length} known</div>
            <div style={{ fontSize: 14.5, color: C.sub, marginTop: 6 }}>
              {got === queue.length ? "!מְצֻיָּן — excellent" : "Missed words will come back sooner."}
            </div>
            <button className="primary-btn" style={{ marginTop: 20 }} onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cloze practice — fill the blank in real sentences                   */
/* ------------------------------------------------------------------ */
function ClozeOverlay({ items, savedWords, onSrsAnswer, onClose, fontScale, typeAnswers, onToggleType }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);       /* choice mode */
  const [typed, setTyped] = useState("");           /* typing mode */
  const [typedResult, setTypedResult] = useState(null); /* {correct, gaveUp} */
  const [score, setScore] = useState(0);
  const done = i >= items.length;
  const item = items[i];
  const answered = picked !== null || typedResult !== null;
  const wasCorrect = picked !== null ? picked === item?.correctIdx : !!typedResult?.correct;

  const applyAnswer = (correct) => {
    if (correct) setScore((s) => s + 1);
    const w = item.savedWord || (savedWords[item.answer] ? item.answer : null);
    if (w) onSrsAnswer(w, correct);
  };

  const pick = (oi) => {
    if (answered) return;
    setPicked(oi);
    applyAnswer(oi === item.correctIdx);
  };

  const checkTyped = () => {
    if (answered || !typed.trim()) return;
    const correct = answersMatch(typed, item.answer);
    setTypedResult({ correct });
    applyAnswer(correct);
  };

  const giveUp = () => {
    if (answered) return;
    setTypedResult({ correct: false, gaveUp: true });
    applyAnswer(false);
  };

  const next = () => {
    setPicked(null);
    setTyped("");
    setTypedResult(null);
    setI((x) => x + 1);
  };

  return (
    <div className="review-wrap">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", gap: 8 }}>
        <div style={{ flex: 1, fontSize: 13.5, color: C.sub, fontWeight: 500 }}>
          {done ? "Practice finished" : `Fill the blank · ${i + 1} of ${items.length}`}
        </div>
        {!done && (
          <button
            className="chip"
            style={{ cursor: "pointer", ...(typeAnswers ? { background: C.blueSoft, borderColor: C.blueLine, color: C.blue } : {}) }}
            onClick={onToggleType}
            aria-pressed={typeAnswers}
            title="Switch between multiple choice and typing the answer"
          >
            <Keyboard size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            {typeAnswers ? "Typing" : "Choices"}
          </button>
        )}
        <button className="icon-btn" onClick={onClose} aria-label="Close practice"><X size={20} /></button>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px 40px" }}>
        {!done ? (
          <div style={{ width: "100%", maxWidth: 480 }}>
            <div dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: Math.round(24 * fontScale), lineHeight: 2.1, color: C.ink, background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: "18px 20px" }}>
              {item.tokens.map((t, ti) =>
                ti === item.blankIdx ? (
                  <span key={ti} className="cloze-blank" style={answered ? { color: wasCorrect ? C.green : C.red, borderColor: wasCorrect ? C.green : C.red } : {}}>
                    {answered ? item.answer : "?"}
                  </span>
                ) : (
                  <span key={ti}>{t} </span>
                )
              )}
            </div>
            {typeAnswers ? (
              <form onSubmit={(e) => { e.preventDefault(); checkTyped(); }}>
                <input
                  className="text-input"
                  dir="rtl"
                  style={{ fontFamily: HEB_FONT, fontSize: 20, marginTop: 16, textAlign: "center" }}
                  placeholder="הקלידו את המילה החסרה…"
                  aria-label="Type the missing word"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={answered}
                />
                {!answered && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button type="button" className="ghost-btn" style={{ flex: 1 }} onClick={giveUp}>Show answer</button>
                    <button type="submit" className="primary-btn" style={{ flex: 1, opacity: typed.trim() ? 1 : 0.5 }} disabled={!typed.trim()}>Check</button>
                  </div>
                )}
              </form>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
                {item.options.map((opt, oi) => {
                  let bg = C.card, border = C.line, color = C.ink;
                  if (picked !== null) {
                    if (oi === item.correctIdx) { bg = C.greenSoft; border = C.green; }
                    else if (oi === picked) { bg = C.redSoft; border = C.red; color = C.red; }
                  }
                  return (
                    <button key={oi} dir="rtl" className="opt" disabled={picked !== null}
                      style={{ background: bg, borderColor: border, color, fontFamily: HEB_FONT, fontSize: 19, justifyContent: "center" }}
                      onClick={() => pick(oi)}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}
            {answered && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                <div style={{ flex: 1, fontSize: 14, color: wasCorrect ? C.green : C.red, fontWeight: 600 }}>
                  {wasCorrect ? "נָכוֹן! Correct" : typedResult?.gaveUp ? "The answer is above" : "Not this time"}
                </div>
                <SpeakBtn text={item.sentence} size={16} />
                <button className="primary-btn" style={{ width: "auto", padding: "10px 22px" }} onClick={next}>
                  {i + 1 >= items.length ? "Finish" : "Next"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 44 }}>🐈</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.ink, marginTop: 8 }}>{score} of {items.length}</div>
            <div style={{ fontSize: 14.5, color: C.sub, marginTop: 6 }}>
              {score === items.length ? "!כָּל הַכָּבוֹד — perfect" : "Real sentences are the best teachers — go again any time."}
            </div>
            <button className="primary-btn" style={{ marginTop: 20 }} onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Common words in this book                                           */
/* ------------------------------------------------------------------ */
function CommonWordsSheet({ open, words, stats, onPick, onClose }) {
  if (!open) return null;
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Common words in this book">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div className="quiz-badge"><BarChart3 size={16} /></div>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 17 }}>Common words in this book</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>
          Learn these first — they pay off on every page. Tap one to look it up and save it.
        </div>
        {stats && (
          <div style={{ fontSize: 13, color: C.green, fontWeight: 600, marginBottom: 10 }}>
            <CircleCheck size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            You know {stats.known} of {stats.distinct} distinct words in this book.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {words.length === 0 && (
            <div style={{ fontSize: 14, color: C.sub, padding: "14px 4px", textAlign: "center" }}>
              This book is too short for a frequency list — no word repeats yet.
            </div>
          )}
          {words.map(({ w, c, known, mastered }) => (
            <button key={w} className="word-row" style={{ cursor: "pointer", width: "100%", border: `1px solid ${C.line}` }} onClick={() => onPick(w)}>
              <span dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 21, fontWeight: 500, color: C.ink, background: known ? C.marker : "transparent", borderRadius: 6, padding: "0 6px" }}>{w}</span>
              {mastered && <CircleCheck size={15} color={C.green} />}
              <span style={{ flex: 1 }} />
              <span className="chip">{c}×</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Library screen                                                      */
/* ------------------------------------------------------------------ */
function LibraryScreen({ books, current, importing, onOpenLavan, onOpenBook, onDeleteBook, onImportFile, onImportText, lavanDone }) {
  const fileRef = useRef(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteVal, setPasteVal] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");

  return (
    <main style={{ paddingTop: 18 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Library</div>
      <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 16 }}>Built-in stories plus any Hebrew book you load from your device.</div>

      {/* Built-in */}
      <button className="book-row" onClick={onOpenLavan} style={current?.type === "lavan" ? { borderColor: C.blue } : {}}>
        <div className="book-cover" style={{ background: C.blueSoft, color: C.blue }}>
          <span dir="rtl" style={{ fontFamily: HEB_FONT, fontWeight: 700, fontSize: 22 }}>לָבָן</span>
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontWeight: 600, fontSize: 15.5 }}>Lavan · לָבָן</div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>Built-in graded story · beginner · nikkud</div>
          <div style={{ fontSize: 12.5, color: lavanDone === CHAPTERS.length ? C.green : C.sub, marginTop: 2 }}>
            {lavanDone} of {CHAPTERS.length} chapters complete
          </div>
        </div>
        <ChevronRight size={18} color={C.sub} />
      </button>

      {/* Imported books */}
      {Object.entries(books).map(([id, b]) => (
        <div className="book-row" key={id} style={current?.type === "book" && current.id === id ? { borderColor: C.blue } : {}}>
          <button style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: UI_FONT }} onClick={() => onOpenBook(id)}>
            <div className="book-cover" style={{ background: C.soft, color: C.ink }}>
              <BookOpen size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div dir="auto" style={{ fontWeight: 600, fontSize: 15.5, fontFamily: /[֐-׿]/.test(b.title) ? HEB_FONT : UI_FONT, color: C.ink }}>{b.title}</div>
              <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
                Page {(b.page || 0) + 1} of {b.pageCount}{b.ephemeral ? " · this session only" : ""}
              </div>
            </div>
          </button>
          <button className="icon-btn" onClick={() => onDeleteBook(id)} aria-label={`Remove ${b.title}`}><Trash2 size={16} /></button>
          <button className="icon-btn" onClick={() => onOpenBook(id)} aria-label={`Open ${b.title}`}><ChevronRight size={18} /></button>
        </div>
      ))}

      {/* Import */}
      <div style={{ background: C.card, border: `1.5px dashed ${C.blueLine}`, borderRadius: 16, padding: 18, marginTop: 14 }}>
        {importing ? (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <Loader size={22} color={C.blue} className="spin" />
            <div style={{ fontSize: 14.5, fontWeight: 500, marginTop: 8 }}>Reading your book…</div>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>{importing.done} of {importing.total} pages</div>
            <div style={{ height: 6, background: C.soft, borderRadius: 999, marginTop: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round((importing.done / Math.max(importing.total, 1)) * 100)}%`, background: C.blue, transition: "width .3s" }} />
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 600, fontSize: 15.5, display: "flex", alignItems: "center", gap: 7 }}><Plus size={17} /> Add your own book</div>
            <div style={{ fontSize: 13.5, color: C.sub, marginTop: 5, lineHeight: 1.55 }}>
              Pick a Hebrew PDF, EPUB, or text file from your device. It's read right here in your browser — every word becomes tappable, and the tutor can quiz you on any page.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="primary-btn" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>
                <FileUp size={16} /> Choose a file
              </button>
              <button className="ghost-btn" style={{ flex: 1 }} onClick={() => setPasteOpen((v) => !v)}>Paste text</button>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.txt,.epub,text/plain,application/pdf,application/epub+zip" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ""; }} />
            {pasteOpen && (
              <div style={{ marginTop: 12 }}>
                <input
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="Title"
                  style={{ width: "100%", border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14.5, fontFamily: UI_FONT, marginBottom: 8, background: C.paper, color: C.ink }}
                />
                <textarea
                  dir="rtl"
                  value={pasteVal}
                  onChange={(e) => setPasteVal(e.target.value)}
                  placeholder="הדביקו כאן טקסט בעברית…"
                  rows={5}
                  style={{ width: "100%", border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 17, fontFamily: HEB_FONT, background: C.paper, color: C.ink, resize: "vertical" }}
                />
                <button className="primary-btn" style={{ marginTop: 8 }} disabled={!pasteVal.trim()}
                  onClick={() => { onImportText(pasteTitle.trim() || "Pasted text", pasteVal); setPasteVal(""); setPasteTitle(""); setPasteOpen(false); }}>
                  Add to library
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Main app                                                            */
/* ------------------------------------------------------------------ */
export default function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("read");
  const [current, setCurrent] = useState({ type: "lavan" }); /* {type:'lavan'} | {type:'book', id} */
  const [ch, setCh] = useState(0);
  const [nikkud, setNikkud] = useState(true);
  const [saved, setSaved] = useState({});
  const [known, setKnown] = useState({});          /* {bareWord: true} — words you don't need glossed */
  const [sents, setSents] = useState({});          /* {he: {en, at}} — favorited sentences */
  const [quiz, setQuiz] = useState({});           /* built-in story quizzes */
  const [books, setBooks] = useState({});          /* {id: {title, pageCount, page, quizzed, ephemeral}} */
  const bookTexts = useRef({});                    /* {id: [pages]} — big, kept out of React state */
  const nikkudTexts = useRef({});                  /* {id: {pageIdx: vocalized}} */
  const simpleTexts = useRef({});                  /* {id: {pageIdx: simple-Hebrew rewrite}} */
  const freqRef = useRef({});                      /* {id: Map(bareWord -> count)} */
  const [bookLoaded, setBookLoaded] = useState(0); /* bump to rerender when a text arrives */
  const [importing, setImporting] = useState(null);
  const [pageQuiz, setPageQuiz] = useState(null);  /* {status, questions, picked, submitted} for current book page */
  const [enOpen, setEnOpen] = useState({});
  const [enCache, setEnCache] = useState({});      /* sentence -> {en, glosses} (session) */
  const [enLoading, setEnLoading] = useState({});
  const [gramCache, setGramCache] = useState({});  /* sentence -> [points] (session) */
  const [gramLoading, setGramLoading] = useState({});
  const [sheet, setSheet] = useState(null);
  const [inlineGloss, setInlineGloss] = useState({}); /* "sentHe#word" -> short gloss shown above the tapped word (session) */
  const [dive, setDive] = useState({});
  const [review, setReview] = useState(false);
  const [cloze, setCloze] = useState(null);        /* items array while practicing */
  const [commonOpen, setCommonOpen] = useState(false);
  const [playing, setPlaying] = useState(null);    /* {idx, total} while reading aloud */
  const playRef = useRef(null);
  const [nikkudView, setNikkudView] = useState(true);
  const [nikkudBusy, setNikkudBusy] = useState(false);
  const [simpleView, setSimpleView] = useState(false);
  const [simpleBusy, setSimpleBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [welcome, setWelcome] = useState(true);
  const [aiOn, setAiOn] = useState(hasApiKey());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsNote, setSettingsNote] = useState("");
  const [aiNudgeDismissed, setAiNudgeDismissed] = useState(false);
  const [prefs, setPrefs] = useState({ theme: "paper", fontScale: 1, typeAnswers: false });
  const loaded = useRef(false);
  const toastTimer = useRef(null);

  /* Theme applies to the module-level palette before children render */
  C = THEMES[prefs.theme] || THEMES.paper;
  const fs = prefs.fontScale || 1;

  useEffect(() => { warmSpeech(); }, []);

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", C.paper);
  }, [prefs.theme]);

  /* Load persisted state */
  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get(STORAGE_KEY);
        if (r?.value) {
          const s = JSON.parse(r.value);
          if (s.saved) setSaved(s.saved);
          if (s.known) setKnown(s.known);
          if (s.sents) setSents(s.sents);
          if (s.quiz) setQuiz(s.quiz);
          if (typeof s.ch === "number" && s.ch >= 0 && s.ch < CHAPTERS.length) setCh(s.ch);
          if (typeof s.nikkud === "boolean") setNikkud(s.nikkud);
          if (s.welcomeDismissed) setWelcome(false);
          if (s.aiNudgeDismissed) setAiNudgeDismissed(true);
          if (s.books) setBooks(s.books);
          if (s.current?.type === "book" && s.books?.[s.current.id]) setCurrent(s.current);
          if (s.prefs && THEMES[s.prefs.theme]) setPrefs({ theme: s.prefs.theme, fontScale: FONT_SCALES.some((f) => f.id === s.prefs.fontScale) ? s.prefs.fontScale : 1, typeAnswers: !!s.prefs.typeAnswers });
        }
      } catch (e) { /* first visit or storage unavailable */ }
      loaded.current = true;
      setReady(true);
    })();
  }, []);

  /* Save on change (book texts live in their own keys) */
  useEffect(() => {
    if (!loaded.current) return;
    const meta = {};
    for (const [id, b] of Object.entries(books)) { if (!b.ephemeral) meta[id] = b; }
    const payload = JSON.stringify({
      saved, known, sents, quiz, ch, nikkud, welcomeDismissed: !welcome, aiNudgeDismissed, prefs, books: meta,
      current: current.type === "book" && books[current.id]?.ephemeral ? { type: "lavan" } : current,
    });
    (async () => { try { await storage.set(STORAGE_KEY, payload); } catch (e) {} })();
  }, [saved, known, sents, quiz, ch, nikkud, welcome, aiNudgeDismissed, prefs, books, current]);

  /* Fetch a book's pages (and its nikkud/simple caches) from storage when opened */
  useEffect(() => {
    if (current.type !== "book") return;
    const id = current.id;
    if (bookTexts.current[id]) return;
    (async () => {
      try {
        const r = await storage.get(BOOK_KEY(id));
        if (r?.value) {
          bookTexts.current[id] = JSON.parse(r.value).pages;
          try {
            const n = await storage.get(NIKKUD_KEY(id));
            if (n?.value) nikkudTexts.current[id] = JSON.parse(n.value);
          } catch (e) { /* nikkud cache optional */ }
          try {
            const sp = await storage.get(SIMPLE_KEY(id));
            if (sp?.value) simpleTexts.current[id] = JSON.parse(sp.value);
          } catch (e) { /* simple cache optional */ }
          setBookLoaded((n) => n + 1);
        }
      } catch (e) {
        showToast("Couldn't load that book — try adding it again");
        setCurrent({ type: "lavan" });
      }
    })();
  }, [current]);

  const stopReadAloud = () => {
    if (playRef.current) playRef.current.stop = true;
    playRef.current = null;
    stopSpeech();
    setPlaying(null);
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setSheet(null);
    setPageQuiz(null);
    setCommonOpen(false);
    stopReadAloud();
  }, [ch, tab, current, books[current.id]?.page]);

  useEffect(() => () => stopReadAloud(), []);

  /* Follow the reading-aloud highlight */
  useEffect(() => {
    if (playing) document.getElementById(`sent-${playing.idx}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [playing?.idx]);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  };

  const openSettings = (note = "") => {
    setSettingsNote(note);
    setSettingsOpen(true);
  };

  const chapter = CHAPTERS[ch];
  const wordCount = Object.keys(saved).length;
  const sentCount = Object.keys(sents).length;
  const dueN = dueCount(saved);
  const chaptersDone = CHAPTERS.filter((_, i) => quiz[i]?.submitted).length;
  const curBook = current.type === "book" ? books[current.id] : null;
  const curPages = current.type === "book" ? bookTexts.current[current.id] : null;
  const curPageIdx = curBook?.page || 0;
  const rawPageText = curPages ? curPages[curPageIdx] || "" : "";
  const vocalizedPage = current.type === "book" ? nikkudTexts.current[current.id]?.[curPageIdx] : null;
  const simplePage = current.type === "book" ? simpleTexts.current[current.id]?.[curPageIdx] : null;
  const pageHasNikkud = /[ְ-ּ]/.test(rawPageText);
  const readingSimple = simpleView && !!simplePage;
  const pageText = readingSimple ? simplePage : nikkudView && vocalizedPage ? vocalizedPage : rawPageText;
  const curPageSentences = curPages ? splitSentences(pageText).map((s) => ({ he: s })) : [];

  /* Comprehension meter: share of this page's words marked as known.
     Hidden until at least one word is known, and on trivially short pages. */
  const pageComp = (() => {
    if (current.type !== "book" || !rawPageText || !Object.keys(known).length) return null;
    const toks = rawPageText.split(/\s+/).map((t) => removeNikkud(stripWord(t))).filter(Boolean);
    if (toks.length < 10) return null;
    const k = toks.filter((t) => known[t]).length;
    return Math.round((100 * k) / toks.length);
  })();

  /* ---------------- word frequency ---------------- */
  const getFreq = (bookId) => {
    if (!freqRef.current[bookId]) {
      const m = new Map();
      for (const p of bookTexts.current[bookId] || []) {
        for (const t of (p || "").split(/\s+/)) {
          const s = removeNikkud(stripWord(t));
          if (!s) continue;
          m.set(s, (m.get(s) || 0) + 1);
        }
      }
      freqRef.current[bookId] = m;
    }
    return freqRef.current[bookId];
  };

  const commonWords = () => {
    if (current.type !== "book") return [];
    const entries = [...getFreq(current.id).entries()].filter(([w]) => isContentWord(w));
    /* short books rarely repeat a word 3×, so relax the bar until we have a list */
    let list = entries.filter(([, c]) => c >= 3);
    if (list.length < 5) list = entries.filter(([, c]) => c >= 2);
    return list
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([w, c]) => ({ w, c, known: !!saved[w], mastered: !!known[w] }));
  };

  const bookKnownStats = () => {
    if (current.type !== "book") return null;
    const distinct = [...getFreq(current.id).keys()].filter((w) => isContentWord(w));
    if (!distinct.length) return null;
    const k = distinct.filter((w) => known[w]).length;
    return k > 0 ? { known: k, distinct: distinct.length } : null;
  };

  /* ---------------- word taps ---------------- */
  const bareWord = (w) => removeNikkud(stripWord(w));
  const saveWord = (w, g, n, sentHe) => {
    setSaved((prev) => (prev[w] ? prev : {
      ...prev,
      [w]: { g: g || "", n: n || "", at: Date.now(), sent: sentHe || "", box: 0, due: Date.now() },
    }));
  };
  const clearInlineGloss = (w) => {
    setInlineGloss((p) => {
      const n = {};
      for (const [k, v] of Object.entries(p)) if (!k.endsWith(`#${w}`)) n[k] = v;
      return n;
    });
  };
  const unsaveWord = (w) => {
    setSaved((p) => { const n = { ...p }; delete n[w]; return n; });
    clearInlineGloss(w);
    showToast("Removed from My Words");
  };
  /* press-and-hold on a gold word in the text */
  const onUnsaveInline = (w) => {
    setSaved((p) => { const n = { ...p }; delete n[w]; return n; });
    clearInlineGloss(w);
    setSheet((s) => (s && s.word === w ? null : s));
    showToast("Removed — tap it again to re-save");
  };
  const toggleKnown = (w) => {
    const b = bareWord(w);
    if (!b) return;
    setKnown((p) => {
      const n = { ...p };
      if (n[b]) delete n[b]; else n[b] = true;
      return n;
    });
  };
  const backfillGloss = (w, g, n) => {
    setSaved((prev) => (prev[w] && !prev[w].g ? { ...prev, [w]: { ...prev[w], g, n: n || prev[w].n } } : prev));
  };
  const toggleFavSent = (sent) => {
    setSents((p) => {
      const n = { ...p };
      if (n[sent.he]) { delete n[sent.he]; showToast("Sentence removed"); }
      else {
        n[sent.he] = { en: sent.en || enCache[sent.he]?.en || "", at: Date.now() };
        showToast("Sentence saved ✓");
      }
      return n;
    });
  };
  const onSrsAnswer = (w, knew) => {
    setSaved((p) => {
      if (!p[w]) return p;
      /* a card answered correctly at the top box has graduated — count the
         word as known so comprehension meters reflect it */
      if (knew && (p[w].box ?? 0) >= SRS_INTERVALS_DAYS.length - 1) {
        const b = bareWord(w);
        if (b) setKnown((k) => (k[b] ? k : { ...k, [b]: true }));
      }
      return { ...p, [w]: srsAnswer(p[w], knew) };
    });
  };

  /* Full word panel (deep dive, save/known toggles, refresh). Reached by a
     second tap on an already-glossed word, or from the common-words list. */
  const openWordSheet = async (w, sent) => {
    const freq = current.type === "book" ? getFreq(current.id).get(removeNikkud(w)) || 0 : 0;
    const offline = GLOSS[w] || (saved[w]?.g ? { g: saved[w].g, n: saved[w].n } : null);
    if (offline) {
      setSheet({ word: w, gloss: offline.g, note: offline.n || "", sent, freq });
      if (!saved[w]) { saveWord(w, offline.g, offline.n, sent?.he); showToast("Saved to My Words ✓"); }
      return;
    }
    /* A translated sentence already carries a contextual gloss for this word —
       show it instantly instead of a second API call */
    const ctxGlosses = sent && enCache[sent.he]?.glosses;
    if (ctxGlosses) {
      const toks = sent.he.split(" ");
      const idx = toks.findIndex((t) => stripWord(t) === w);
      const g = idx >= 0 ? ctxGlosses[idx] : "";
      if (g) {
        setSheet({ word: w, gloss: g, note: "as used in this sentence — ask the tutor below for the full picture", sent, freq });
        if (!saved[w]) { saveWord(w, g, "", sent?.he); showToast("Saved to My Words ✓"); }
        return;
      }
    }
    /* Unknown word: the free dictionary first (fast), the tutor as fallback */
    setSheet({ word: w, gloss: "", note: "", sent, freq, glossLoading: true, aiMissing: !aiOn });
    if (!saved[w]) { saveWord(w, "", "", sent?.he); showToast("Saved to My Words ✓"); }
    try {
      const d = await wiktionaryLookup(w);
      setSheet((s) => (s && s.word === w ? { ...s, gloss: d.g, note: d.n, source: "wiktionary", glossLoading: false, glossError: false } : s));
      backfillGloss(w, d.g, d.n);
      return;
    } catch (e) { /* no entry — try the tutor */ }
    if (aiOn) {
      try {
        const g = await fetchQuickGloss(w, sent?.he || "");
        const note = [g.base && g.base !== w ? `base: ${g.base}` : null, g.root ? `root ${g.root}` : null, g.pos || null]
          .filter(Boolean).join(" · ");
        setSheet((s) => (s && s.word === w ? { ...s, gloss: g.gloss || "", note, glossLoading: false } : s));
        backfillGloss(w, g.gloss || "", note);
        return;
      } catch (e) {
        setSheet((s) => (s && s.word === w ? { ...s, glossLoading: false, glossError: true } : s));
        return;
      }
    }
    setSheet((s) => (s && s.word === w ? { ...s, glossLoading: false } : s));
  };

  /* First tap on a word: save it and float a short English gloss right above
     it in the text — Wiktionary does the quick lookup. Tap again for the
     full panel. */
  const shortGloss = (g) => {
    const s = String(g || "").split(/[(;·—]|, /)[0].trim();
    return s.length > 30 ? s.slice(0, 28).trimEnd() + "…" : s;
  };
  const onTapWord = async (w, sent) => {
    if (!sent) { openWordSheet(w, null); return; }
    const key = `${sent.he}#${w}`;
    if (inlineGloss[key] !== undefined) { openWordSheet(w, sent); return; }
    if (!saved[w]) { saveWord(w, "", "", sent.he); showToast("Saved to My Words ✓"); }
    /* instant sources first: the story glossary, a stored gloss, or the
       open translation's interlinear gloss */
    let instant = GLOSS[w]?.g || saved[w]?.g || "";
    if (!instant) {
      const cg = enCache[sent.he]?.glosses;
      if (cg) {
        const idx = sent.he.split(" ").findIndex((t) => stripWord(t) === w);
        if (idx >= 0) instant = cg[idx] || "";
      }
    }
    if (instant) {
      setInlineGloss((p) => ({ ...p, [key]: shortGloss(instant) }));
      backfillGloss(w, instant, GLOSS[w]?.n || "");
      return;
    }
    setInlineGloss((p) => ({ ...p, [key]: "…" }));
    try {
      const d = await wiktionaryLookup(w);
      setInlineGloss((p) => ({ ...p, [key]: shortGloss(d.g) }));
      backfillGloss(w, d.g, d.n);
      return;
    } catch (e) { /* no dictionary entry — try the tutor */ }
    if (aiOn) {
      try {
        const g = await fetchQuickGloss(w, sent.he);
        const note = [g.base && g.base !== w ? `base: ${g.base}` : null, g.root ? `root ${g.root}` : null, g.pos || null]
          .filter(Boolean).join(" · ");
        setInlineGloss((p) => ({ ...p, [key]: shortGloss(g.gloss) }));
        backfillGloss(w, g.gloss || "", note);
        return;
      } catch (e) { /* tutor unreachable too */ }
    }
    /* nothing found anywhere — drop the placeholder and let the panel explain */
    setInlineGloss((p) => { const n = { ...p }; delete n[key]; return n; });
    openWordSheet(w, sent);
  };

  /* Force a fresh lookup and overwrite the stored gloss — the escape hatch
     for words saved with a bad or outdated meaning */
  const refreshGloss = async (sh) => {
    const w = sh.word;
    setSheet((s) => (s && s.word === w ? { ...s, glossLoading: true, glossError: false, aiMissing: false } : s));
    const overwrite = (g, n, source) => {
      setSaved((p) => (p[w] ? { ...p, [w]: { ...p[w], g, n } } : p));
      setSheet((s) => (s && s.word === w ? { ...s, gloss: g, note: n, source, glossLoading: false, glossError: false, aiMissing: false } : s));
    };
    try {
      if (aiOn) {
        const g = await fetchQuickGloss(w, sh.sent?.he || "");
        const note = [g.base && g.base !== w ? `base: ${g.base}` : null, g.root ? `root ${g.root}` : null, g.pos || null]
          .filter(Boolean).join(" · ");
        overwrite(g.gloss || "", note, undefined);
      } else {
        const d = await wiktionaryLookup(w);
        overwrite(d.g, d.n, "wiktionary");
      }
    } catch (e) {
      /* whichever path failed, try the other before giving up */
      try {
        const d = await wiktionaryLookup(w);
        overwrite(d.g, d.n, "wiktionary");
      } catch (e2) {
        setSheet((s) => (s && s.word === w ? { ...s, glossLoading: false, glossError: true } : s));
      }
    }
  };

  const askTutor = async (sh, force = false) => {
    if (!aiOn) {
      openSettings("The word tutor needs an AI API key — add one from Claude, ChatGPT, or Gemini to get deep-dive explanations.");
      return;
    }
    const w = sh.word;
    if (dive[w]?.data && !force) return;
    setDive((p) => ({ ...p, [w]: { loading: true } }));
    try {
      const parsed = await fetchDeepDive(w, sh.sent ? sh.sent.he : "", sh.sent?.en || "");
      setDive((p) => ({ ...p, [w]: { data: parsed } }));
      if (parsed.gloss) {
        backfillGloss(w, parsed.gloss, "");
        setSheet((s) => (s && s.word === w && !s.gloss ? { ...s, gloss: parsed.gloss, glossError: false, aiMissing: false } : s));
      }
    } catch (e) {
      setDive((p) => ({ ...p, [w]: { error: true } }));
    }
  };

  /* ---------------- sentence translation (with interlinear glosses) ---------------- */
  const toggleEn = async (key, sent) => {
    const opening = !enOpen[key];
    setEnOpen((p) => ({ ...p, [key]: opening }));
    if (!opening || sent.en || enCache[sent.he]) return;
    if (!aiOn) return; /* the reveal box offers the settings link */
    setEnLoading((p) => ({ ...p, [key]: true }));
    try {
      const glossed = await fetchSentenceGlossed(sent.he, sent.he.split(" "));
      setEnCache((p) => ({ ...p, [sent.he]: glossed }));
      /* a favorited sentence saved before translation gets its English now */
      setSents((p) => (p[sent.he] && !p[sent.he].en ? { ...p, [sent.he]: { ...p[sent.he], en: glossed.en } } : p));
    } catch (e) {
      setEnCache((p) => ({ ...p, [sent.he]: { en: "Translation failed — tap the icon to close and try again.", glosses: null } }));
    }
    setEnLoading((p) => ({ ...p, [key]: false }));
  };

  /* Per-word glosses for the built-in story come from the hand-written glossary */
  const storyGlosses = (s) => s.he.split(" ").map((t) => GLOSS[stripWord(t)]?.g || "");

  /* ---------------- grammar breakdown ---------------- */
  const onGrammar = async (sent) => {
    if (!aiOn) {
      openSettings("Grammar breakdowns use the AI tutor — add an API key from Claude, ChatGPT, or Gemini to enable them.");
      return;
    }
    const k = sent.he;
    if (gramCache[k] || gramLoading[k]) return;
    setGramLoading((p) => ({ ...p, [k]: true }));
    try {
      const points = await fetchGrammar(k);
      setGramCache((p) => ({ ...p, [k]: points }));
    } catch (e) {
      showToast("Couldn't get the grammar breakdown — try again");
    }
    setGramLoading((p) => ({ ...p, [k]: false }));
  };

  /* ---------------- read aloud ---------------- */
  const startReadAloud = (sentences) => {
    stopReadAloud();
    if (!window.speechSynthesis) { showToast("This browser has no speech voices"); return; }
    const ctx = { stop: false };
    playRef.current = ctx;
    const step = (i) => {
      if (ctx.stop) return;
      if (i >= sentences.length) { setPlaying(null); playRef.current = null; return; }
      setPlaying({ idx: i, total: sentences.length });
      speakOne(sentences[i], { onend: () => step(i + 1) });
    };
    step(0);
  };

  /* ---------------- nikkud for imported pages ---------------- */
  const addNikkud = async () => {
    if (!aiOn) {
      openSettings("Adding nikkud uses the AI tutor — add an API key from Claude, ChatGPT, or Gemini to vocalize your books.");
      return;
    }
    if (!rawPageText || nikkudBusy) return;
    setNikkudBusy(true);
    try {
      const out = await fetchNikkud(rawPageText);
      nikkudTexts.current[current.id] = { ...(nikkudTexts.current[current.id] || {}), [curPageIdx]: out };
      setNikkudView(true);
      setBookLoaded((n) => n + 1);
      try { await storage.set(NIKKUD_KEY(current.id), JSON.stringify(nikkudTexts.current[current.id])); } catch (e) { /* keep in session */ }
    } catch (e) {
      showToast(e?.message || "Couldn't vocalize this page — try again");
    }
    setNikkudBusy(false);
  };

  /* ---------------- simple-Hebrew rewrite for hard pages ---------------- */
  const makeSimple = async () => {
    if (!aiOn) {
      openSettings("Simple Hebrew rewrites use the AI tutor — add an API key from Claude, ChatGPT, or Gemini to unlock them.");
      return;
    }
    if (!rawPageText || simpleBusy) return;
    setSimpleBusy(true);
    try {
      const out = await fetchSimplePage(rawPageText);
      simpleTexts.current[current.id] = { ...(simpleTexts.current[current.id] || {}), [curPageIdx]: out };
      setSimpleView(true);
      setBookLoaded((n) => n + 1);
      try { await storage.set(SIMPLE_KEY(current.id), JSON.stringify(simpleTexts.current[current.id])); } catch (e) { /* keep in session */ }
    } catch (e) {
      showToast(e?.message || "Couldn't simplify this page — try again");
    }
    setSimpleBusy(false);
  };

  /* ---------------- cloze practice ---------------- */
  const startCloze = () => {
    const pool = current.type === "book" && curPages ? curPages : CHAPTERS.flatMap((c) => c.sentences.map((s) => s.he));
    const bookItems = buildBookCloze(pool, 7, new Set(Object.keys(known)));
    const savedItems = buildSavedCloze(saved, 3, bookItems.flatMap((it) => it.options));
    const items = shuffle([...bookItems, ...savedItems]).slice(0, 10);
    if (items.length < 3) { showToast("Not enough sentences yet — read a little more first"); return; }
    setCloze(items);
  };

  /* ---------------- backup / export ---------------- */
  const downloadFile = (name, content, type = "application/octet-stream") => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const exportBackup = async () => {
    const bookData = {}, nikkudData = {}, simpleData = {};
    for (const id of Object.keys(books)) {
      try {
        const r = await storage.get(BOOK_KEY(id));
        if (r?.value) bookData[id] = JSON.parse(r.value);
        const n = await storage.get(NIKKUD_KEY(id));
        if (n?.value) nikkudData[id] = JSON.parse(n.value);
        const sp = await storage.get(SIMPLE_KEY(id));
        if (sp?.value) simpleData[id] = JSON.parse(sp.value);
      } catch (e) { /* skip unreadable book */ }
    }
    const meta = {};
    for (const [id, b] of Object.entries(books)) { if (!b.ephemeral) meta[id] = b; }
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      main: { saved, known, sents, quiz, ch, nikkud, welcomeDismissed: !welcome, aiNudgeDismissed, prefs, books: meta, current },
      books: bookData,
      nikkud: nikkudData,
      simple: simpleData,
    };
    downloadFile(`lavan-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload), "application/json");
    showToast("Backup downloaded");
  };

  const restoreBackup = async (file) => {
    try {
      const obj = JSON.parse(await file.text());
      if (obj?.version !== 1 || !obj.main) throw new Error("bad backup");
      await storage.set(STORAGE_KEY, JSON.stringify(obj.main));
      for (const [id, b] of Object.entries(obj.books || {})) await storage.set(BOOK_KEY(id), JSON.stringify(b));
      for (const [id, n] of Object.entries(obj.nikkud || {})) await storage.set(NIKKUD_KEY(id), JSON.stringify(n));
      for (const [id, sp] of Object.entries(obj.simple || {})) await storage.set(SIMPLE_KEY(id), JSON.stringify(sp));
      window.location.reload();
    } catch (e) {
      showToast("That doesn't look like a Lavan backup file");
    }
  };

  const exportAnki = () => {
    const clean = (s) => (s || "").replace(/[\t\n]/g, " ");
    const lines = [
      "#separator:tab",
      "#html:false",
      "#columns:Hebrew\tMeaning\tNotes\tSentence",
      ...Object.entries(saved).map(([w, e]) => `${w}\t${clean(e.g)}\t${clean(e.n)}\t${clean(e.sent)}`),
      ...Object.entries(sents).map(([he, e]) => `${clean(he)}\t${clean(e.en)}\tsentence\t`),
    ];
    downloadFile("lavan-words-anki.txt", lines.join("\n"), "text/plain");
    showToast("Exported — import the file in Anki");
  };

  /* ---------------- import ---------------- */
  const finishImport = async (title, pages) => {
    const id = String(Date.now());
    const pageCount = pages.length;
    bookTexts.current[id] = pages;
    let ephemeral = false;
    try {
      await storage.set(BOOK_KEY(id), JSON.stringify({ title, pages }));
      if (!storageAvailable) ephemeral = true;
    } catch (e) {
      ephemeral = true;
      showToast("Too large to keep — available this session only");
    }
    setBooks((p) => ({ ...p, [id]: { title, pageCount, page: 0, quizzed: 0, ephemeral } }));
    setCurrent({ type: "book", id });
    setTab("read");
    setImporting(null);
    if (!ephemeral) showToast(`Added “${title}” to your library`);
  };

  const onImportFile = async (file) => {
    setImporting({ done: 0, total: 1 });
    try {
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        const { title, pages } = await extractPdf(file, (done, total) => setImporting({ done, total }));
        const nonEmpty = pages.filter((p) => p.trim().length > 0);
        if (nonEmpty.length === 0) {
          setImporting(null);
          showToast("No text layer in this PDF — it may be a scan");
          return;
        }
        await finishImport(title || file.name.replace(/\.pdf$/i, ""), pages);
      } else if (file.type === "application/epub+zip" || /\.epub$/i.test(file.name)) {
        const { title, text } = await extractEpub(file, (done, total) => setImporting({ done, total }));
        const pages = paginateText(text);
        if (!pages.length) { setImporting(null); showToast("Couldn't find text in that EPUB"); return; }
        await finishImport(title || file.name.replace(/\.epub$/i, ""), pages);
      } else {
        const raw = await file.text();
        const pages = paginateText(raw);
        if (!pages.length) { setImporting(null); showToast("That file looks empty"); return; }
        await finishImport(file.name.replace(/\.txt$/i, ""), pages);
      }
    } catch (e) {
      setImporting(null);
      showToast("Couldn't read that file — try again");
    }
  };

  const onImportText = async (title, raw) => {
    const pages = paginateText(raw);
    if (!pages.length) { showToast("That text looks empty"); return; }
    await finishImport(title, pages);
  };

  const onDeleteBook = async (id) => {
    setBooks((p) => { const n = { ...p }; delete n[id]; return n; });
    delete bookTexts.current[id];
    delete nikkudTexts.current[id];
    delete simpleTexts.current[id];
    delete freqRef.current[id];
    if (current.type === "book" && current.id === id) setCurrent({ type: "lavan" });
    try { await storage.delete(BOOK_KEY(id)); await storage.delete(NIKKUD_KEY(id)); await storage.delete(SIMPLE_KEY(id)); } catch (e) {}
  };

  const setBookPage = (id, page) => {
    setBooks((p) => ({ ...p, [id]: { ...p[id], page: Math.max(0, Math.min(page, p[id].pageCount - 1)) } }));
  };

  /* ---------------- quizzes ---------------- */
  const pick = (qi, oi) => {
    setQuiz((p) => {
      const cur = p[ch] || { picked: {}, submitted: false };
      if (cur.submitted) return p;
      return { ...p, [ch]: { ...cur, picked: { ...cur.picked, [qi]: oi } } };
    });
  };
  const submitQuiz = () => {
    setQuiz((p) => {
      const cur = p[ch] || { picked: {} };
      const score = chapter.questions.filter((q, qi) => cur.picked[qi] === q.correct).length;
      return { ...p, [ch]: { ...cur, submitted: true, score } };
    });
  };
  const retryQuiz = () => setQuiz((p) => ({ ...p, [ch]: { picked: {}, submitted: false } }));

  const startPageQuiz = async () => {
    if (!aiOn) {
      openSettings("Page quizzes are written live by the AI tutor — add an API key from Claude, ChatGPT, or Gemini to enable them.");
      return;
    }
    setPageQuiz({ status: "loading" });
    try {
      const questions = await fetchPageQuiz(pageText);
      setPageQuiz({ status: "ready", questions, picked: {}, submitted: false });
    } catch (e) {
      setPageQuiz({ status: "error" });
    }
  };

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", background: C.paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: UI_FONT, color: C.sub }}>
        <span className="pulse">Opening your library…</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.paper, fontFamily: UI_FONT, color: C.ink }}>
      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; background: ${C.paper}; }
        .word { border-radius: 6px; padding: 0px 3px; cursor: pointer; transition: background .15s ease; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation; }
        .word:hover { background: ${C.blueSoft}; }
        .word:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 1px; }
        .icon-btn { background: none; border: none; padding: 6px; border-radius: 8px; cursor: pointer; color: ${C.sub}; display: inline-flex; align-items: center; justify-content: center; }
        .icon-btn:hover { background: ${C.soft}; color: ${C.ink}; }
        .icon-btn:focus-visible { outline: 2px solid ${C.blue}; }
        .en-chip { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; border: 1px solid; cursor: pointer; vertical-align: middle; margin-inline-start: 4px; transition: all .15s ease; }
        .en-chip:focus-visible { outline: 2px solid ${C.blue}; }
        .en-reveal { display: flex; align-items: center; gap: 6px; font-size: 14.5px; color: ${C.sub}; background: ${C.soft}; border-radius: 10px; padding: 8px 12px; margin: 2px 0 10px; line-height: 1.5; animation: fadeIn .18s ease; }
        .iword { display: inline-flex; flex-direction: column; align-items: center; vertical-align: bottom; margin: 0 2px 3px; }
        .igloss { font-size: 10.5px; line-height: 1.35; color: ${C.sub}; font-family: ${UI_FONT}; max-width: 96px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: ltr; animation: fadeIn .18s ease; }
        .inline-link { background: none; border: none; padding: 0; cursor: pointer; color: ${C.blue}; font-size: inherit; font-family: inherit; text-decoration: underline; }
        .inline-link:focus-visible { outline: 2px solid ${C.blue}; }
        a.inline-link { color: ${C.blue}; }
        .chapter-pill { border: 1px solid ${C.line}; background: ${C.card}; border-radius: 999px; padding: 7px 14px; font-size: 14px; font-weight: 500; color: ${C.sub}; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; font-family: ${UI_FONT}; }
        .chapter-pill.active { background: ${C.blue}; border-color: ${C.blue}; color: ${C.onAccent}; }
        .chapter-pill:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
        .chapter-pill:disabled { opacity: .55; cursor: default; }
        .tab-btn { flex: 1; border: none; background: none; padding: 9px 0; border-radius: 9px; font-size: 13.5px; font-weight: 600; color: ${C.sub}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; font-family: ${UI_FONT}; }
        .tab-btn.active { background: ${C.card}; color: ${C.ink}; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
        .opt { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; border: 1.5px solid; border-radius: 12px; padding: 11px 14px; font-size: 14.5px; cursor: pointer; font-family: ${UI_FONT}; transition: all .12s ease; line-height: 1.35; }
        .opt:disabled { cursor: default; }
        .opt:not(:disabled):hover { border-color: ${C.blue}; }
        .opt:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
        .primary-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; border: none; border-radius: 12px; padding: 13px 16px; background: ${C.blue}; color: ${C.onAccent}; font-size: 15px; font-weight: 600; cursor: pointer; font-family: ${UI_FONT}; }
        .primary-btn:disabled { opacity: .45; cursor: default; }
        .primary-btn:focus-visible { outline: 2px solid ${C.ink}; outline-offset: 2px; }
        .ghost-btn { display: flex; align-items: center; justify-content: center; gap: 6px; border: 1.5px solid ${C.line}; border-radius: 12px; padding: 12px 16px; background: ${C.card}; color: ${C.ink}; font-size: 14.5px; font-weight: 500; cursor: pointer; font-family: ${UI_FONT}; }
        .ghost-btn:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
        .quiz-card { background: ${C.card}; border: 1px solid ${C.line}; border-radius: 18px; padding: 20px 18px; margin-top: 28px; }
        .quiz-badge { width: 34px; height: 34px; border-radius: 10px; background: ${C.blueSoft}; color: ${C.blue}; display: flex; align-items: center; justify-content: center; }
        .evidence { background: ${C.soft}; border-radius: 10px; padding: 10px 12px; margin-top: 8px; animation: fadeIn .2s ease; }
        .backdrop { position: fixed; inset: 0; background: rgba(10,14,20,.45); z-index: 40; animation: fadeIn .18s ease; }
        .sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; max-width: 660px; margin: 0 auto; background: ${C.card}; border-radius: 22px 22px 0 0; padding: 20px 20px calc(20px + env(safe-area-inset-bottom)); box-shadow: 0 -8px 40px rgba(0,0,0,.3); animation: slideUp .22s cubic-bezier(.3,.9,.4,1); max-height: 82vh; overflow-y: auto; color: ${C.ink}; }
        .tutor-btn { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; border: 1.5px solid ${C.blueLine}; background: ${C.blueSoft}; color: ${C.blue}; border-radius: 12px; padding: 11px 14px; font-size: 14.5px; font-weight: 600; cursor: pointer; font-family: ${UI_FONT}; }
        .tutor-btn:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
        .tutor-box { background: ${C.paper}; border: 1px solid ${C.line}; border-radius: 14px; padding: 14px; animation: fadeIn .2s ease; }
        .chip { background: ${C.card}; border: 1px solid ${C.line}; border-radius: 999px; padding: 3px 10px; font-size: 12.5px; color: ${C.ink}; font-weight: 500; font-family: ${UI_FONT}; }
        .word-row { display: flex; align-items: center; gap: 12px; background: ${C.card}; border: 1px solid ${C.line}; border-radius: 14px; padding: 12px 14px; font-family: ${UI_FONT}; }
        .book-row { display: flex; align-items: center; gap: 12px; background: ${C.card}; border: 1.5px solid ${C.line}; border-radius: 16px; padding: 12px 14px; width: 100%; cursor: pointer; font-family: ${UI_FONT}; margin-bottom: 10px; color: ${C.ink}; }
        .book-row:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
        .book-cover { width: 48px; height: 60px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .review-wrap { position: fixed; inset: 0; z-index: 60; background: ${C.paper}; display: flex; flex-direction: column; animation: fadeIn .15s ease; overflow-y: auto; }
        .flashcard { background: ${C.card}; border: 1px solid ${C.line}; border-radius: 22px; padding: 34px 24px; width: 100%; max-width: 360px; min-height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 24px rgba(0,0,0,.12); }
        .cloze-blank { display: inline-block; min-width: 64px; border-bottom: 2px dashed ${C.blue}; text-align: center; color: ${C.blue}; font-weight: 700; margin: 0 2px; }
        .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: ${C.ink}; color: ${C.paper}; font-size: 13.5px; font-weight: 500; padding: 9px 16px; border-radius: 999px; z-index: 70; animation: fadeIn .18s ease; box-shadow: 0 4px 16px rgba(0,0,0,.25); white-space: nowrap; }
        .pulse { animation: pulse 1.2s ease-in-out infinite; }
        .spin { animation: spin 1.1s linear infinite; }
        .field-label { font-size: 12.5px; font-weight: 600; color: ${C.sub}; letter-spacing: 0.4px; text-transform: uppercase; margin: 16px 0 6px; }
        .text-input { width: 100%; border: 1.5px solid ${C.line}; border-radius: 10px; padding: 11px 12px; font-size: 14.5px; font-family: ${UI_FONT}; background: ${C.paper}; color: ${C.ink}; }
        .text-input:focus-visible { outline: 2px solid ${C.blue}; }
        .seg { display: flex; gap: 6px; }
        .seg button { flex: 1; padding: 9px 8px; border-radius: 10px; border: 1.5px solid ${C.line}; background: ${C.card}; color: ${C.ink}; font-family: ${UI_FONT}; font-size: 13.5px; cursor: pointer; }
        .seg button.on { background: ${C.blueSoft}; border-color: ${C.blue}; color: ${C.blue}; font-weight: 600; }
        .seg button:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 1px; }
        .page-input { width: 64px; border: 1.5px solid ${C.line}; border-radius: 10px; padding: 8px 6px; font-size: 14px; text-align: center; font-family: ${UI_FONT}; background: ${C.card}; color: ${C.ink}; }
        @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>

      <div style={{ maxWidth: 660, margin: "0 auto", padding: "0 18px 80px" }}>
        {/* Header */}
        <header style={{ paddingTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 26, fontWeight: 700, color: C.blue }}>לָבָן</span>
              <span style={{ fontSize: 13, color: C.sub, letterSpacing: 0.4, textTransform: "uppercase" }}>a Hebrew reader</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {current.type === "lavan" && tab === "read" && (
                <button
                  className="chapter-pill"
                  style={nikkud ? { background: C.blueSoft, borderColor: C.blueLine, color: C.blue } : {}}
                  onClick={() => setNikkud((v) => !v)}
                  aria-pressed={nikkud}
                >
                  <span dir="rtl" style={{ fontFamily: HEB_FONT, fontWeight: 700 }}>{nikkud ? "אָ" : "א"}</span>
                  nikkud {nikkud ? "on" : "off"}
                </button>
              )}
              <button className="icon-btn" onClick={() => openSettings()} aria-label="Settings" title="Settings">
                <Settings size={19} />
              </button>
            </div>
          </div>

          <div style={{ display: "flex", background: C.soft, borderRadius: 12, padding: 4, marginTop: 14 }}>
            <button className={`tab-btn ${tab === "library" ? "active" : ""}`} onClick={() => setTab("library")}>
              <Library size={15} /> Library
            </button>
            <button className={`tab-btn ${tab === "read" ? "active" : ""}`} onClick={() => setTab("read")}>
              <BookOpen size={15} /> Read
            </button>
            <button className={`tab-btn ${tab === "words" ? "active" : ""}`} onClick={() => setTab("words")}>
              <Bookmark size={15} /> Words
              {wordCount > 0 && (
                <span style={{ background: dueN > 0 ? C.marker : C.soft, color: dueN > 0 ? C.markerDeep : C.sub, borderRadius: 999, padding: "1px 8px", fontSize: 12, fontWeight: 700 }}>
                  {dueN > 0 ? `${dueN} due` : wordCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {tab === "library" && (
          <LibraryScreen
            books={books}
            current={current}
            importing={importing}
            lavanDone={chaptersDone}
            onOpenLavan={() => { setCurrent({ type: "lavan" }); setTab("read"); }}
            onOpenBook={(id) => { setCurrent({ type: "book", id }); setTab("read"); }}
            onDeleteBook={onDeleteBook}
            onImportFile={onImportFile}
            onImportText={onImportText}
          />
        )}

        {/* -------- Built-in story reader -------- */}
        {tab === "read" && current.type === "lavan" && (
          <main>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "16px 0 4px", scrollbarWidth: "none" }}>
              {CHAPTERS.map((c, i) => (
                <button key={i} className={`chapter-pill ${i === ch ? "active" : ""}`} onClick={() => setCh(i)}>
                  <span dir="rtl" style={{ fontFamily: HEB_FONT }}>פֶּרֶק {c.num}</span>
                  {quiz[i]?.submitted && <Check size={14} strokeWidth={3} color={i === ch ? C.onAccent : C.green} />}
                </button>
              ))}
            </div>

            {welcome && (
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginTop: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 15.5, marginBottom: 8 }}>How this book works</div>
                <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.65 }}>
                  Tap any word you don't know — its English pops up right above it, it gets a <span style={{ background: C.marker, borderRadius: 4, padding: "0 4px", color: C.ink }}>gold highlight</span>, and it lands in My Words. Tap it again for the full breakdown; press and hold to un-save.
                  Tap the <Languages size={13} style={{ verticalAlign: "-2px" }} /> at the end of a line for the full translation, with a small English gloss above every word. Your own books live in the Library tab.
                </div>
                <button className="primary-btn" style={{ marginTop: 12 }} onClick={() => setWelcome(false)}>Start reading</button>
              </div>
            )}

            <div style={{ marginTop: 24, marginBottom: 12 }}>
              <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: C.blue, fontWeight: 600 }}>
                Chapter {ch + 1} of {CHAPTERS.length}
              </div>
              <h1 dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 34, fontWeight: 700, margin: "6px 0 2px", color: C.ink, lineHeight: 1.5 }}>
                {nikkud ? chapter.titleHe : removeNikkud(chapter.titleHe)}
              </h1>
              <div style={{ fontSize: 14.5, color: C.sub }}>{chapter.titleEn}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {playing ? (
                  <button className="chapter-pill" style={{ background: C.blueSoft, borderColor: C.blueLine, color: C.blue }} onClick={stopReadAloud}>
                    <Square size={13} /> Stop · {playing.idx + 1}/{playing.total}
                  </button>
                ) : (
                  <button className="chapter-pill" onClick={() => startReadAloud(chapter.sentences.map((s) => s.he))}>
                    <Play size={13} /> Listen to this chapter
                  </button>
                )}
                <button className="chapter-pill" onClick={startCloze}>
                  <Puzzle size={13} /> Cloze
                </button>
              </div>
            </div>

            <div>
              {chapter.sentences.map((s, si) => {
                const key = `lavan-${ch}-${si}`;
                return (
                  <Sentence
                    key={key}
                    id={`sent-${si}`}
                    sent={s}
                    fontSize={Math.round(26 * fs)}
                    nikkud={nikkud}
                    savedWords={saved}
                    activeWord={sheet?.word}
                    onTapWord={onTapWord}
                    onUnsaveWord={onUnsaveInline}
                    inlineGlosses={inlineGloss}
                    open={!!enOpen[key]}
                    enText={s.en}
                    enLoading={false}
                    glosses={enOpen[key] ? storyGlosses(s) : null}
                    onToggleEn={() => toggleEn(key, s)}
                    aiOn={aiOn}
                    onOpenSettings={openSettings}
                    playingNow={playing?.idx === si}
                    grammar={gramCache[s.he] || null}
                    gramLoading={!!gramLoading[s.he]}
                    onGrammar={onGrammar}
                    fav={!!sents[s.he]}
                    onToggleFav={() => toggleFavSent(s)}
                  />
                );
              })}
            </div>

            <QuizBlock
              questions={chapter.questions}
              picked={quiz[ch]?.picked || {}}
              submitted={!!quiz[ch]?.submitted}
              onPick={pick}
              onSubmit={submitQuiz}
              onRetry={retryQuiz}
              headerNote={`Reading check · Chapter ${ch + 1}`}
              footer={
                ch < CHAPTERS.length - 1 ? (
                  <button className="primary-btn" style={{ flex: 2 }} onClick={() => setCh((c) => Math.min(c + 1, CHAPTERS.length - 1))}>
                    Next: פֶּרֶק {CHAPTERS[ch + 1].num} <ChevronRight size={16} />
                  </button>
                ) : (
                  <div className="primary-btn" style={{ flex: 2, background: C.green, cursor: "default" }}>
                    🎉 Story complete · {wordCount} words
                  </div>
                )
              }
            />

            <div style={{ textAlign: "center", marginTop: 24, fontSize: 12.5, color: C.sub }}>
              {chaptersDone} of {CHAPTERS.length} chapters complete · {wordCount} words collected
            </div>
          </main>
        )}

        {/* -------- Loaded book reader -------- */}
        {tab === "read" && current.type === "book" && curBook && (
          <main>
            <div style={{ marginTop: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: C.blue, fontWeight: 600 }}>
                Page {curPageIdx + 1} of {curBook.pageCount}
              </div>
              <h1 dir="auto" style={{ fontFamily: /[֐-׿]/.test(curBook.title) ? HEB_FONT : UI_FONT, fontSize: 27, fontWeight: 700, margin: "6px 0 0", color: C.ink, lineHeight: 1.5 }}>
                {curBook.title}
              </h1>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {playing ? (
                  <button className="chapter-pill" style={{ background: C.blueSoft, borderColor: C.blueLine, color: C.blue }} onClick={stopReadAloud}>
                    <Square size={13} /> Stop · {playing.idx + 1}/{playing.total}
                  </button>
                ) : (
                  <button className="chapter-pill" onClick={() => startReadAloud(curPageSentences.map((s) => s.he))} disabled={!curPageSentences.length}>
                    <Play size={13} /> Listen
                  </button>
                )}
                {rawPageText && (
                  simplePage ? (
                    <button className="chapter-pill" style={simpleView ? { background: C.greenSoft, borderColor: C.green, color: C.green } : {}} onClick={() => setSimpleView((v) => !v)} aria-pressed={simpleView}>
                      <Sparkles size={13} /> Simple {simpleView ? "on" : "off"}
                    </button>
                  ) : (
                    <button className="chapter-pill" onClick={makeSimple} disabled={simpleBusy}>
                      {simpleBusy ? <Loader size={13} className="spin" /> : <Sparkles size={13} />}
                      {simpleBusy ? "Simplifying…" : "Simple Hebrew"}
                    </button>
                  )
                )}
                {rawPageText && !pageHasNikkud && !readingSimple && (
                  vocalizedPage ? (
                    <button className="chapter-pill" style={nikkudView ? { background: C.blueSoft, borderColor: C.blueLine, color: C.blue } : {}} onClick={() => setNikkudView((v) => !v)}>
                      <span dir="rtl" style={{ fontFamily: HEB_FONT, fontWeight: 700 }}>אָ</span> nikkud {nikkudView ? "on" : "off"}
                    </button>
                  ) : (
                    <button className="chapter-pill" onClick={addNikkud} disabled={nikkudBusy}>
                      {nikkudBusy ? <Loader size={13} className="spin" /> : <span dir="rtl" style={{ fontFamily: HEB_FONT, fontWeight: 700 }}>אָ</span>}
                      {nikkudBusy ? "Adding nikkud…" : "Add nikkud"}
                    </button>
                  )
                )}
                <button className="chapter-pill" onClick={() => setCommonOpen(true)}>
                  <BarChart3 size={13} /> Common words
                </button>
                {pageComp !== null && (
                  <span
                    className="chip"
                    style={{ alignSelf: "center", fontWeight: 600, color: pageComp >= 90 ? C.green : pageComp >= 70 ? C.blue : C.sub }}
                    title="Counts words you marked as known (word panel → Mark as known)"
                  >
                    you know {pageComp}% of this page
                  </span>
                )}
              </div>
            </div>

            {!aiOn && !aiNudgeDismissed && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: C.blueSoft, border: `1px solid ${C.blueLine}`, borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
                <Sparkles size={16} color={C.blue} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 13.5, color: C.ink, lineHeight: 1.55 }}>
                  Reading works as-is. To define any word you tap, translate sentences, and get page quizzes,{" "}
                  <button className="inline-link" onClick={() => openSettings()}>add an AI API key</button>{" "}
                  (Claude, ChatGPT, or Gemini).
                </div>
                <button className="icon-btn" style={{ padding: 2 }} onClick={() => setAiNudgeDismissed(true)} aria-label="Dismiss">
                  <X size={15} />
                </button>
              </div>
            )}

            {!curPages ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: C.sub }}><span className="pulse">Opening the book…</span></div>
            ) : curPageSentences.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: C.sub, fontSize: 14.5 }}>This page is blank — use the arrows to keep going.</div>
            ) : (
              <div>
                {curPageSentences.map((s, si) => {
                  const key = `${current.id}-${curPageIdx}-${si}-${readingSimple ? "s" : nikkudView && vocalizedPage ? "v" : "r"}`;
                  return (
                    <Sentence
                      key={key}
                      id={`sent-${si}`}
                      sent={s}
                      fontSize={Math.round(23 * fs)}
                      nikkud={true}
                      savedWords={saved}
                      activeWord={sheet?.word}
                      onTapWord={onTapWord}
                      onUnsaveWord={onUnsaveInline}
                      inlineGlosses={inlineGloss}
                      open={!!enOpen[key]}
                      enText={enCache[s.he]?.en}
                      enLoading={!!enLoading[key]}
                      glosses={enCache[s.he]?.glosses || null}
                      onToggleEn={() => toggleEn(key, s)}
                      aiOn={aiOn}
                      onOpenSettings={openSettings}
                      playingNow={playing?.idx === si}
                      grammar={gramCache[s.he] || null}
                      gramLoading={!!gramLoading[s.he]}
                      onGrammar={onGrammar}
                      fav={!!sents[s.he]}
                      onToggleFav={() => toggleFavSent(s)}
                    />
                  );
                })}
              </div>
            )}

            {/* Page quiz + cloze */}
            {curPages && curPageSentences.length > 0 && (
              <div style={{ marginTop: 20 }}>
                {!pageQuiz && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="tutor-btn" style={{ flex: 2 }} onClick={startPageQuiz}>
                      <Sparkles size={16} /> Quiz me on this page
                    </button>
                    <button className="ghost-btn" style={{ flex: 1 }} onClick={startCloze}>
                      <Puzzle size={15} /> Cloze
                    </button>
                  </div>
                )}
                {pageQuiz?.status === "loading" && (
                  <div className="tutor-box" style={{ color: C.sub, fontSize: 14, textAlign: "center" }}>
                    <span className="pulse">Writing your questions…</span>
                  </div>
                )}
                {pageQuiz?.status === "error" && (
                  <div className="tutor-box" style={{ fontSize: 14 }}>
                    <div style={{ color: C.red, marginBottom: 8 }}>Couldn't make a quiz for this page. Try again in a moment.</div>
                    <button className="tutor-btn" onClick={startPageQuiz}><RotateCcw size={14} /> Try again</button>
                  </div>
                )}
                {pageQuiz?.status === "ready" && (
                  <QuizBlock
                    questions={pageQuiz.questions}
                    picked={pageQuiz.picked}
                    submitted={pageQuiz.submitted}
                    onPick={(qi, oi) => setPageQuiz((p) => (p.submitted ? p : { ...p, picked: { ...p.picked, [qi]: oi } }))}
                    onSubmit={() => {
                      setPageQuiz((p) => ({ ...p, submitted: true }));
                      setBooks((p) => ({ ...p, [current.id]: { ...p[current.id], quizzed: (p[current.id].quizzed || 0) + 1 } }));
                    }}
                    onRetry={startPageQuiz}
                    headerNote={`Reading check · Page ${curPageIdx + 1}`}
                    footer={
                      <button className="primary-btn" style={{ flex: 2 }} onClick={() => setBookPage(current.id, curPageIdx + 1)}>
                        Next page <ChevronRight size={16} />
                      </button>
                    }
                  />
                )}
              </div>
            )}

            {/* Page navigation */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 24 }}>
              <button className="ghost-btn" disabled={curPageIdx === 0} style={{ opacity: curPageIdx === 0 ? 0.4 : 1 }} onClick={() => setBookPage(current.id, curPageIdx - 1)}>
                <ChevronLeft size={16} /> Prev
              </button>
              <form
                onSubmit={(e) => { e.preventDefault(); const v = parseInt(new FormData(e.target).get("pg"), 10); if (!isNaN(v)) setBookPage(current.id, v - 1); }}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <input name="pg" className="page-input" inputMode="numeric" placeholder={String(curPageIdx + 1)} aria-label="Go to page" />
                <span style={{ fontSize: 13, color: C.sub }}>/ {curBook.pageCount}</span>
              </form>
              <button className="ghost-btn" disabled={curPageIdx >= curBook.pageCount - 1} style={{ opacity: curPageIdx >= curBook.pageCount - 1 ? 0.4 : 1 }} onClick={() => setBookPage(current.id, curPageIdx + 1)}>
                Next <ChevronRight size={16} />
              </button>
            </div>

            <div style={{ textAlign: "center", marginTop: 16, fontSize: 12.5, color: C.sub }}>
              {curBook.quizzed || 0} pages quizzed · {wordCount} words collected
            </div>
          </main>
        )}

        {tab === "read" && current.type === "book" && !curBook && (
          <main style={{ textAlign: "center", padding: "50px 0", color: C.sub }}>
            <div style={{ fontSize: 14.5 }}>That book isn't in your library anymore.</div>
            <button className="primary-btn" style={{ marginTop: 14, width: "auto", margin: "14px auto 0" }} onClick={() => setTab("library")}>Open Library</button>
          </main>
        )}

        {/* -------- My Words -------- */}
        {tab === "words" && (
          <main style={{ paddingTop: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>My Words</div>
                <div style={{ fontSize: 13.5, color: C.sub }}>
                  {wordCount === 0 ? "Nothing here yet" : dueN > 0 ? `${dueN} of ${wordCount} due for review` : `${wordCount} collected · all reviewed for now`}
                </div>
              </div>
              {wordCount > 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="primary-btn" style={{ width: "auto", padding: "10px 16px" }} onClick={() => setReview(true)}>
                    {dueN > 0 ? `Review ${dueN}` : "Practice"}
                  </button>
                  <button className="ghost-btn" style={{ padding: "10px 14px" }} onClick={startCloze}>
                    <Puzzle size={15} /> Cloze
                  </button>
                </div>
              )}
            </div>

            {wordCount === 0 && sentCount === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: C.sub }}>
                <div style={{ fontSize: 42 }}>🐈</div>
                <div style={{ fontSize: 15, marginTop: 10, lineHeight: 1.6 }}>
                  Tap any word while you read and it lands here,<br />ready to review as flashcards.
                  <br />The <Star size={13} style={{ verticalAlign: "-2px" }} /> at the end of a line saves the whole sentence.
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(saved)
                    .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
                    .map(([w, e]) => (
                      <div className="word-row" key={w}>
                        <span dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 23, fontWeight: 500, color: C.ink, background: C.marker, borderRadius: 6, padding: "0 6px" }}>{w}</span>
                        <span style={{ flex: 1, fontSize: 14, color: C.sub, lineHeight: 1.4 }}>{e.g || "tap it in the book again for a gloss"}</span>
                        <span style={{ fontSize: 11.5, color: isDue(e) ? C.markerDeep : C.sub, fontWeight: isDue(e) ? 700 : 400, whiteSpace: "nowrap" }}>{dueLabel(e)}</span>
                        <SpeakBtn text={w} size={16} />
                        <button className="icon-btn" onClick={() => setSaved((p) => { const n = { ...p }; delete n[w]; return n; })} aria-label={`Remove ${w}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                </div>
                {sentCount > 0 && (
                  <>
                    <div style={{ fontSize: 15.5, fontWeight: 700, margin: "22px 0 10px", display: "flex", alignItems: "center", gap: 7 }}>
                      <Star size={15} color={C.markerDeep} fill={C.markerDeep} strokeWidth={0} /> Saved sentences · {sentCount}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {Object.entries(sents)
                        .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
                        .map(([he, e]) => (
                          <div className="word-row" key={he} style={{ alignItems: "flex-start" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 19, color: C.ink, lineHeight: 1.8 }}>{he}</div>
                              {e.en && <div style={{ fontSize: 13, color: C.sub, marginTop: 2, lineHeight: 1.5 }}>{e.en}</div>}
                            </div>
                            <SpeakBtn text={he} size={16} />
                            <button className="icon-btn" onClick={() => toggleFavSent({ he })} aria-label="Remove sentence">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </>
            )}
          </main>
        )}
      </div>

      <WordSheet
        sheet={sheet}
        dive={dive}
        aiOn={aiOn}
        onAsk={askTutor}
        onOpenSettings={openSettings}
        onClose={() => setSheet(null)}
        savedNow={sheet ? !!saved[sheet.word] : false}
        knownNow={sheet ? !!known[bareWord(sheet.word)] : false}
        onToggleSave={(w) => (saved[w] ? unsaveWord(w) : (saveWord(w, sheet?.gloss || "", sheet?.note || "", sheet?.sent?.he), showToast("Saved to My Words ✓")))}
        onToggleKnown={toggleKnown}
        onRefresh={refreshGloss}
      />
      <CommonWordsSheet
        open={commonOpen}
        words={commonOpen ? commonWords() : []}
        stats={commonOpen ? bookKnownStats() : null}
        onPick={(w) => { setCommonOpen(false); onTapWord(w, null); }}
        onClose={() => setCommonOpen(false)}
      />
      <SettingsSheet
        open={settingsOpen}
        note={settingsNote}
        onClose={() => setSettingsOpen(false)}
        onChanged={() => setAiOn(hasApiKey())}
        prefs={prefs}
        onPrefs={setPrefs}
        wordCount={wordCount}
        onExportBackup={exportBackup}
        onRestoreBackup={restoreBackup}
        onExportAnki={exportAnki}
      />
      {review && (
        <Review
          words={saved}
          onAnswer={onSrsAnswer}
          onClose={() => setReview(false)}
          typeAnswers={!!prefs.typeAnswers}
          onToggleType={() => setPrefs((p) => ({ ...p, typeAnswers: !p.typeAnswers }))}
        />
      )}
      {cloze && (
        <ClozeOverlay
          items={cloze}
          savedWords={saved}
          onSrsAnswer={onSrsAnswer}
          onClose={() => setCloze(null)}
          fontScale={fs}
          typeAnswers={!!prefs.typeAnswers}
          onToggleType={() => setPrefs((p) => ({ ...p, typeAnswers: !p.typeAnswers }))}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
