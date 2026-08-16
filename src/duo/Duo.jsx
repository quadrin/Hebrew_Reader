/* The Duolingo Hebrew tree, rebuilt.

   This is the shell: the header that carries the streak, the sync light and
   the day's goal, the three destinations along the bottom, and the code that
   turns a tap on a path node into a session — which unit's material to fetch,
   what kind of session it is, how much XP it is worth, and what finishing it
   advances. */

import { useState, useEffect, useMemo } from "react";
import {
  Flame, Loader, Target, Dumbbell, User, Route, Gift, KeyRound, Gauge, Smartphone,
  Cloud, CloudOff, Zap,
} from "lucide-react";

import "./duo.css";
import { fetchCourse, fetchUnitWindow, fetchUnit } from "./data.js";
import { buildSession, placementStep, PLACEMENT_LADDER } from "./exercises.js";
import {
  useDuo, loadDuo, reloadDuo, startClock, currentPosition, lessonsDone,
  markLegendary, finishSession, dueWords, dayKey, testOut, nodeStatus,
} from "./state.js";
import { setSoundEnabled, sfx, warmAudio, hasHebrewVoice } from "./audio.js";
import { prefetchVoices, canGenerateSpeech } from "../voice.js";
import { warmSpeech } from "../text.js";
import { pendingRestore, clearRestoreHash, applyProgress, summarise } from "../sync.js";
import { startAutoSync, syncSoon, isConnected, onCloudChange, cloudStatus, syncNow } from "../cloud.js";
import Path from "./Path.jsx";
import Session from "./Session.jsx";
import Guidebook from "./Guidebook.jsx";
import { PracticeHub, Profile } from "./Screens.jsx";

const XP_FOR = {
  lesson: 10, review: 20, practice: 5, legendary: 40, mistakes: 10,
  listening: 10, speaking: 10, personalized: 15, test: 40, checkpoint: 100,
  chest: 20,
};
/* Lessons have no fail state at all; a test has three strikes, which on twenty
   exercises asks for much the same accuracy but ends early rather than making
   you finish something already failed. */
const STRIKES = 3;


export default function Duo({ C, HEB_FONT, UI_FONT }) {
  const duo = useDuo();
  const [course, setCourse] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("learn");
  const [session, setSession] = useState(null);
  const [guide, setGuide] = useState(null);
  const [busy, setBusy] = useState(false);
  const [chest, setChest] = useState(null);
  const [testing, setTesting] = useState(null);   /* the unit whose test is being offered */
  const [placing, setPlacing] = useState(false);  /* the placement offer */
  const [placed, setPlaced] = useState(null);     /* its result */
  const [streakCard, setStreakCard] = useState(null);
  const [restore, setRestore] = useState(null);   /* progress arriving from a link */
  const [pulled, setPulled] = useState(null);     /* progress arriving from the gist */
  const [connected, setConnected] = useState(isConnected());
  const [cloud, setCloud] = useState(cloudStatus());

  useEffect(() => {
    /* the voice list arrives asynchronously; ask for it now so the first
       lesson knows whether dictation beyond the 338 recordings is possible */
    warmSpeech();
    /* A link from another device carries its progress in the address bar. It
       is checked on load and again on a hash change, because opening the link
       while the app is already open changes the address without reloading. */
    const takeHash = () => {
      const incoming = pendingRestore();
      if (incoming) { setRestore(incoming); clearRestoreHash(); }
    };
    takeHash();
    window.addEventListener("hashchange", takeHash);
    loadDuo();
    const stop = startClock();
    fetchCourse().then(setCourse).catch((e) => setErr(e.message || "couldn't load the course"));

    const offCloud = onCloudChange(() => { setConnected(isConnected()); setCloud({ ...cloudStatus() }); });

    return () => { window.removeEventListener("hashchange", takeHash); offCloud(); stop(); };
  }, []);

  useEffect(() => { setSoundEnabled(duo.settings.sound); }, [duo.settings.sound]);

  /* Sync on open, on focus, on leaving, and on a slow timer — restarted when a
     token is added, so connecting takes effect without a reload. */
  useEffect(() => {
    if (!connected) return undefined;
    return startAutoSync({ onPulled: (r) => setPulled(r.summary || null) });
  }, [connected]);

  /* the reader's theme, translated into the path's variables */
  const vars = {
    "--d-bg": C.paper, "--d-card": C.card, "--d-ink": C.ink, "--d-sub": C.sub,
    "--d-line": C.line, "--d-mute": C.soft, "--d-mute-dark": C.line, "--d-muteInk": C.sub,
    "--d-ui": UI_FONT, "--d-heb": HEB_FONT,
  };

  const known = useMemo(() => new Set(Object.keys(duo.words)), [duo.words]);
  const today = duo.days[dayKey()] || 0;
  const goalPct = Math.min(100, (today / duo.goal) * 100);

  /* ---------------- starting things ---------------- */
  const launch = async ({ unitDef, node, nodeIndex, kind, advance, title, strikes, unlockTo, docs: given }) => {
    setBusy(true);
    warmAudio();
    try {
      const docs = given || await fetchUnitWindow(unitDef.unit, kind === "review" || kind === "legendary" ? 4 : 2);
      const items = buildSession({
        unit: unitDef.unit, docs, kind,
        lessonIndex: nodeIndex == null ? 0 : lessonsDone(duo, unitDef.unit, nodeIndex),
        known, settings: duo.settings,
        mistakes: duo.mistakes, dueWords: dueWords(duo),
        voice: hasHebrewVoice(),
      });
      if (!items.length) { setErr("that unit has no material to build a lesson from"); return; }
      /* warm the voices this session will ask for, so the first listening
         exercise plays rather than waits */
      prefetchVoices(items.filter((i) => (i.type === "listen" || i.type === "speak") && !i.audio)
        .map((i) => i.text || i.prompt));
      setSession({
        items,
        meta: {
          unit: unitDef.unit, node: nodeIndex, kind, advance, strikes, unlockTo,
          xp: XP_FOR[kind] ?? 10,
          title: title || `Unit ${unitDef.unit} · ${unitDef.skill}`,
          firstToday: duo.lastLesson !== dayKey(),
        },
      });
    } catch (e) {
      setErr(e.message || "couldn't start that lesson");
    } finally {
      setBusy(false);
    }
  };

  const onStartNode = (unitDef, nodeIndex, node, st) => {
    if (node.type === "chest" && !st.complete) {
      /* the chest used to pay in gems, which had a shop to be spent in; with
         the shop gone it pays the only currency left that means anything */
      finishSession({
        unit: unitDef.unit, node: nodeIndex, xp: XP_FOR.chest, correct: 0, answered: 0,
        ms: 0, perfect: false, kind: "chest", advance: true,
      });
      sfx("gem");
      setChest(XP_FOR.chest);
      return;
    }
    const kind = node.type === "unit_review" ? "review"
      : node.type === "practice" ? "practice"
      : st.complete ? (node.type === "skill" ? "legendary" : "practice")
      : "lesson";
    launch({
      unitDef, node, nodeIndex, kind,
      advance: !st.complete,
      title: kind === "review" ? `Unit ${unitDef.unit} review` : `Unit ${unitDef.unit} · ${unitDef.skill}`,
    });
  };

  const onPracticeKind = (id) => {
    const pos = currentPosition(duo, course.units);
    const unitDef = course.units.find((u) => u.unit === pos.unit) || course.units[0];
    launch({ unitDef, nodeIndex: null, kind: id, advance: false, title: {
      mistakes: "Mistakes", personalized: "Personalised practice",
      listening: "Listen up", speaking: "Speak up",
    }[id] || "Practice" });
  };

  /* Duolingo's key: pass one test instead of working through the lessons.
     A unit test opens that unit; a checkpoint test opens the whole block, and
     everything before it, because there is no sense in a hole in the path. */
  const startUnitTest = (unitDef) => {
    setTesting(null);
    launch({
      unitDef, nodeIndex: null, kind: "test", advance: false, strikes: STRIKES,
      unlockTo: unitDef.unit, title: `Unit ${unitDef.unit} test`,
    });
  };

  const sampleAcross = (first, last, n = 6) => {
    const span = Math.max(1, last - first);
    const picks = new Set();
    for (let i = 0; i < n; i++) picks.add(first + Math.round((span * i) / (n - 1)));
    return [...picks].filter((u) => u >= first && u <= last);
  };

  const startCheckpointTest = async (cp) => {
    setBusy(true);
    try {
      const docs = (await Promise.all(sampleAcross(cp.first, cp.last).map((u) => fetchUnit(u).catch(() => null)))).filter(Boolean);
      const unitDef = course.units.find((u) => u.unit === cp.last);
      await launch({
        unitDef, nodeIndex: null, kind: "checkpoint", advance: false, strikes: STRIKES,
        unlockTo: cp.last, title: `Checkpoint ${cp.n}`, docs,
      });
    } catch (e) {
      setErr(e.message || "couldn't start that test");
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- the placement test ---------------- */
  const startPlacement = async () => {
    setPlacing(false);
    setBusy(true);
    const rung = { at: 0, reached: 0, seen: 0, right: 0 };
    const questionsFor = async (unit) => {
      const docs = await fetchUnitWindow(unit, 1);
      return buildSession({
        unit, docs, kind: "placement", lessonIndex: rung.at,
        known, settings: { ...duo.settings, speaking: false },
        voice: hasHebrewVoice(),
      }).map((ex, i) => ({ ...ex, key: `place-${unit}-${i}` }));
    };

    try {
      const first = await questionsFor(PLACEMENT_LADDER[0]);
      if (!first.length) { setErr("couldn't build a placement test"); return; }
      setSession({
        items: first,
        meta: {
          unit: PLACEMENT_LADDER[0], node: null, kind: "placement", advance: false,
          xp: 0, title: "Placement test", placement: true, noRequeue: true,
          firstToday: duo.lastLesson !== dayKey(),
          /* called when the rung's three questions are done */
          more: async ({ correct, answered }) => {
            const step = placementStep(rung, correct - rung.right, answered - rung.seen);
            rung.right = correct;
            rung.seen = answered;
            rung.reached = step.reached;
            if (step.done) return null;
            rung.at = step.at;
            return questionsFor(step.unit);
          },
          onPlaced: () => rung.reached,
        },
      });
    } catch (e) {
      setErr(e.message || "couldn't start the placement test");
    } finally {
      setBusy(false);
    }
  };

  const onSessionFinish = () => {
    const meta = session?.meta;
    setSession(null);
    /* whatever just happened is worth putting somewhere other than this device */
    syncSoon({ reason: "session" });
    if (!meta) return;
    if (meta.kind === "legendary" && meta.node != null) markLegendary(meta.unit, meta.node);
    if (meta.unlockTo) testOut(course.units.filter((u) => u.unit <= meta.unlockTo));
    if (meta.placement) {
      /* placed at the top of the highest rung answered — everything below it
         counts as known, and the path opens there */
      const reached = meta.onPlaced?.() || 0;
      if (reached > 0) testOut(course.units.filter((u) => u.unit <= reached));
      setPlaced(reached);
      return;
    }
    if (meta.firstToday) setStreakCard(true);
  };

  /* ---------------- render ---------------- */
  if (err && !course) {
    return (
      <main className="duo" style={vars}>
        <div className="d-card" style={{ marginTop: 24 }}>
          <div className="d-title">The path isn't in this build</div>
          <div className="d-sub">{err}. Run <code>npm run build:duo</code> to generate it.</div>
        </div>
      </main>
    );
  }
  if (!course) {
    return (
      <main className="duo d-center" style={{ ...vars, padding: 60 }}>
        <Loader className="spin" size={26} color="var(--d-green)" />
      </main>
    );
  }

  if (session) {
    return (
      <div className="duo" style={vars}>
        <Session
          items={session.items}
          meta={session.meta}
          onExit={(opts) => {
            const was = session.meta;
            setSession(null);
            if (opts?.retry && was?.unlockTo) {
              const unitDef = course.units.find((u) => u.unit === was.unlockTo);
              if (was.kind === "checkpoint") {
                const cp = (course.checkpoints || []).find((c) => c.last === was.unlockTo);
                if (cp) startCheckpointTest(cp);
              } else if (unitDef) startUnitTest(unitDef);
              return;
            }
          }}
          onFinish={onSessionFinish}
        />
      </div>
    );
  }

  return (
    <main className="duo" style={vars} aria-label="Hebrew path">
      {/* ---------- the header ---------- */}
      <div className="d-hud">
        <span className="d-stat flame" title="Day streak"><Flame size={20} fill={duo.streak ? "var(--d-orange)" : "none"} />{duo.streak}</span>
        <span className="d-stat" style={{ color: "var(--d-gold)" }} title="Total XP"><Zap size={19} />{duo.xp}</span>
        <button
          className="d-stat"
          style={{
            border: "none", background: "transparent", cursor: "pointer", padding: 0,
            color: !connected ? "var(--d-sub)" : cloud.state === "error" ? "var(--d-red)" : "var(--d-green)",
          }}
          title={!connected
            ? "Progress is on this device only — tap to sync it"
            : cloud.state === "error" ? `Sync trouble: ${cloud.error}`
            : cloud.state === "syncing" ? "Syncing…"
            : "Synced"}
          onClick={() => { setTab("profile"); if (connected) syncNow({ reason: "tap" }); }}
          aria-label={connected ? "Sync status" : "Set up sync"}
        >
          {cloud.state === "syncing" ? <Loader size={17} className="spin" />
            : connected ? <Cloud size={17} /> : <CloudOff size={17} />}
        </button>
        <span style={{ flex: 1 }} />
        <span title={`${today} of ${duo.goal} XP today`} style={{ position: "relative", width: 34, height: 34 }}>
          <svg width="34" height="34" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="17" cy="17" r="14" fill="none" stroke="var(--d-mute)" strokeWidth="5" />
            <circle cx="17" cy="17" r="14" fill="none" stroke="var(--d-gold)" strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${(goalPct / 100) * 2 * Math.PI * 14} 999`} />
          </svg>
          <Target size={15} color="var(--d-gold)" style={{ position: "absolute", inset: 0, margin: "auto" }} />
        </span>
      </div>

      {/* ---------- the destinations ---------- */}
      <div className="d-tabs">
        {[
          ["learn", Route, "Learn"],
          ["practice", Dumbbell, "Practice"],
          ["profile", User, "You"],
        ].map(([id, Icon, label]) => (
          <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            <Icon size={17} />{label}
          </button>
        ))}
      </div>

      {err && <div className="d-sub" style={{ color: "var(--d-red)", marginTop: 10 }}>{err}</div>}

      {tab === "learn" && (
        <Path
          course={course}
          busy={busy}
          onStart={onStartNode}
          onGuidebook={setGuide}
          onTest={setTesting}
          onCheckpoint={startCheckpointTest}
          onPlacement={() => setPlacing(true)}
        />
      )}
      {tab === "practice" && <PracticeHub course={course} onPractice={onPracticeKind} />}
      {tab === "profile" && <Profile course={course} onReset={() => setTab("learn")} />}

      {guide && (
        <Guidebook
          unit={guide}
          onClose={() => setGuide(null)}
          onPractice={(u) => {
            setGuide(null);
            launch({ unitDef: u, nodeIndex: null, kind: "practice", advance: false, title: `Unit ${u.unit} practice` });
          }}
        />
      )}

      {testing && (
        <div className="d-sheet" onClick={() => setTesting(null)}>
          <div className="d-sheet-inner" onClick={(e) => e.stopPropagation()}>
            <div className="d-center">
              <KeyRound size={44} color="var(--d-gold)" />
              <div className="d-title" style={{ fontSize: 22 }}>Test out of unit {testing.unit}?</div>
              <div className="d-sub" style={{ marginBottom: 16 }}>
                Twenty exercises from {testing.objective || testing.skill}. Three mistakes ends
                the test — it costs no hearts, and nothing is lost if you don't pass. Pass, and
                unit {testing.unit} and everything before it opens at once, worth {XP_FOR.test} XP.
              </div>
            </div>
            <button className="d-btn gold" onClick={() => startUnitTest(testing)}>
              <KeyRound size={16} /> Start the test
            </button>
            <button className="d-btn ghost" style={{ marginTop: 10 }} onClick={() => setTesting(null)}>Not now</button>
          </div>
        </div>
      )}

      {pulled && (
        <div className="d-card d-row" style={{ borderColor: "var(--d-blue)", marginTop: 12 }}>
          <Smartphone size={20} color="var(--d-blue)" />
          <div className="d-sub" style={{ flex: 1 }}>
            Synced from your other device — {pulled.nodes} lessons, {pulled.words} words.
          </div>
          <button className="d-btn ghost small" onClick={() => setPulled(null)}>OK</button>
        </div>
      )}

      {restore && (
        <div className="d-sheet" onClick={() => setRestore(null)}>
          <div className="d-sheet-inner" onClick={(e) => e.stopPropagation()}>
            <div className="d-center">
              <Smartphone size={44} color="var(--d-blue)" />
              <div className="d-title" style={{ fontSize: 22 }}>Progress from another device</div>
              <div className="d-sub" style={{ marginBottom: 16 }}>
                {(() => {
                  const s = summarise(restore);
                  return `${s.nodes} lessons, ${s.words} words, ${s.xp} XP, a ${s.streak}-day streak${
                    s.at ? `, saved ${s.at.toLocaleDateString()}` : ""}.`;
                })()}
                {" "}Merging keeps whatever this device has done as well.
              </div>
            </div>
            <button className="d-btn blue" onClick={async () => {
              await applyProgress(restore, { mode: "merge" });
              window.location.reload();
            }}>Merge it in</button>
            <button className="d-btn ghost" style={{ marginTop: 10 }} onClick={async () => {
              await applyProgress(restore, { mode: "replace" });
              window.location.reload();
            }}>Replace what's here</button>
            <button className="d-btn ghost" style={{ marginTop: 10 }} onClick={() => setRestore(null)}>Ignore it</button>
          </div>
        </div>
      )}

      {placing && (
        <div className="d-sheet" onClick={() => setPlacing(false)}>
          <div className="d-sheet-inner" onClick={(e) => e.stopPropagation()}>
            <div className="d-center">
              <Gauge size={44} color="var(--d-blue)" />
              <div className="d-title" style={{ fontSize: 22 }}>How much Hebrew do you know?</div>
              <div className="d-sub" style={{ marginBottom: 16 }}>
                Three questions at a time, getting harder, stopping as soon as a set defeats you.
                Two minutes at most. Whatever you clear is unlocked, and the path starts from
                there — you can always go back down it.
              </div>
            </div>
            <button className="d-btn blue" disabled={busy} onClick={startPlacement}>
              {busy ? <Loader size={16} className="spin" /> : "Start the placement test"}
            </button>
            <button className="d-btn ghost" style={{ marginTop: 10 }} onClick={() => setPlacing(false)}>
              I'll start from the beginning
            </button>
          </div>
        </div>
      )}

      {placed != null && (
        <div className="d-sheet" onClick={() => setPlaced(null)}>
          <div className="d-sheet-inner d-center" onClick={(e) => e.stopPropagation()}>
            <Gauge size={56} color="var(--d-blue)" className="d-grow" />
            {placed > 0 ? (
              <>
                <div className="d-title" style={{ fontSize: 26 }}>You start at unit {placed + 1}</div>
                <div className="d-sub">
                  {placed} unit{placed === 1 ? "" : "s"} unlocked — {course.units
                    .filter((u) => u.unit <= placed)
                    .reduce((a, u) => a + u.nodes.length, 0)} nodes of the path, already done.
                  Everything behind you is still there to practise.
                </div>
              </>
            ) : (
              <>
                <div className="d-title" style={{ fontSize: 24 }}>Starting at the beginning</div>
                <div className="d-sub">Unit 1 teaches the alphabet, which is the right place to start.</div>
              </>
            )}
            <button className="d-btn" style={{ marginTop: 20 }} onClick={() => setPlaced(null)}>Take me there</button>
          </div>
        </div>
      )}

      {chest != null && (
        <div className="d-sheet" onClick={() => setChest(null)}>
          <div className="d-sheet-inner d-center" onClick={(e) => e.stopPropagation()}>
            <Gift size={64} color="var(--d-gold)" className="d-grow" />
            <div className="d-title" style={{ fontSize: 24 }}>You opened a chest!</div>
            <div className="d-stat" style={{ justifyContent: "center", fontSize: 26, color: "var(--d-gold)" }}><Zap size={26} /> +{chest} XP</div>
            <button className="d-btn" style={{ marginTop: 20 }} onClick={() => setChest(null)}>Collect</button>
          </div>
        </div>
      )}

      {streakCard && (
        <div className="d-sheet" onClick={() => setStreakCard(null)}>
          <div className="d-sheet-inner d-center" onClick={(e) => e.stopPropagation()}>
            <Flame size={72} color="var(--d-orange)" fill="var(--d-orange)" className="d-grow" />
            <div className="d-title" style={{ fontSize: 30, color: "var(--d-orange)" }}>{duo.streak} day streak!</div>
            <div className="d-sub">
              {today >= duo.goal ? "Daily goal met." : `${duo.goal - today} XP left of today's goal.`}
            </div>
            <button className="d-btn" style={{ marginTop: 20 }} onClick={() => setStreakCard(null)}>Continue</button>
          </div>
        </div>
      )}
    </main>
  );
}
