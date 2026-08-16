/* Everything that is not the path or a lesson: the practice hub and the
   profile. */

import { useState, useEffect, useRef } from "react";
import {
  Flame, Zap, Trophy, Target, Crown, BookOpen, Brain,
  Volume2, Mic, Sparkles, Crosshair, RotateCcw, ChevronRight, Star,
  Eye, EyeOff, KeyRound, Loader, Smartphone, Download, Upload, Copy, Link2,
  Cloud, CloudOff, RefreshCw, ExternalLink, Bookmark, Puzzle, Trash2,
} from "lucide-react";

import {
  useDuo, GOALS, achievements, totals, dueWords,
  setSetting, setGoal, resetDuo, dayKey,
} from "./state.js";
import { playPhrase } from "./audio.js";
import { isDue, dueLabel } from "../srs.js";
import { removeNikkud, stripWord } from "../text.js";
import {
  VOICES, voiceSettings, setVoiceSettings, availableEngines, activeEngine,
  keyFor, getElevenKey, setElevenKey, testVoiceKey, cachedCount, clearVoiceCache,
} from "../voice.js";
import {
  collectProgress, applyProgress, encodeProgress, decodeProgress, summarise,
  downloadProgress, readProgressFile, restoreLink, codeInLink,
} from "../sync.js";
import {
  connect, disconnect, syncNow, isConnected, cloudStatus, onCloudChange, gistUrl,
} from "../cloud.js";

const ICONS = { flame: Flame, sparkles: Sparkles, book: BookOpen, crown: Crown, trophy: Trophy, target: Target, brain: Brain, crosshair: Crosshair };

function Bar({ value, max, color = "var(--d-green)" }) {
  return (
    <div style={{ height: 12, borderRadius: 999, background: "var(--d-mute)", overflow: "hidden", marginTop: 6 }}>
      <div style={{ height: "100%", width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, background: color, transition: "width .4s" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Practice: the drills the course can build, and everything you have
   collected. Words used to have a tab of their own in the header, which
   meant two places to go for the same thing — the words the lessons taught
   were here, and the words you tapped while reading were there. They are
   both here now, behind one switch, with the reader's flashcards and cloze
   sitting alongside the course's own drills. */

const barePhrase = (s) => String(s || "")
  .split(/\s+/).map((t) => removeNikkud(stripWord(t))).filter(Boolean).join(" ");

function WordRow({ children }) {
  return <div className="d-row" style={{ padding: "7px 0", borderTop: "1px solid var(--d-line)" }}>{children}</div>;
}

function PlayBtn({ text }) {
  return (
    <button className="d-icon-btn" style={{ width: 32, height: 32, flex: "none" }}
      onClick={() => playPhrase(text, "")} aria-label="Play">
      <Volume2 size={14} />
    </button>
  );
}

export function PracticeHub({ course, onPractice, myWords }) {
  const duo = useDuo();
  const due = dueWords(duo);
  const met = Object.entries(duo.words).sort((a, b) => (a[1].due || 0) - (b[1].due || 0));

  /* what the reader collected: tapped words and starred sentences, handed
     down from the app because that is where they are stored */
  const savedWords = Object.entries(myWords?.saved || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  const savedSents = Object.entries(myWords?.sents || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  const savedDue = myWords?.due || 0;

  const [source, setSource] = useState("lessons");
  const [showWords, setShowWords] = useState(false);
  const reading = !!myWords && source === "reading";

  const items = [
    { id: "mistakes", icon: RotateCcw, color: "var(--d-red)", title: "Mistakes", blurb: duo.mistakes.length ? `${duo.mistakes.length} to put right` : "Nothing wrong yet — well done", disabled: !duo.mistakes.length },
    { id: "personalized", icon: Brain, color: "var(--d-purple)", title: "Personalised practice", blurb: due.length ? `${due.length} words are due` : "Built from what you have met", disabled: !met.length },
    { id: "listening", icon: Volume2, color: "var(--d-blue)", title: "Listen up", blurb: "Ten listening exercises", disabled: false },
    { id: "speaking", icon: Mic, color: "var(--d-orange)", title: "Speak up", blurb: "Say it out loud", disabled: false },
  ];
  if (myWords) items.push(
    {
      id: "saved", icon: Bookmark, color: "var(--d-gold)", title: "Words you saved",
      blurb: !savedWords.length ? "Tap a word while you read and it lands here"
        : savedDue ? `${savedDue} of ${savedWords.length} due for review`
        : `${savedWords.length} collected — all reviewed for now`,
      disabled: !savedWords.length, run: myWords.onReview,
    },
    {
      id: "cloze", icon: Puzzle, color: "var(--d-green)", title: "Fill the gaps",
      blurb: "Blanks to fill in the book you are reading", disabled: false, run: myWords.onCloze,
    },
  );

  return (
    <div>
      <div className="d-title">Practice</div>
      {items.map((it) => (
        <button key={it.id} className="d-card d-row" disabled={it.disabled}
          style={{ width: "100%", textAlign: "left", cursor: it.disabled ? "default" : "pointer", opacity: it.disabled ? .55 : 1 }}
          onClick={() => (it.run ? it.run() : onPractice(it.id))}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: it.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <it.icon size={22} />
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ fontWeight: 800, fontSize: 16, display: "block" }}>{it.title}</span>
            <span className="d-sub">{it.blurb}</span>
          </span>
          <ChevronRight size={18} color="var(--d-sub)" />
        </button>
      ))}

      <div className="d-title">Your words</div>
      <div className="d-card">
        {myWords && (
          <div className="d-row" style={{ gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {[["lessons", "From lessons", met.length], ["reading", "From reading", savedWords.length]].map(([id, label, n]) => (
              <button key={id} className="d-pill" style={{
                cursor: "pointer", border: "none",
                background: (id === "reading") === reading ? "var(--d-green)" : "var(--d-mute)",
                color: (id === "reading") === reading ? "#fff" : "var(--d-sub)",
              }} onClick={() => setSource(id)}>{label} · {n}</button>
            ))}
          </div>
        )}

        <div className="d-row">
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 24 }}>{reading ? savedWords.length : met.length}</div>
            <div className="d-sub">
              {reading
                ? savedDue ? `${savedDue} due for review`
                  : savedWords.length ? "all reviewed for now" : "nothing saved yet"
                : `${due.length} due for review`}
            </div>
          </div>
          <button className="d-btn ghost small" onClick={() => setShowWords((v) => !v)}>
            {showWords ? "Hide" : "Show all"}
          </button>
        </div>

        {showWords && !reading && (
          <div style={{ marginTop: 12, maxHeight: 380, overflowY: "auto" }}>
            {met.map(([he, w]) => (
              <WordRow key={he}>
                <PlayBtn text={he} />
                <span className="d-prompt-he" dir="rtl" style={{ fontSize: 20, flex: 1 }}>{he}</span>
                <span className="d-sub" style={{ flex: 1, textAlign: "end" }}>{w.en}</span>
                <span className="d-pill" style={{ marginInlineStart: 8 }}>{"★".repeat(Math.max(1, w.level))}</span>
              </WordRow>
            ))}
            {!met.length && <div className="d-sub">Finish a lesson and the words will collect here.</div>}
          </div>
        )}

        {showWords && reading && (
          <div style={{ marginTop: 12, maxHeight: 380, overflowY: "auto" }}>
            {savedWords.map(([he, e]) => {
              const forms = (e.forms || []).filter((f) => barePhrase(f) !== barePhrase(he)).slice(0, 3);
              return (
                <WordRow key={he}>
                  <PlayBtn text={he} />
                  <span style={{ minWidth: 0 }}>
                    <span className="d-prompt-he" dir="rtl" style={{ fontSize: 20, display: "block" }}>{he}</span>
                    {forms.length > 0 && (
                      <span className="d-sub" dir="rtl" style={{ fontSize: 11.5, display: "block" }}>{forms.join(" · ")}</span>
                    )}
                  </span>
                  <span className="d-sub" style={{ flex: 1 }}>{e.g || "tap it in the book again for a gloss"}</span>
                  <span className="d-sub" style={{ whiteSpace: "nowrap", color: isDue(e) ? "var(--d-orange)" : undefined, fontWeight: isDue(e) ? 700 : 400 }}>
                    {dueLabel(e)}
                  </span>
                  <button className="d-icon-btn" style={{ width: 32, height: 32, flex: "none" }}
                    onClick={() => myWords.onForget(he)} aria-label={`Remove ${he}`}>
                    <Trash2 size={14} />
                  </button>
                </WordRow>
              );
            })}
            {!savedWords.length && (
              <div className="d-sub">
                Tap any word while you read and it lands here, ready to review as flashcards.
                The star at the end of a line saves the whole sentence.
              </div>
            )}

            {savedSents.length > 0 && (
              <>
                <div className="d-row" style={{ marginTop: 16, fontWeight: 800, fontSize: 15 }}>
                  <Star size={15} color="var(--d-gold)" fill="var(--d-gold)" strokeWidth={0} />
                  Sentences you saved · {savedSents.length}
                </div>
                {savedSents.map(([he, e]) => (
                  <WordRow key={he}>
                    <PlayBtn text={he} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="d-prompt-he" dir="rtl" style={{ fontSize: 19, lineHeight: 1.8, display: "block" }}>{he}</span>
                      {e.en && <span className="d-sub">{e.en}</span>}
                    </span>
                    <button className="d-icon-btn" style={{ width: 32, height: 32, flex: "none" }}
                      onClick={() => myWords.onForgetSent(he)} aria-label="Remove sentence">
                      <Trash2 size={14} />
                    </button>
                  </WordRow>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The day's goal — how much XP counts as having shown up, which is the only
   number the streak actually depends on. */
function DailyGoal() {
  const duo = useDuo();
  const today = duo.days[dayKey()] || 0;
  const goalPct = Math.min(100, Math.round((today / duo.goal) * 100));

  return (
    <>
      <div className="d-title">Daily goal</div>
      <div className="d-card">
        <div className="d-row">
          <div style={{ position: "relative", width: 64, height: 64 }}>
            <svg width="64" height="64" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="32" cy="32" r="27" fill="none" stroke="var(--d-mute)" strokeWidth="8" />
              <circle cx="32" cy="32" r="27" fill="none" stroke="var(--d-gold)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(goalPct / 100) * 2 * Math.PI * 27} 999`} />
            </svg>
            <Flame size={22} color="var(--d-orange)" style={{ position: "absolute", inset: 0, margin: "auto" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{today} / {duo.goal} XP today</div>
            <div className="d-sub">{goalPct >= 100 ? "Goal met — the streak is safe." : `${duo.goal - today} XP to go.`}</div>
          </div>
        </div>
        <div className="d-row" style={{ marginTop: 12, flexWrap: "wrap", gap: 6 }}>
          {GOALS.map((g) => (
            <button key={g.xp} className={`d-pill`} style={{
              cursor: "pointer", border: "none",
              background: duo.goal === g.xp ? "var(--d-green)" : "var(--d-mute)",
              color: duo.goal === g.xp ? "#fff" : "var(--d-sub)",
            }} onClick={() => setGoal(g.xp)}>{g.name} · {g.xp} XP</button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Sync                                                                */
/* ------------------------------------------------------------------ */
/* The app has no server, so the copy that survives a cleared cache lives in a
   private gist on the learner's own GitHub account. One token with gist access
   and nothing else; the app finds or makes the gist itself. */
function CloudSync() {
  const [connected, setConnected] = useState(isConnected());
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState(cloudStatus());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => onCloudChange(() => setStatus({ ...cloudStatus() })), []);

  const say = (t, ms = 4000) => { setMsg(t); setTimeout(() => setMsg(""), ms); };

  const go = async () => {
    setBusy(true);
    try {
      const r = await connect(token);
      setConnected(true);
      setToken("");
      say(r.login ? `Connected as ${r.login}. Everything syncs from now on.` : "Connected.");
    } catch (e) {
      say(e.message || "that didn't connect");
    } finally { setBusy(false); }
  };

  const ago = status.at ? Math.round((Date.now() - status.at) / 1000) : null;
  const when = ago == null ? "not yet"
    : ago < 60 ? "just now"
    : ago < 3600 ? `${Math.round(ago / 60)} min ago`
    : `${Math.round(ago / 3600)} h ago`;

  return (
    <>
      <div className="d-title">Sync</div>
      <div className="d-card">
        {connected ? (
          <>
            <div className="d-row">
              <span style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0, color: "#fff",
                background: status.state === "error" ? "var(--d-red)" : "var(--d-green)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {status.state === "syncing" ? <Loader size={20} className="spin" /> : <Cloud size={22} />}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {status.state === "error" ? "Sync trouble" : "Syncing to your gist"}
                </div>
                <div className="d-sub">
                  {status.state === "error" ? status.error : `Last synced ${when} · on open, after every lesson, and every five minutes.`}
                </div>
              </div>
            </div>
            <div className="d-row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button className="d-btn ghost small" disabled={status.state === "syncing"} onClick={async () => {
                const r = await syncNow({ reason: "manual" });
                say(r?.error ? r.error : r?.pulled ? "Pulled newer progress in." : r?.pushed ? "Pushed this device's progress up." : "Already up to date.");
              }}><RefreshCw size={14} /> Sync now</button>
              {gistUrl() && (
                <a className="d-btn ghost small" href={gistUrl()} target="_blank" rel="noreferrer"
                  style={{ textDecoration: "none" }}>
                  <ExternalLink size={14} /> See the gist
                </a>
              )}
              <button className="d-btn ghost small" onClick={() => { disconnect(); setConnected(false); say("Disconnected. The gist is still there."); }}>
                <CloudOff size={14} /> Disconnect
              </button>
            </div>
            <div className="d-sub" style={{ marginTop: 10, fontSize: 12 }}>
              Two devices that were both used offline are merged, not overwritten — whichever
              did more of something keeps it.
            </div>
          </>
        ) : (
          <>
            <div className="d-sub" style={{ marginBottom: 10 }}>
              Progress lives in this browser, so clearing its data would take it with it. Give the
              app a GitHub token with gist access and it keeps a private gist up to date instead:
              every device that has the token stays level, and a cleared cache costs nothing.
            </div>
            <button className="d-btn ghost small" style={{ marginBottom: 10 }} onClick={() => setHelp((v) => !v)}>
              {help ? "Hide" : "How to make one"}
            </button>
            {help && (
              <div className="d-sub" style={{ marginBottom: 10, lineHeight: 1.7 }}>
                1. Open{" "}
                <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noreferrer">
                  github.com/settings/tokens
                </a>{" "}→ <b>Generate new token</b> (fine-grained).<br />
                2. Under <b>Account permissions</b>, set <b>Gists</b> to <b>Read and write</b>. Nothing else
                is needed — leave every repository permission alone.<br />
                3. Copy the token and paste it here. It is kept in this browser only, and used
                against github.com and nowhere else.
              </div>
            )}
            <div className="d-row">
              <input
                className="d-input"
                style={{ flex: 1, padding: "10px 12px", fontSize: 14 }}
                type={show ? "text" : "password"}
                value={token}
                placeholder="github_pat_… or ghp_…"
                onChange={(e) => setToken(e.target.value)}
              />
              <button className="d-icon-btn" onClick={() => setShow((v) => !v)} aria-label="Show token">
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <button className="d-btn blue" style={{ marginTop: 10 }} disabled={!token.trim() || busy} onClick={go}>
              {busy ? <Loader size={16} className="spin" /> : <><Cloud size={16} /> Connect and sync</>}
            </button>
          </>
        )}
        {msg && <div className="d-sub" style={{ marginTop: 10, color: "var(--d-green)" }}>{msg}</div>}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Devices                                                             */
/* ------------------------------------------------------------------ */
/* No server means no automatic sync, so progress travels by hand: a file, a
   pasted code, or a link. Whatever arrives is merged with what is already
   here — two devices both have something worth keeping. */
function DeviceTransfer() {
  const duo = useDuo();
  const [code, setCode] = useState("");
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const file = useRef(null);

  const say = (t, ms = 3000) => { setMsg(t); setTimeout(() => setMsg(""), ms); };

  const make = async () => {
    setBusy(true);
    try {
      const blob = await collectProgress();
      setCode(encodeProgress(blob));
    } catch (e) { say(e.message || "couldn't read your progress"); }
    finally { setBusy(false); }
  };

  const take = async (blob, mode) => {
    try {
      const s = await applyProgress(blob, { mode });
      say(`${mode === "replace" ? "Replaced with" : "Merged in"} ${s.nodes} lessons, ${s.words} words. Reloading…`);
      setTimeout(() => window.location.reload(), 900);
    } catch (e) { say(e.message || "that didn't work"); }
  };

  const paste_ = async (mode) => {
    try { await take(decodeProgress(paste), mode); }
    catch (e) { say(e.message || "that code didn't read"); }
  };

  const mine = summarise({ duo, at: null });

  return (
    <>
      <div className="d-title">Move progress by hand</div>
      <div className="d-card">
        <div className="d-sub" style={{ marginBottom: 12 }}>
          Without a token, or as a backup you keep yourself: take a code from this device and
          open it on the other, and the two are merged — neither loses what it had. Books and
          API keys stay behind; this is progress only.
        </div>

        <div className="d-row" style={{ marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>On this device</div>
            <div className="d-sub">{mine.nodes} lessons done · {mine.words} words · {mine.xp} XP · {mine.streak}-day streak</div>
          </div>
        </div>

        <button className="d-btn blue" disabled={busy} onClick={make}>
          {busy ? <Loader size={16} className="spin" /> : <><Smartphone size={16} /> Make a transfer code</>}
        </button>

        {code && (
          <div style={{ marginTop: 12 }}>
            <textarea className="d-input" rows={3} readOnly value={code}
              style={{ fontSize: 11, fontFamily: "ui-monospace, monospace" }}
              onFocus={(e) => e.target.select()} />
            <div className="d-row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button className="d-btn ghost small" onClick={() => {
                navigator.clipboard?.writeText(code).then(() => say("Code copied"), () => say("Select it and copy"));
              }}><Copy size={14} /> Copy code</button>
              {codeInLink(code) && (
                <button className="d-btn ghost small" onClick={() => {
                  navigator.clipboard?.writeText(restoreLink(code)).then(() => say("Link copied — open it on the other device"), () => say("Couldn't copy"));
                }}><Link2 size={14} /> Copy link</button>
              )}
              <button className="d-btn ghost small" onClick={async () => say(`Saved ${downloadProgress(await collectProgress())}`)}>
                <Download size={14} /> Save file
              </button>
            </div>
            <div className="d-sub" style={{ marginTop: 6, fontSize: 12 }}>
              {(code.length / 1024).toFixed(1)} KB{codeInLink(code) ? "" : " — too long for a link, use the code or the file"}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, borderTop: "1px solid var(--d-line)", paddingTop: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Bring progress in</div>
          <div className="d-row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="d-btn ghost small" onClick={() => setShowPaste((v) => !v)}>
              <Upload size={14} /> Paste a code
            </button>
            <button className="d-btn ghost small" onClick={() => file.current?.click()}>
              <Upload size={14} /> Load a file
            </button>
            <input ref={file} type="file" accept=".json,.txt" style={{ display: "none" }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try { await take(await readProgressFile(f), "merge"); }
                catch (err) { say(err.message || "that file didn't read"); }
              }} />
          </div>
          {showPaste && (
            <div style={{ marginTop: 10 }}>
              <textarea className="d-input" rows={3} value={paste} placeholder="LVN1…"
                style={{ fontSize: 11, fontFamily: "ui-monospace, monospace" }}
                onChange={(e) => setPaste(e.target.value)} />
              <div className="d-row" style={{ gap: 8, marginTop: 8 }}>
                <button className="d-btn small" disabled={!paste.trim()} onClick={() => paste_("merge")}>Merge it in</button>
                <button className="d-btn ghost small" disabled={!paste.trim()} onClick={() => paste_("replace")}>Replace mine</button>
              </div>
            </div>
          )}
        </div>

        {msg && <div className="d-sub" style={{ marginTop: 10, color: "var(--d-green)" }}>{msg}</div>}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Voice                                                               */
/* ------------------------------------------------------------------ */
/* Only 338 of the course's sentences have a Duolingo recording. The rest are
   read by whichever model has a key here, cached after the first play. The
   keys for OpenAI and Gemini are the reader's existing AI tutor keys, set in
   the app's own Settings; ElevenLabs has no other use in the app, so its key
   lives here. */
function VoiceSettings() {
  const [engine, setEngine] = useState(voiceSettings().engine);
  const [voices, setVoices] = useState(voiceSettings().voice);
  const [key, setKey] = useState(getElevenKey());
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState("");
  const [cached, setCached] = useState(null);

  useEffect(() => { cachedCount().then(setCached); }, []);

  const available = availableEngines();
  const active = activeEngine();

  const choose = (id) => { setEngine(id); setVoiceSettings({ engine: id }); };
  const pickVoice = (eng, id) => {
    const next = { ...voices, [eng]: id };
    setVoices(next);
    setVoiceSettings({ voice: { [eng]: id } });
  };

  const saveKey = async () => {
    if (!key.trim()) { setElevenKey(""); setTesting(""); return; }
    setTesting("checking");
    try {
      await testVoiceKey("elevenlabs", key);
      setElevenKey(key);
      setTesting("ok");
    } catch (e) {
      setTesting(e.message || "that key didn't work");
    }
  };

  const options = [
    { id: "auto", label: "Automatic", blurb: available.length ? `uses ${VOICES[active]?.label || "the browser voice"}` : "no voice key set" },
    ...Object.entries(VOICES).map(([id, v]) => ({
      id, label: v.label,
      blurb: keyFor(id) ? "key set" : id === "elevenlabs" ? "needs a key below" : "needs a key in Settings",
      disabled: !keyFor(id),
    })),
    { id: "browser", label: "Browser voice", blurb: "free, and usually not installed for Hebrew" },
  ];

  return (
    <>
      <div className="d-title">Voice</div>
      <div className="d-card">
        <div className="d-sub" style={{ marginBottom: 12 }}>
          338 sentences came with Duolingo's own recording. Everything else is read by a
          model, using your own key, and kept afterwards so it is only generated once.
        </div>

        {options.map((o) => (
          <button key={o.id} className="d-row" disabled={o.disabled} style={{
            width: "100%", background: "transparent", border: "none", cursor: o.disabled ? "default" : "pointer",
            padding: "9px 2px", color: "var(--d-ink)", textAlign: "left", opacity: o.disabled ? .5 : 1,
          }} onClick={() => !o.disabled && choose(o.id)}>
            <span style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
              border: `2px solid ${engine === o.id ? "var(--d-green)" : "var(--d-line)"}`,
              background: engine === o.id ? "var(--d-green)" : "transparent",
            }} />
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, display: "block" }}>{o.label}</span>
              <span className="d-sub">{o.blurb}</span>
            </span>
            {engine === o.id && active === o.id && <Volume2 size={16} color="var(--d-green)" />}
          </button>
        ))}

        {VOICES[engine === "auto" ? active : engine] && (
          <div style={{ marginTop: 10 }}>
            <div className="d-sub" style={{ marginBottom: 6 }}>Voice</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {VOICES[engine === "auto" ? active : engine].voices.map((v) => {
                const eng = engine === "auto" ? active : engine;
                return (
                  <button key={v.id} className="d-pill" style={{
                    cursor: "pointer", border: "none",
                    background: voices[eng] === v.id ? "var(--d-blue)" : "var(--d-mute)",
                    color: voices[eng] === v.id ? "#fff" : "var(--d-sub)",
                  }} onClick={() => pickVoice(eng, v.id)}>{v.label}</button>
                );
              })}
            </div>
            <button className="d-btn ghost small" style={{ marginTop: 10 }}
              onClick={() => playPhrase("שלום, איך הולך? אני לומד עברית.", "")}>
              <Volume2 size={15} /> Hear it
            </button>
          </div>
        )}

        <div style={{ marginTop: 14, borderTop: "1px solid var(--d-line)", paddingTop: 12 }}>
          <div className="d-sub" style={{ marginBottom: 6 }}>
            ElevenLabs key — the only one of the three built for languages other than English.
            It is kept in this browser and sent to nobody else.
          </div>
          <div className="d-row">
            <input
              className="d-input"
              style={{ flex: 1, padding: "10px 12px", fontSize: 14 }}
              type={show ? "text" : "password"}
              value={key}
              placeholder="sk_…"
              onChange={(e) => { setKey(e.target.value); setTesting(""); }}
            />
            <button className="d-icon-btn" onClick={() => setShow((v) => !v)} aria-label="Show key">
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <button className="d-btn ghost small" style={{ marginTop: 8 }} onClick={saveKey}>
            {testing === "checking" ? <Loader size={14} className="spin" /> : <KeyRound size={14} />} Save and test
          </button>
          {testing && testing !== "checking" && (
            <div className="d-sub" style={{ marginTop: 6, color: testing === "ok" ? "var(--d-green)" : "var(--d-red)" }}>
              {testing === "ok" ? "That key works." : testing}
            </div>
          )}
        </div>

        <div className="d-row" style={{ marginTop: 14, borderTop: "1px solid var(--d-line)", paddingTop: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Cached voices</div>
            <div className="d-sub">{cached == null ? "…" : `${cached} sentences stored on this device`}</div>
          </div>
          <button className="d-btn ghost small" onClick={() => clearVoiceCache().then(() => setCached(0))}>Clear</button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
export function Profile({ course, onReset }) {
  const duo = useDuo();
  const t = totals(duo, course.units);
  const acc = duo.stats.answered ? Math.round((duo.stats.correct / duo.stats.answered) * 100) : 0;
  const [confirm, setConfirm] = useState(false);

  /* the last seven days, for the little streak calendar */
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    week.push({ key, letter: "SMTWTFS"[d.getDay()], xp: duo.days[key] || 0 });
  }

  const stats = [
    { icon: Flame, color: "var(--d-orange)", v: duo.streak, k: "Day streak" },
    { icon: Zap, color: "var(--d-gold)", v: duo.xp, k: "Total XP" },
    { icon: Crown, color: "var(--d-purple)", v: t.crowns, k: "Crowns" },
    { icon: Trophy, color: "var(--d-gold)", v: t.unitsDone, k: "Units finished" },
    { icon: BookOpen, color: "var(--d-blue)", v: t.words, k: "Words met" },
    { icon: Target, color: "var(--d-green)", v: `${acc}%`, k: "Accuracy" },
  ];

  return (
    <div>
      <div className="d-title">Statistics</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {stats.map((s) => (
          <div className="d-card d-row" key={s.k} style={{ marginBottom: 0 }}>
            <s.icon size={22} color={s.color} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{s.v}</div>
              <div className="d-sub" style={{ fontSize: 12 }}>{s.k}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="d-title">This week</div>
      <div className="d-card">
        <div className="d-row" style={{ justifyContent: "space-between" }}>
          {week.map((d) => (
            <div key={d.key} className="d-center" style={{ flex: 1 }}>
              <div className="d-sub" style={{ fontSize: 11 }}>{d.letter}</div>
              <div style={{
                width: 30, height: 30, borderRadius: "50%", margin: "4px auto 0",
                background: d.xp > 0 ? "var(--d-orange)" : d.frozen ? "var(--d-blue)" : "var(--d-mute)",
                color: d.xp > 0 || d.frozen ? "#fff" : "var(--d-sub)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {d.xp > 0 ? <Flame size={15} /> : ""}
              </div>
            </div>
          ))}
        </div>
        <div className="d-sub" style={{ marginTop: 10 }}>
          One lesson a day keeps the streak. Miss a day and it starts again — nothing to buy
          back, and nothing lost but the number.
        </div>
      </div>

      <DailyGoal />

      <CloudSync />

      <DeviceTransfer />

      <div className="d-title">Achievements</div>
      {achievements(duo, course.units).map((a) => {
        const Icon = ICONS[a.icon] || Star;
        const value = a.id === "marksman" ? `${Math.round(a.value * 100)}%` : a.value;
        const next = a.id === "marksman" ? `${Math.round(a.next * 100)}%` : a.next;
        return (
          <div className="d-card d-row" key={a.id}>
            <span style={{
              width: 46, height: 46, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
              background: a.tier ? "var(--d-gold)" : "var(--d-mute)", color: a.tier ? "#fff" : "var(--d-sub)",
            }}><Icon size={22} /></span>
            <div style={{ flex: 1 }}>
              <div className="d-row">
                <span style={{ fontWeight: 800, flex: 1 }}>{a.name}</span>
                <span className="d-pill">Level {a.tier}</span>
              </div>
              <div className="d-sub">{a.blurb}</div>
              <Bar value={a.value} max={a.next} color="var(--d-gold)" />
              <div className="d-sub" style={{ fontSize: 12, marginTop: 3 }}>{value} / {next}</div>
            </div>
          </div>
        );
      })}

      <VoiceSettings />

      <div className="d-title">Settings</div>
      <div className="d-card">
        {[
          ["sound", "Sound effects"],
          ["animations", "Animations"],
          ["listening", "Listening exercises"],
          ["speaking", "Speaking exercises"],
          ["wordBank", "Answer from the word bank"],
          ["aiGrading", "Let the AI tutor judge close answers"],
          ["aiNotes", "Explain what went wrong"],
        ].map(([key, label]) => (
          <div className="d-row" key={key} style={{ padding: "9px 0", borderBottom: "1px solid var(--d-line)" }}>
            <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
            <button
              className={`d-btn small ${duo.settings[key] ? "" : "ghost"}`}
              onClick={() => setSetting(key, !duo.settings[key])}
            >{duo.settings[key] ? "On" : "Off"}</button>
          </div>
        ))}
        <div className="d-sub" style={{ marginTop: 10 }}>
          The course ships one accepted translation per sentence, so a fair answer in
          different words gets marked wrong. With an AI key set in the app's Settings, a
          typed answer the list rejects is put to the model before the red bar comes up,
          and anything it allows is remembered for that sentence. A wrong answer also gets
          a line saying what was actually wrong with it — which for Hebrew is usually
          agreement or a missing את, and invisible unless you know to look.
        </div>

        <div style={{ marginTop: 14 }}>
          {confirm ? (
            <>
              <div className="d-sub" style={{ marginBottom: 8 }}>This wipes every crown, the streak, the XP and the words.</div>
              <button className="d-btn red" onClick={() => { resetDuo(); onReset?.(); setConfirm(false); }}>Yes, reset the course</button>
              <button className="d-btn ghost" style={{ marginTop: 8 }} onClick={() => setConfirm(false)}>Cancel</button>
            </>
          ) : (
            <button className="d-btn ghost" onClick={() => setConfirm(true)}><RotateCcw size={16} /> Reset progress</button>
          )}
        </div>
      </div>

      <div className="d-sub" style={{ paddingBottom: 20 }}>
        Course data scraped from Duolingo's own payloads and guidebooks: {course.totals.units} units,
        {" "}{course.totals.nodes} nodes, {course.totals.phrases} key phrases, {course.totals.lexemes} lexemes,
        {" "}{course.totals.tips} units with the original Tips &amp; Notes.
      </div>
    </div>
  );
}
