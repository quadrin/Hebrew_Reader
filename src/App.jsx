import { useState, useEffect, useRef } from "react";
import {
  BookOpen, Bookmark, X, Sparkles, Languages, Volume2, Check,
  RotateCcw, Trash2, ChevronRight, ChevronLeft, GraduationCap, Star,
  Library, Plus, FileUp, Loader, Settings, Eye, EyeOff, KeyRound
} from "lucide-react";

import { CHAPTERS, GLOSS } from "./story.js";
import { stripWord, removeNikkud, splitSentences, paginateText, speak, warmSpeech, shuffle } from "./text.js";
import { extractPdf } from "./pdf.js";
import { storage, storageAvailable } from "./storage.js";
import {
  PROVIDERS, PROVIDER_IDS, getProvider, activate, getKeyFor, setKeyFor,
  getModelFor, setModelFor, hasApiKey, testApiKey,
  fetchQuickGloss, fetchDeepDive, fetchSentenceGlossed, fetchPageQuiz,
} from "./ai.js";

/* ------------------------------------------------------------------ */
/* Design tokens — "Tel Aviv noon": plaster, sea blue, marker gold     */
/* ------------------------------------------------------------------ */
const C = {
  paper: "#F5F3ED",
  card: "#FFFFFF",
  ink: "#1B2432",
  sub: "#5D6675",
  blue: "#1D4E89",
  blueSoft: "#E4EBF5",
  blueLine: "#B9CBE3",
  marker: "rgba(242, 201, 76, 0.45)",
  markerDeep: "#8F6A10",
  green: "#3E7C4F",
  greenSoft: "#E7F0E8",
  red: "#B3402E",
  redSoft: "#F7E7E3",
  line: "#E3E1D8",
  soft: "#EEEBE2",
};

const HEB_FONT = "'Frank Ruhl Libre', 'SBL Hebrew', 'David', 'Times New Roman', serif";
const UI_FONT = "'Rubik', -apple-system, 'Segoe UI', sans-serif";
const STORAGE_KEY = "lavan-hebrew-reader-v1";
const BOOK_KEY = (id) => `lavan-book-${id}`;

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

function Word({ token, nikkud, saved, active, onTap, gloss, interlinear }) {
  const stripped = stripWord(token);
  const display = nikkud ? token : removeNikkud(token);
  if (!stripped) {
    return interlinear ? (
      <span className="iword">
        <span className="igloss">{" "}</span>
        <span style={{ color: C.sub }}>{display}</span>
      </span>
    ) : (
      <span style={{ color: C.sub }}>{display} </span>
    );
  }
  const heSpan = (
    <span
      className="word"
      style={{
        background: active ? C.blueSoft : saved ? C.marker : "transparent",
        boxShadow: active ? `0 0 0 2px ${C.blueLine}` : "none",
      }}
      onClick={() => onTap(stripped)}
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
      <span className="igloss" dir="ltr" title={gloss || undefined}>{gloss || " "}</span>
      {heSpan}
    </span>
  );
}

function Sentence({ sent, fontSize, nikkud, savedWords, activeWord, onTapWord, open, enText, enLoading, glosses, onToggleEn, aiOn, onOpenSettings }) {
  const tokens = sent.he.split(" ");
  /* Interlinear mode: while the translation is open, each word carries its
     English gloss right above it */
  const interlinear = open && Array.isArray(glosses);
  return (
    <div style={{ marginBottom: 4 }}>
      <div dir="rtl" style={{ fontFamily: HEB_FONT, fontSize, lineHeight: 2.05, color: C.ink }}>
        {tokens.map((t, i) => (
          <Word
            key={i}
            token={t}
            nikkud={nikkud}
            saved={!!savedWords[stripWord(t)]}
            active={activeWord === stripWord(t)}
            onTap={(w) => onTapWord(w, sent)}
            gloss={interlinear ? glosses[i] : null}
            interlinear={interlinear}
          />
        ))}
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
      </div>
      {open && (
        <div dir="ltr" className="en-reveal">
          {enLoading ? (
            <span className="pulse" style={{ flex: 1 }}>Translating…</span>
          ) : enText ? (
            <>
              <span style={{ flex: 1 }}>{enText}</span>
              <SpeakBtn text={sent.he} size={15} />
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
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Word bottom sheet                                                   */
/* ------------------------------------------------------------------ */
function WordSheet({ sheet, dive, aiOn, onAsk, onOpenSettings, onClose }) {
  if (!sheet) return null;
  const { word, gloss, note, glossLoading, glossError, aiMissing, sent } = sheet;
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
            </div>
            <div style={{ fontSize: 17, color: C.ink, marginTop: 2, minHeight: 22 }}>
              {glossLoading ? <span className="pulse" style={{ color: C.sub, fontSize: 15 }}>Looking it up…</span>
                : glossError ? <span style={{ color: C.sub, fontSize: 15 }}>Lookup failed — try the tutor below.</span>
                : aiMissing && !gloss ? (
                  <span style={{ color: C.sub, fontSize: 15 }}>
                    Saved. To look up new words automatically,{" "}
                    <button className="inline-link" onClick={() => onOpenSettings("Word lookups use the AI tutor — add an API key from Claude, ChatGPT, or Gemini to define any word you tap.")}>
                      add an AI API key
                    </button>.
                  </span>
                )
                : (gloss || "No quick gloss — ask the tutor below.")}
            </div>
            {note && !glossLoading && <div style={{ fontSize: 13.5, color: C.sub, marginTop: 5, lineHeight: 1.5 }}>{note}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, color: C.markerDeep, fontSize: 12.5, fontWeight: 500 }}>
              <Star size={13} fill="currentColor" strokeWidth={0} /> Saved to My Words
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
/* Settings — the reader's own Claude API key powers the tutor         */
/* ------------------------------------------------------------------ */
function SettingsSheet({ open, note, onClose, onChanged }) {
  const [provider, setProviderChoice] = useState(getProvider());
  const [key, setKey] = useState("");
  const [model, setModelChoice] = useState(() => getModelFor(getProvider()));
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState(null); /* {kind:'testing'|'ok'|'error', msg} */

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
      <div className="sheet" style={{ zIndex: 76 }} role="dialog" aria-label="AI tutor settings">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="quiz-badge"><KeyRound size={16} /></div>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 17 }}>AI tutor settings</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings"><X size={20} /></button>
        </div>

        {note && (
          <div style={{ background: C.blueSoft, border: `1px solid ${C.blueLine}`, borderRadius: 12, padding: "10px 12px", fontSize: 13.5, color: C.blue, marginTop: 12, lineHeight: 1.5 }}>
            {note}
          </div>
        )}

        <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, marginTop: 12 }}>
          Tap-to-define for new words, sentence translations, deep-dive explanations, and page quizzes are
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
/* Flashcard review                                                    */
/* ------------------------------------------------------------------ */
function Review({ words, onClose }) {
  const [order] = useState(() => shuffle(Object.keys(words)));
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [got, setGot] = useState(0);
  const done = i >= order.length;
  const word = order[i];
  const entry = words[word] || {};

  const answer = (knew) => {
    if (knew) setGot((g) => g + 1);
    setFlipped(false);
    setI((x) => x + 1);
  };

  return (
    <div className="review-wrap">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px" }}>
        <div style={{ fontSize: 13.5, color: C.sub, fontWeight: 500 }}>{done ? "Review finished" : `Card ${i + 1} of ${order.length}`}</div>
        <button className="icon-btn" onClick={onClose} aria-label="Close review"><X size={20} /></button>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px 40px" }}>
        {!done ? (
          <>
            <div className="flashcard" onClick={() => setFlipped(true)}>
              <div dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 44, fontWeight: 700, color: C.ink, lineHeight: 1.6, textAlign: "center" }}>{word}</div>
              <div style={{ marginTop: 6 }}><SpeakBtn text={word} size={20} /></div>
              {flipped ? (
                <div style={{ marginTop: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 19, color: C.ink }}>{entry.g || "—"}</div>
                  {entry.n && <div style={{ fontSize: 13.5, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>{entry.n}</div>}
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
            <div style={{ fontSize: 24, fontWeight: 700, color: C.ink, marginTop: 8 }}>{got} of {order.length} known</div>
            <div style={{ fontSize: 14.5, color: C.sub, marginTop: 6 }}>{got === order.length ? "!מְצֻיָּן — excellent" : "The tricky ones will feel easier next time."}</div>
            <button className="primary-btn" style={{ marginTop: 20 }} onClick={onClose}>Back to my words</button>
          </div>
        )}
      </div>
    </div>
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
              <div dir="auto" style={{ fontWeight: 600, fontSize: 15.5, fontFamily: /[֐-׿]/.test(b.title) ? HEB_FONT : UI_FONT }}>{b.title}</div>
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
              Pick a Hebrew PDF or text file from your device. It's read right here in your browser — every word becomes tappable, and the tutor can quiz you on any page.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="primary-btn" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>
                <FileUp size={16} /> Choose a file
              </button>
              <button className="ghost-btn" style={{ flex: 1 }} onClick={() => setPasteOpen((v) => !v)}>Paste text</button>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.txt,text/plain,application/pdf" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ""; }} />
            {pasteOpen && (
              <div style={{ marginTop: 12 }}>
                <input
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="Title"
                  style={{ width: "100%", border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14.5, fontFamily: UI_FONT, marginBottom: 8, background: C.paper }}
                />
                <textarea
                  dir="rtl"
                  value={pasteVal}
                  onChange={(e) => setPasteVal(e.target.value)}
                  placeholder="הדביקו כאן טקסט בעברית…"
                  rows={5}
                  style={{ width: "100%", border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 17, fontFamily: HEB_FONT, background: C.paper, resize: "vertical" }}
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
  const [quiz, setQuiz] = useState({});           /* built-in story quizzes */
  const [books, setBooks] = useState({});          /* {id: {title, pageCount, page, quizzed, ephemeral}} */
  const bookTexts = useRef({});                    /* {id: [pages]} — big, kept out of React state */
  const [bookLoaded, setBookLoaded] = useState(0); /* bump to rerender when a text arrives */
  const [importing, setImporting] = useState(null);
  const [pageQuiz, setPageQuiz] = useState(null);  /* {status, questions, picked, submitted} for current book page */
  const [enOpen, setEnOpen] = useState({});
  const [enCache, setEnCache] = useState({});      /* sentence -> english (session) */
  const [enLoading, setEnLoading] = useState({});
  const [sheet, setSheet] = useState(null);
  const [dive, setDive] = useState({});
  const [review, setReview] = useState(false);
  const [toast, setToast] = useState(null);
  const [welcome, setWelcome] = useState(true);
  const [aiOn, setAiOn] = useState(hasApiKey());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsNote, setSettingsNote] = useState("");
  const [aiNudgeDismissed, setAiNudgeDismissed] = useState(false);
  const loaded = useRef(false);
  const toastTimer = useRef(null);

  useEffect(() => { warmSpeech(); }, []);

  /* Load persisted state */
  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get(STORAGE_KEY);
        if (r?.value) {
          const s = JSON.parse(r.value);
          if (s.saved) setSaved(s.saved);
          if (s.quiz) setQuiz(s.quiz);
          if (typeof s.ch === "number" && s.ch >= 0 && s.ch < CHAPTERS.length) setCh(s.ch);
          if (typeof s.nikkud === "boolean") setNikkud(s.nikkud);
          if (s.welcomeDismissed) setWelcome(false);
          if (s.aiNudgeDismissed) setAiNudgeDismissed(true);
          if (s.books) setBooks(s.books);
          if (s.current?.type === "book" && s.books?.[s.current.id]) setCurrent(s.current);
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
      saved, quiz, ch, nikkud, welcomeDismissed: !welcome, aiNudgeDismissed, books: meta,
      current: current.type === "book" && books[current.id]?.ephemeral ? { type: "lavan" } : current,
    });
    (async () => { try { await storage.set(STORAGE_KEY, payload); } catch (e) {} })();
  }, [saved, quiz, ch, nikkud, welcome, aiNudgeDismissed, books, current]);

  /* Fetch a book's pages from storage when opened */
  useEffect(() => {
    if (current.type !== "book") return;
    const id = current.id;
    if (bookTexts.current[id]) return;
    (async () => {
      try {
        const r = await storage.get(BOOK_KEY(id));
        if (r?.value) {
          bookTexts.current[id] = JSON.parse(r.value).pages;
          setBookLoaded((n) => n + 1);
        }
      } catch (e) {
        showToast("Couldn't load that book — try adding it again");
        setCurrent({ type: "lavan" });
      }
    })();
  }, [current]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setSheet(null);
    setPageQuiz(null);
  }, [ch, tab, current, books[current.id]?.page]);

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
  const chaptersDone = CHAPTERS.filter((_, i) => quiz[i]?.submitted).length;
  const curBook = current.type === "book" ? books[current.id] : null;
  const curPages = current.type === "book" ? bookTexts.current[current.id] : null;
  const curPageIdx = curBook?.page || 0;
  const curPageSentences = curPages ? splitSentences(curPages[curPageIdx] || "").map((s) => ({ he: s })) : [];

  /* ---------------- word taps ---------------- */
  const saveWord = (w, g, n) => {
    setSaved((prev) => (prev[w] ? prev : { ...prev, [w]: { g: g || "", n: n || "", at: Date.now() } }));
  };
  const backfillGloss = (w, g, n) => {
    setSaved((prev) => (prev[w] && !prev[w].g ? { ...prev, [w]: { ...prev[w], g, n: n || prev[w].n } } : prev));
  };

  const onTapWord = async (w, sent) => {
    const known = GLOSS[w] || (saved[w]?.g ? { g: saved[w].g, n: saved[w].n } : null);
    if (known) {
      setSheet({ word: w, gloss: known.g, note: known.n || "", sent });
      if (!saved[w]) { saveWord(w, known.g, known.n); showToast("Saved to My Words ✓"); }
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
        setSheet({ word: w, gloss: g, note: "as used in this sentence — ask the tutor below for the full picture", sent });
        if (!saved[w]) { saveWord(w, g, ""); showToast("Saved to My Words ✓"); }
        return;
      }
    }
    /* Unknown word (loaded book): ask the tutor for a quick gloss */
    setSheet({ word: w, gloss: "", note: "", sent, glossLoading: aiOn, aiMissing: !aiOn });
    if (!saved[w]) { saveWord(w, "", ""); showToast("Saved to My Words ✓"); }
    if (!aiOn) return;
    try {
      const g = await fetchQuickGloss(w, sent?.he || "");
      const note = [g.base && g.base !== w ? `base: ${g.base}` : null, g.root ? `root ${g.root}` : null, g.pos || null]
        .filter(Boolean).join(" · ");
      setSheet((s) => (s && s.word === w ? { ...s, gloss: g.gloss || "", note, glossLoading: false } : s));
      backfillGloss(w, g.gloss || "", note);
    } catch (e) {
      setSheet((s) => (s && s.word === w ? { ...s, glossLoading: false, glossError: true } : s));
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
    } catch (e) {
      setEnCache((p) => ({ ...p, [sent.he]: { en: "Translation failed — tap the icon to close and try again.", glosses: null } }));
    }
    setEnLoading((p) => ({ ...p, [key]: false }));
  };

  /* Per-word glosses for the built-in story come from the hand-written glossary */
  const storyGlosses = (s) => s.he.split(" ").map((t) => GLOSS[stripWord(t)]?.g || "");

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
    if (current.type === "book" && current.id === id) setCurrent({ type: "lavan" });
    try { await storage.delete(BOOK_KEY(id)); } catch (e) {}
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
      const questions = await fetchPageQuiz(curPages[curPageIdx]);
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
        body { margin: 0; }
        .word { border-radius: 6px; padding: 0px 3px; cursor: pointer; transition: background .15s ease; }
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
        .chapter-pill.active { background: ${C.blue}; border-color: ${C.blue}; color: #fff; }
        .chapter-pill:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
        .tab-btn { flex: 1; border: none; background: none; padding: 9px 0; border-radius: 9px; font-size: 13.5px; font-weight: 600; color: ${C.sub}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; font-family: ${UI_FONT}; }
        .tab-btn.active { background: ${C.card}; color: ${C.ink}; box-shadow: 0 1px 3px rgba(27,36,50,.08); }
        .opt { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; border: 1.5px solid; border-radius: 12px; padding: 11px 14px; font-size: 14.5px; cursor: pointer; font-family: ${UI_FONT}; transition: all .12s ease; line-height: 1.35; }
        .opt:disabled { cursor: default; }
        .opt:not(:disabled):hover { border-color: ${C.blue}; }
        .opt:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
        .primary-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; border: none; border-radius: 12px; padding: 13px 16px; background: ${C.blue}; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; font-family: ${UI_FONT}; }
        .primary-btn:disabled { opacity: .45; cursor: default; }
        .primary-btn:focus-visible { outline: 2px solid ${C.ink}; outline-offset: 2px; }
        .ghost-btn { display: flex; align-items: center; justify-content: center; gap: 6px; border: 1.5px solid ${C.line}; border-radius: 12px; padding: 12px 16px; background: ${C.card}; color: ${C.ink}; font-size: 14.5px; font-weight: 500; cursor: pointer; font-family: ${UI_FONT}; }
        .ghost-btn:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
        .quiz-card { background: ${C.card}; border: 1px solid ${C.line}; border-radius: 18px; padding: 20px 18px; margin-top: 28px; }
        .quiz-badge { width: 34px; height: 34px; border-radius: 10px; background: ${C.blueSoft}; color: ${C.blue}; display: flex; align-items: center; justify-content: center; }
        .evidence { background: ${C.soft}; border-radius: 10px; padding: 10px 12px; margin-top: 8px; animation: fadeIn .2s ease; }
        .backdrop { position: fixed; inset: 0; background: rgba(20,25,35,.38); z-index: 40; animation: fadeIn .18s ease; }
        .sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; max-width: 660px; margin: 0 auto; background: ${C.card}; border-radius: 22px 22px 0 0; padding: 20px 20px calc(20px + env(safe-area-inset-bottom)); box-shadow: 0 -8px 40px rgba(27,36,50,.22); animation: slideUp .22s cubic-bezier(.3,.9,.4,1); max-height: 82vh; overflow-y: auto; }
        .tutor-btn { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; border: 1.5px solid ${C.blueLine}; background: ${C.blueSoft}; color: ${C.blue}; border-radius: 12px; padding: 11px 14px; font-size: 14.5px; font-weight: 600; cursor: pointer; font-family: ${UI_FONT}; }
        .tutor-btn:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
        .tutor-box { background: ${C.paper}; border: 1px solid ${C.line}; border-radius: 14px; padding: 14px; animation: fadeIn .2s ease; }
        .chip { background: ${C.card}; border: 1px solid ${C.line}; border-radius: 999px; padding: 3px 10px; font-size: 12.5px; color: ${C.ink}; font-weight: 500; }
        .word-row { display: flex; align-items: center; gap: 12px; background: ${C.card}; border: 1px solid ${C.line}; border-radius: 14px; padding: 12px 14px; }
        .book-row { display: flex; align-items: center; gap: 12px; background: ${C.card}; border: 1.5px solid ${C.line}; border-radius: 16px; padding: 12px 14px; width: 100%; cursor: pointer; font-family: ${UI_FONT}; margin-bottom: 10px; }
        .book-row:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
        .book-cover { width: 48px; height: 60px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .review-wrap { position: fixed; inset: 0; z-index: 60; background: ${C.paper}; display: flex; flex-direction: column; animation: fadeIn .15s ease; }
        .flashcard { background: ${C.card}; border: 1px solid ${C.line}; border-radius: 22px; padding: 34px 24px; width: 100%; max-width: 360px; min-height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 24px rgba(27,36,50,.07); }
        .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: ${C.ink}; color: #fff; font-size: 13.5px; font-weight: 500; padding: 9px 16px; border-radius: 999px; z-index: 70; animation: fadeIn .18s ease; box-shadow: 0 4px 16px rgba(0,0,0,.25); white-space: nowrap; }
        .pulse { animation: pulse 1.2s ease-in-out infinite; }
        .spin { animation: spin 1.1s linear infinite; }
        .field-label { font-size: 12.5px; font-weight: 600; color: ${C.sub}; letter-spacing: 0.4px; text-transform: uppercase; margin: 16px 0 6px; }
        .text-input { width: 100%; border: 1.5px solid ${C.line}; border-radius: 10px; padding: 11px 12px; font-size: 14.5px; font-family: ${UI_FONT}; background: ${C.paper}; color: ${C.ink}; }
        .text-input:focus-visible { outline: 2px solid ${C.blue}; }
        .page-input { width: 64px; border: 1.5px solid ${C.line}; border-radius: 10px; padding: 8px 6px; font-size: 14px; text-align: center; font-family: ${UI_FONT}; background: ${C.card}; }
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
              <button className="icon-btn" onClick={() => openSettings()} aria-label="AI tutor settings" title={aiOn ? "AI tutor: on" : "AI tutor: off"}>
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
                <span style={{ background: C.marker, color: C.markerDeep, borderRadius: 999, padding: "1px 8px", fontSize: 12, fontWeight: 700 }}>{wordCount}</span>
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
                  {quiz[i]?.submitted && <Check size={14} strokeWidth={3} color={i === ch ? "#fff" : C.green} />}
                </button>
              ))}
            </div>

            {welcome && (
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginTop: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 15.5, marginBottom: 8 }}>How this book works</div>
                <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.65 }}>
                  Tap any word you don't know — you'll see its meaning, and it gets a <span style={{ background: C.marker, borderRadius: 4, padding: "0 4px", color: C.ink }}>gold highlight</span> and lands in My Words.
                  Tap the <Languages size={13} style={{ verticalAlign: "-2px" }} /> at the end of a line for the full translation, with a small English gloss above every word. Your own books live in the Library tab.
                </div>
                <button className="primary-btn" style={{ marginTop: 12 }} onClick={() => setWelcome(false)}>Start reading</button>
              </div>
            )}

            <div style={{ marginTop: 24, marginBottom: 18 }}>
              <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: C.blue, fontWeight: 600 }}>
                Chapter {ch + 1} of {CHAPTERS.length}
              </div>
              <h1 dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 34, fontWeight: 700, margin: "6px 0 2px", color: C.ink, lineHeight: 1.5 }}>
                {nikkud ? chapter.titleHe : removeNikkud(chapter.titleHe)}
              </h1>
              <div style={{ fontSize: 14.5, color: C.sub }}>{chapter.titleEn}</div>
            </div>

            <div>
              {chapter.sentences.map((s, si) => {
                const key = `lavan-${ch}-${si}`;
                return (
                  <Sentence
                    key={key}
                    sent={s}
                    fontSize={26}
                    nikkud={nikkud}
                    savedWords={saved}
                    activeWord={sheet?.word}
                    onTapWord={onTapWord}
                    open={!!enOpen[key]}
                    enText={s.en}
                    enLoading={false}
                    glosses={enOpen[key] ? storyGlosses(s) : null}
                    onToggleEn={() => toggleEn(key, s)}
                    aiOn={aiOn}
                    onOpenSettings={openSettings}
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
            <div style={{ marginTop: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: C.blue, fontWeight: 600 }}>
                Page {curPageIdx + 1} of {curBook.pageCount}
              </div>
              <h1 dir="auto" style={{ fontFamily: /[֐-׿]/.test(curBook.title) ? HEB_FONT : UI_FONT, fontSize: 27, fontWeight: 700, margin: "6px 0 0", color: C.ink, lineHeight: 1.5 }}>
                {curBook.title}
              </h1>
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
                  const key = `${current.id}-${curPageIdx}-${si}`;
                  return (
                    <Sentence
                      key={key}
                      sent={s}
                      fontSize={23}
                      nikkud={true}
                      savedWords={saved}
                      activeWord={sheet?.word}
                      onTapWord={onTapWord}
                      open={!!enOpen[key]}
                      enText={enCache[s.he]?.en}
                      enLoading={!!enLoading[key]}
                      glosses={enCache[s.he]?.glosses || null}
                      onToggleEn={() => toggleEn(key, s)}
                      aiOn={aiOn}
                      onOpenSettings={openSettings}
                    />
                  );
                })}
              </div>
            )}

            {/* Page quiz */}
            {curPages && curPageSentences.length > 0 && (
              <div style={{ marginTop: 20 }}>
                {!pageQuiz && (
                  <button className="tutor-btn" onClick={startPageQuiz}>
                    <Sparkles size={16} /> Quiz me on this page
                  </button>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>My Words</div>
                <div style={{ fontSize: 13.5, color: C.sub }}>{wordCount === 0 ? "Nothing here yet" : `${wordCount} collected from your reading`}</div>
              </div>
              {wordCount > 0 && (
                <button className="primary-btn" style={{ width: "auto", padding: "10px 18px" }} onClick={() => setReview(true)}>Review</button>
              )}
            </div>

            {wordCount === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: C.sub }}>
                <div style={{ fontSize: 42 }}>🐈</div>
                <div style={{ fontSize: 15, marginTop: 10, lineHeight: 1.6 }}>
                  Tap any word while you read and it lands here,<br />ready to review as flashcards.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(saved)
                  .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
                  .map(([w, e]) => (
                    <div className="word-row" key={w}>
                      <span dir="rtl" style={{ fontFamily: HEB_FONT, fontSize: 23, fontWeight: 500, color: C.ink, background: C.marker, borderRadius: 6, padding: "0 6px" }}>{w}</span>
                      <span style={{ flex: 1, fontSize: 14, color: C.sub, lineHeight: 1.4 }}>{e.g || "tap it in the book again for a gloss"}</span>
                      <SpeakBtn text={w} size={16} />
                      <button className="icon-btn" onClick={() => setSaved((p) => { const n = { ...p }; delete n[w]; return n; })} aria-label={`Remove ${w}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </main>
        )}
      </div>

      <WordSheet sheet={sheet} dive={dive} aiOn={aiOn} onAsk={askTutor} onOpenSettings={openSettings} onClose={() => setSheet(null)} />
      <SettingsSheet
        open={settingsOpen}
        note={settingsNote}
        onClose={() => setSettingsOpen(false)}
        onChanged={() => setAiOn(hasApiKey())}
      />
      {review && <Review words={saved} onClose={() => setReview(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
