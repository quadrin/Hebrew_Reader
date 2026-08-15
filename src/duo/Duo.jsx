/* The Duolingo Hebrew tree, rebuilt.

   This is the shell: the header that carries the streak, the gems and the
   hearts, the five destinations along the bottom, and the code that turns a tap
   on a path node into a session — which unit's material to fetch, what kind of
   session it is, how much XP it is worth, and what finishing it advances. */

import { useState, useEffect, useMemo } from "react";
import {
  Flame, Gem, Heart, Zap, Loader, Trophy, Target, Dumbbell, ShoppingBag, User, Route, Gift,
} from "lucide-react";

import "./duo.css";
import { fetchCourse, fetchUnitWindow } from "./data.js";
import { buildSession } from "./exercises.js";
import {
  useDuo, loadDuo, startClock, currentPosition, lessonsDone,
  markLegendary, addGems, finishSession, dueWords, dayKey,
} from "./state.js";
import { setSoundEnabled, sfx, warmAudio } from "./audio.js";
import Path from "./Path.jsx";
import Session from "./Session.jsx";
import Guidebook from "./Guidebook.jsx";
import { PracticeHub, Leagues, Quests, Shop, Profile } from "./Screens.jsx";

const XP_FOR = { lesson: 10, review: 20, practice: 5, legendary: 40, mistakes: 10, listening: 10, speaking: 10, personalized: 15 };

export default function Duo({ C, HEB_FONT, UI_FONT }) {
  const duo = useDuo();
  const [course, setCourse] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("learn");
  const [session, setSession] = useState(null);
  const [guide, setGuide] = useState(null);
  const [busy, setBusy] = useState(false);
  const [chest, setChest] = useState(null);
  const [streakCard, setStreakCard] = useState(null);

  useEffect(() => {
    loadDuo();
    const stop = startClock();
    fetchCourse().then(setCourse).catch((e) => setErr(e.message || "couldn't load the course"));
    return stop;
  }, []);

  useEffect(() => { setSoundEnabled(duo.settings.sound); }, [duo.settings.sound]);

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
  const launch = async ({ unitDef, node, nodeIndex, kind, advance, title, heartReward }) => {
    setBusy(true);
    warmAudio();
    try {
      const docs = await fetchUnitWindow(unitDef.unit, kind === "review" || kind === "legendary" ? 4 : 2);
      const items = buildSession({
        unit: unitDef.unit, docs, kind,
        lessonIndex: nodeIndex == null ? 0 : lessonsDone(duo, unitDef.unit, nodeIndex),
        known, settings: duo.settings,
        mistakes: duo.mistakes, dueWords: dueWords(duo),
      });
      if (!items.length) { setErr("that unit has no material to build a lesson from"); return; }
      setSession({
        items,
        meta: {
          unit: unitDef.unit, node: nodeIndex, kind, advance, heartReward,
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
      const reward = 15 + ((unitDef.unit * 7) % 21);
      addGems(reward);
      finishSession({
        unit: unitDef.unit, node: nodeIndex, xp: 0, correct: 0, answered: 0,
        ms: 0, perfect: false, kind: "chest", advance: true,
      });
      sfx("gem");
      setChest(reward);
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

  const onSessionFinish = () => {
    const meta = session?.meta;
    setSession(null);
    if (!meta) return;
    if (meta.kind === "legendary" && meta.node != null) markLegendary(meta.unit, meta.node);
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
            setSession(null);
            /* leaving a lesson because the hearts ran out drops you into a
               practice session that pays one back */
            if (opts?.practiceForHeart) {
              const pos = currentPosition(duo, course.units);
              const unitDef = course.units.find((u) => u.unit === pos.unit) || course.units[0];
              launch({ unitDef, nodeIndex: null, kind: "practice", advance: false, heartReward: true, title: "Practice for a heart" });
            }
          }}
          onFinish={onSessionFinish}
        />
      </div>
    );
  }

  const heartsIn = duo.heartAt ? Math.max(0, Math.ceil((duo.heartAt - Date.now()) / 60000)) : 0;

  return (
    <main className="duo" style={vars} aria-label="Hebrew path">
      {/* ---------- the header ---------- */}
      <div className="d-hud">
        <span className="d-stat flame" title="Day streak"><Flame size={20} fill={duo.streak ? "var(--d-orange)" : "none"} />{duo.streak}</span>
        <span className="d-stat gem" title="Gems"><Gem size={20} />{duo.gems}</span>
        <span className={`d-stat heart ${duo.hearts ? "" : "dim"}`} title={heartsIn ? `next heart in ${heartsIn} min` : "hearts"}>
          <Heart size={20} fill={duo.hearts ? "var(--d-red)" : "none"} />
          {duo.settings.unlimitedHearts ? "∞" : duo.hearts}
        </span>
        {duo.boost > Date.now() && <span className="d-stat" style={{ color: "var(--d-purple)" }}><Zap size={18} /></span>}
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
          ["league", Trophy, "League"],
          ["quests", Target, "Quests"],
          ["shop", ShoppingBag, "Shop"],
          ["profile", User, "You"],
        ].map(([id, Icon, label]) => (
          <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            <Icon size={17} />{label}
          </button>
        ))}
      </div>

      {err && <div className="d-sub" style={{ color: "var(--d-red)", marginTop: 10 }}>{err}</div>}

      {tab === "learn" && (
        <Path course={course} busy={busy} onStart={onStartNode} onGuidebook={setGuide} />
      )}
      {tab === "practice" && <PracticeHub course={course} onPractice={onPracticeKind} />}
      {tab === "league" && <Leagues />}
      {tab === "quests" && <Quests />}
      {tab === "shop" && <Shop />}
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

      {chest != null && (
        <div className="d-sheet" onClick={() => setChest(null)}>
          <div className="d-sheet-inner d-center" onClick={(e) => e.stopPropagation()}>
            <Gift size={64} color="var(--d-gold)" className="d-grow" />
            <div className="d-title" style={{ fontSize: 24 }}>You opened a chest!</div>
            <div className="d-stat gem" style={{ justifyContent: "center", fontSize: 26 }}><Gem size={26} /> +{chest}</div>
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
