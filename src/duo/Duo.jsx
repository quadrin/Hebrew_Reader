/* The Duolingo Hebrew tree, rebuilt.

   This is the shell: the header that carries the streak, the sync light and
   the day's goal, the three destinations along the bottom, and the code that
   turns a tap on a path node into a session — which unit's material to fetch,
   what kind of session it is, how much XP it is worth, and what finishing it
   advances. */

import { useState, useEffect, useMemo } from "react";
import {
  Flame, Loader, Target, Dumbbell, User, Route, KeyRound, Gauge, Smartphone,
  Zap, History, BookOpen,
} from "lucide-react";

import "./duo.css";
import { duoVars } from "./vars.js";
import { fetchCourse, fetchUnitWindow, fetchUnit, fetchImages, fetchLexicon } from "./data.js";
import { buildSession, placementStep, PLACEMENT_LADDER } from "./exercises.js";
import {
  useDuo, loadDuo, reloadDuo, startClock,
  markLegendary, finishSession, dueWords, dayKey, testOut,
  unitComplete, staleUnits, recentPace, reachedUnit, unitStrength,
  isLastCard, getDuo, practiceUnit, mistakesUpTo,
} from "./state.js";
import { setSoundEnabled, sfx, warmAudio, hasHebrewVoice } from "./audio.js";
import { prefetchVoices } from "../voice.js";
import { warmSpeech } from "../text.js";
import { pendingRestore, clearRestoreHash, applyProgress, summarise } from "../sync.js";
import { startAutoSync, syncSoon, isConnected, onCloudChange } from "../cloud.js";
import Passage from "./Passage.jsx";
import Article from "./Article.jsx";
import { buildFeedDrill } from "./feedDrill.js";
import { rng, hash } from "./rand.js";
import { passageFor } from "./passages.js";
import Path from "./Path.jsx";
import Session from "./Session.jsx";
import Guidebook from "./Guidebook.jsx";
import { PracticeHub, Profile, sinceLabel } from "./Screens.jsx";
import Boundary from "../Boundary.jsx";
import Sheet from "./Sheet.jsx";
import { ChestArt } from "./Art.jsx";
import { useLayer } from "../useDialog.js";

const XP_FOR = {
  lesson: 10, review: 20, practice: 5, legendary: 40, mistakes: 10,
  listening: 10, speaking: 10, personalized: 15, test: 40, checkpoint: 100,
  chest: 20,
};
/* Lessons have no fail state at all; a test has three strikes, which on twenty
   exercises asks for much the same accuracy but ends early rather than making
   you finish something already failed. */
const STRIKES = 3;




export default function Duo({ C, HEB_FONT, UI_FONT, myWords, jump }) {
  const duo = useDuo();
  const [course, setCourse] = useState(null);
  const [images, setImages] = useState(null);   /* word → the picture that teaches it */
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("learn");
  /* an error belongs to the screen it happened on; leaving it clears it */
  useEffect(() => { setErr(""); }, [tab]);
  const [session, setSession] = useState(null);
  const [guide, setGuide] = useState(null);
  const [story, setStory] = useState(null);   /* the unit whose closing passage is open */
  const [reading, setReading] = useState(false); /* the feed of real Hebrew, open */
  /* the two reading screens are layers over the path: Back leaves them */
  useLayer(!!reading && !session, "feed", () => setReading(false));
  useLayer(!!story, "passage", () => setStory(null));
  const [busy, setBusy] = useState(false);
  const [chest, setChest] = useState(null);
  const [testing, setTesting] = useState(null);   /* the unit whose test is being offered */
  const [placing, setPlacing] = useState(false);  /* the placement offer */
  const [placed, setPlaced] = useState(null);     /* its result */
  const [streakCard, setStreakCard] = useState(null);
  const [nudge, setNudge] = useState(null);      /* "you are ahead" / "behind" / "this has gone quiet" */
  const [lexicon, setLexicon] = useState(null);  /* word -> the unit it first appears in */
  const [restore, setRestore] = useState(null);   /* progress arriving from a link */
  const [pulled, setPulled] = useState(null);     /* progress arriving from the gist */
  const [connected, setConnected] = useState(isConnected());

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
    /* pictures and the lexicon are extras: without them a lesson still runs,
       with word cards instead of picture cards, so a failed fetch is not news */
    fetchImages().then(setImages).catch(() => {});
    fetchLexicon().then(setLexicon).catch(() => {});

    const offCloud = onCloudChange(() => setConnected(isConnected()));

    return () => { window.removeEventListener("hashchange", takeHash); offCloud(); stop(); };
  }, []);

  useEffect(() => { setSoundEnabled(duo.settings.sound); }, [duo.settings.sound]);

  /* the bar or the rail beside the path asking for one of its screens */
  useEffect(() => { if (jump?.n && jump.to) setTab(jump.to); }, [jump]);

  /* Sync on open, on focus, on leaving, and on a slow timer — restarted when a
     token is added, so connecting takes effect without a reload. */
  useEffect(() => {
    if (!connected) return undefined;
    return startAutoSync({ onPulled: (r) => setPulled(r.summary || null) });
  }, [connected]);

  const vars = duoVars(C, UI_FONT, HEB_FONT);

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
        /* which lesson of the unit this is. A node is one lesson deep now, so
           the node carries its own number — and it runs on across a split unit,
           so p2 teaches the words p1 has not already introduced. */
        lessonIndex: node?.lesson || 0,
        known, settings: duo.settings,
        /* only the mistakes from units the learner has got to; the rest wait
           for the path to catch up with them */
        mistakes: mistakesUpTo(duo, unitDef.unit), dueWords: dueWords(duo),
        /* what the sentence weighing reads: how well each sentence is known
           and which of them have come round again */
        sentLevels: duo.sents,
        /* and what tells "taught but never answered about" from "never taught":
           a learner who tested out of forty units has met their vocabulary
           whether or not this device ever saw them answer about it */
        reached: reachedUnit(duo, course?.units || []),
        lexicon,
        voice: hasHebrewVoice(), images,
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
    /* Built on the furthest unit that has been started, not the one the path
       is pointing at. Finishing unit 5 points the path at unit 6 before a
       single lesson of it has been opened, and practice built on unit 6 was
       teaching its words and asking about its sentences ahead of the lessons
       that are meant to. */
    const at = practiceUnit(duo, course.units);
    const unitDef = course.units.find((u) => u.unit === at) || course.units[0];
    launch({ unitDef, nodeIndex: null, kind: id, advance: false, title: {
      mistakes: "Mistakes", personalized: "Personalised practice",
      listening: "Listen up", speaking: "Speak up", roots: "Word families",
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
  /* `recheck` is the same test run by somebody already on the path, who wants to
     know whether it still fits. It starts from the rung nearest where they are
     rather than from the alphabet, which saves the fifteen questions it would
     take to climb back to themselves. Starting above their real level costs
     nothing now that a failed rung narrows downwards instead of ending the
     test. And it can only ever open units, never close them, so a bad morning
     cannot undo work already done. */
  const startPlacement = async (recheck = false) => {
    setPlacing(false);
    setBusy(true);
    const at = recheck
      ? Math.max(0, PLACEMENT_LADDER.findIndex((u) => u >= reachedUnit(duo, course.units)))
      : 0;
    /* `unit` is the rung being asked about and `hi` the lowest unit known to be
       too hard; together they let the ladder become a search once something
       beats them, instead of stopping at the last rung they cleared. */
    const rung = { at, reached: 0, seen: 0, right: 0, hi: null, unit: PLACEMENT_LADDER[at], recheck };
    const questionsFor = async (unit) => {
      const docs = await fetchUnitWindow(unit, 1);
      return buildSession({
        unit, docs, kind: "placement", lessonIndex: rung.at,
        known, settings: { ...duo.settings, speaking: false },
        voice: hasHebrewVoice(),
      }).map((ex, i) => ({ ...ex, key: `place-${unit}-${i}` }));
    };

    try {
      const first = await questionsFor(rung.unit);
      if (!first.length) { setErr("couldn't build a placement test"); return; }
      setSession({
        items: first,
        meta: {
          unit: rung.unit, node: null, kind: "placement", advance: false,
          xp: 0, title: recheck ? "Level check" : "Placement test", placement: true, recheck, noRequeue: true,
          firstToday: duo.lastLesson !== dayKey(),
          /* called when the rung's questions are done */
          more: async ({ correct, answered }) => {
            const step = placementStep(rung, correct - rung.right, answered - rung.seen);
            rung.right = correct;
            rung.seen = answered;
            rung.reached = step.reached;
            if (step.done) return null;
            rung.at = step.at;
            rung.hi = step.hi;
            rung.unit = step.unit;
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

  /* Is the course moving at the right speed for the person taking it?

     Asked at the end of a unit rather than at the end of every lesson: that is
     roughly every five sessions, which is often enough to catch someone in the
     wrong place and rare enough not to be nagging. One offer at a time, in this
     order, because the order is the advice.

     Struggling comes first. Someone at 60% is not helped by being sent
     backwards or forwards; they are helped by the notes for the unit they are
     in. Then what has gone quiet, because the whole point of noticing that
     units decay is that jumping ahead on foundations that have gone is exactly
     how a learner ends up lost two sections later. Only then, with nothing
     behind them wanting attention, is going faster worth offering. */
  const paceOffer = (unit, s) => {
    const stale = staleUnits(s, course.units, Date.now(), 3);
    const pace = recentPace(s, course.units);
    const here = unitStrength(s, unit) ?? 1;
    const cardFor = (n) => course.units.find((u) => u.unit === n && u.part <= 1);

    if (pace && pace.accuracy <= 0.68) {
      const unitDef = cardFor(unit);
      /* 25 of the 108 cards have no Tips & Notes, and offering to open notes
         that do not exist is worse than not offering */
      const tips = course.units.some((u) => u.unit === unit && u.tips);
      return { kind: "behind", unit, unitDef, tips, accuracy: pace.accuracy, skill: unitDef?.skill };
    }
    if (stale.length) {
      const unitDef = cardFor(stale[0].unit);
      return { kind: "quiet", ...stale[0], unitDef, since: (s.units || {})[stale[0].unit]?.at || 0 };
    }
    if (pace && pace.accuracy >= 0.92 && pace.units >= 2 && here >= 0.8) {
      /* how far ahead to offer a test. Nothing dramatic: a jump that fails
         costs the time it took, and a jump that lands has to be one the
         learner can actually stand on. */
      const jump = pace.accuracy >= 0.97 ? 5 : pace.accuracy >= 0.95 ? 3 : 2;
      const last = course.units[course.units.length - 1].unit;
      const target = cardFor(Math.min(unit + jump, last));
      if (target && target.unit > unit) {
        return { kind: "ahead", unit: target.unit, from: unit + 1, unitDef: target, accuracy: pace.accuracy };
      }
    }
    return null;
  };

  const onSessionFinish = (result) => {
    const meta = session?.meta;
    setSession(null);
    /* the lesson-complete screen can hand the unit's text straight over */
    if (result?.story) setStory(result.story);
    /* whatever just happened is worth putting somewhere other than this device */
    syncSoon({ reason: "session" });
    if (!meta) return;
    if (meta.kind === "legendary" && meta.node != null) markLegendary(meta.unit, meta.node);
    if (meta.unlockTo) testOut(course.units.filter((u) => u.unit <= meta.unlockTo));
    if (meta.placement) {
      /* placed at the top of the highest rung answered — everything below it
         counts as known, and the path opens there */
      const reached = meta.onPlaced?.() || 0;
      const was = reachedUnit(duo, course.units);
      if (reached > 0) testOut(course.units.filter((u) => u.unit <= reached));
      setPlaced({ reached, was, recheck: !!meta.recheck });
      return;
    }
    if (meta.firstToday) { setStreakCard(true); return; }
    /* the state the store is in after this session, not the one it was in
       before — finishSession has already written by the time this runs */
    if (meta.advance && meta.unit != null && course) {
      const now = getDuo();
      const card = course.units.find((u) => u.unit === meta.unit && isLastCard(u));
      if (card && unitComplete(now, card)) setNudge(paceOffer(meta.unit, now));
    }
  };

  /* What is actually due to review, across both stores. */
  const practiceDue = (course ? dueWords(duo).length : 0) + (myWords?.due || 0);

  /* ---------------- render ---------------- */
  if (err && !course) {
    return (
      <main className="duo" style={vars}>
        <div className="d-card" style={{ marginTop: 24 }}>
          <div className="d-title">The course couldn't load</div>
          <div className="d-sub">
            {navigator.onLine === false ? "You're offline, and the course isn't cached on this device yet." : "Check your connection and try again."}
            {import.meta.env.DEV && <> ({err} — run <code>npm run build:duo</code>.)</>}
          </div>
          <button className="d-btn blue small" style={{ marginTop: 14 }} onClick={() => window.location.reload()}>Try again</button>
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

  /* The feed sits where the passages sit — a full screen over the tab bar,
     because reading is not something to do in a panel beside a tree. What
     comes out of it is an ordinary session: the drill built from paragraphs
     somebody has just read is played, graded and scheduled by the same
     machinery as a lesson, rather than by a second copy of it. */
  if (reading && !session) {
    return (
      <div className="duo" style={vars}>
        <Article
          unit={reachedUnit(duo, course.units || [])}
          onClose={() => setReading(false)}
          onDrill={(items, starred) => {
            /* filed under the unit practice is built on, so a mistake made
               here is not held back until the path's next unit is started */
            const at = practiceUnit(duo, course.units);
            const drill = buildFeedDrill({
              items, starred, lexicon: lexicon || {},
              reached: reachedUnit(duo, course.units || []),
              rand: rng(hash(`feed-drill:${items.map((i) => i.src).join("|")}`)),
              voice: hasHebrewVoice(),
            });
            if (!drill.length) { setErr("there was not enough in those paragraphs to build a drill"); return; }
            warmAudio();
            prefetchVoices(drill.filter((i) => i.type === "listen").map((i) => i.text));
            setSession({
              items: drill,
              meta: {
                unit: at, node: null, kind: "practice", advance: false,
                xp: XP_FOR.practice ?? 10,
                title: "What you just read",
                firstToday: duo.lastLesson !== dayKey(),
              },
            });
          }}
        />
      </div>
    );
  }

  if (story && passageFor(story)) {
    return (
      <div className="duo" style={vars}>
        <Passage
          passage={passageFor(story)}
          unit={story}
          onClose={() => setStory(null)}
          onDone={() => setStory(null)}
        />
      </div>
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
          sents={myWords?.sents}
          onToggleSent={myWords?.onToggleSent}
          word={myWords?.word}
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
      {/* Reviews that have come due, from both stores — the words the lessons
          taught and the ones starred while reading. It sits on Practice
          because that is where the reviewing is done; on the app's own tab bar
          it was a number beside the word Path, which told you a count without
          telling you where to go with it. Mistakes are deliberately not in it:
          they do not expire, so counting them would leave the badge lit for
          ever, and a badge that is always on is not a notification. */}
      <div className="d-tabs">
        {[
          ["learn", Route, "Learn"],
          ["practice", Dumbbell, "Practice"],
          ["profile", User, "You"],
        ].map(([id, Icon, label]) => (
          <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            <Icon size={17} />{label}
            {id === "practice" && practiceDue > 0 && (
              <span className="d-tab-badge" aria-label={`${practiceDue} due for review`}>
                {practiceDue > 99 ? "99+" : practiceDue}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* the dumbbell that floats over the tree — the tab bar scrolls away
          with the top of the page, and the path is longer than a screen */}
      {/* A tab that throws should cost that tab, not the app: the bar stays, and
          switching to another one clears the error and tries again. */}
      <Boundary at={tab}>
      {tab === "learn" && (
        <button
          className="d-practice-fab"
          onClick={() => setTab("practice")}
          aria-label={practiceDue > 0 ? `Practice — ${practiceDue} due for review` : "Practice"}
          title="Practice"
        >
          <Dumbbell size={26} strokeWidth={2.4} />
          {practiceDue > 0 && (
            <span className="d-tab-badge">{practiceDue > 99 ? "99+" : practiceDue}</span>
          )}
        </button>
      )}

      {err && (
        <div className="d-err" role="alert">
          <span>{err}</span>
          <button className="d-btn ghost small" onClick={() => setErr("")}>Dismiss</button>
        </div>
      )}

      {tab === "learn" && (
        <Path
          course={course}
          busy={busy}
          onStart={onStartNode}
          onGuidebook={setGuide}
          onTest={setTesting}
          onCheckpoint={startCheckpointTest}
          onPlacement={() => setPlacing(true)}
          onPassage={duo.settings.passages === false ? null : (u) => setStory(u.unit)}
        />
      )}
      {tab === "practice" && (
        <PracticeHub
          course={course} onPractice={onPracticeKind} myWords={myWords} onPassage={setStory}
          onFeed={() => setReading(true)}
          /* a unit behind them that has gone quiet, so it can be reached without
             scrolling the path back to find it */
          onRecheck={() => setPlacing("recheck")}
          onRefresh={(unit) => {
            const unitDef = course.units.find((u) => u.unit === unit);
            if (unitDef) launch({ unitDef, nodeIndex: null, kind: "practice", advance: false, title: `Unit ${unit} refresher` });
          }}
        />
      )}
      {tab === "profile" && <Profile course={course} onReset={() => setTab("learn")} />}
      </Boundary>

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

      {nudge && (
        <Sheet onClose={() => setNudge(null)}>
          {nudge.kind === "ahead" && (
            <>
              <div className="d-center">
                <Zap size={44} color="var(--d-gold)" />
                <div className="d-title" style={{ fontSize: 22 }}>Skip ahead to unit {nudge.unit}?</div>
                <div className="d-sub" style={{ marginBottom: 16 }}>
                  You have been getting {Math.round(nudge.accuracy * 100)}% of questions right on
                  the first try over the last few units, so the next few are probably going to be
                  easy for you. If you pass one test of twenty exercises, {nudge.unit - nudge.from === 1
                    ? `units ${nudge.from} and ${nudge.unit}`
                    : `units ${nudge.from} to ${nudge.unit}`} all open at
                  once and you earn {XP_FOR.test} XP. Three mistakes ends the test, and if you do
                  not pass, nothing changes.
                </div>
              </div>
              <button className="d-btn gold" onClick={() => { setNudge(null); startUnitTest(nudge.unitDef); }}>
                <KeyRound size={16} /> Start the test
              </button>
            </>
          )}
          {nudge.kind === "quiet" && (
            <>
              <div className="d-center">
                <History size={44} color="var(--d-purple)" />
                <div className="d-title" style={{ fontSize: 22 }}>Review unit {nudge.unit}?</div>
                <div className="d-sub" style={{ marginBottom: 16 }}>
                  You last practised {nudge.skill} {sinceLabel(nudge.since)}, so you have probably
                  forgotten some of it. This is twelve exercises taken from that unit, and it is
                  worth {XP_FOR.practice} XP. Your progress on the path stays exactly as it is
                  either way.
                </div>
              </div>
              <button className="d-btn" onClick={() => {
                setNudge(null);
                launch({ unitDef: nudge.unitDef, nodeIndex: null, kind: "practice", advance: false, title: `Unit ${nudge.unit} review` });
              }}>
                <History size={16} /> Review it
              </button>
            </>
          )}
          {nudge.kind === "behind" && (
            <>
              <div className="d-center">
                <BookOpen size={44} color="var(--d-blue)" />
                <div className="d-title" style={{ fontSize: 22 }}>Go over unit {nudge.unit} again?</div>
                <div className="d-sub" style={{ marginBottom: 16 }}>
                  You got {Math.round(nudge.accuracy * 100)}% of questions right on the first try
                  {nudge.skill ? ` in ${nudge.skill}` : ""}.
                  {nudge.tips
                    ? ` The Tips & notes for that unit explain the grammar it is teaching, which is
                        usually quicker than sitting another lesson. You can also practise the unit
                        again, which is twelve exercises and worth ${XP_FOR.practice} XP.`
                    : ` Practising it again is twelve exercises, and it is worth ${XP_FOR.practice} XP.`}
                </div>
              </div>
              {nudge.tips && (
                <button className="d-btn blue" onClick={() => { setNudge(null); setGuide(nudge.unitDef); }}>
                  <BookOpen size={16} /> Read the notes
                </button>
              )}
              <button className={nudge.tips ? "d-btn ghost" : "d-btn blue"} style={{ marginTop: nudge.tips ? 10 : 0 }}
                onClick={() => {
                  setNudge(null);
                  launch({ unitDef: nudge.unitDef, nodeIndex: null, kind: "practice", advance: false, title: `Unit ${nudge.unit} practice` });
                }}>
                Practise the unit
              </button>
            </>
          )}
          <button className="d-btn ghost" style={{ marginTop: 10 }} onClick={() => setNudge(null)}>
            {nudge.kind === "ahead" ? "Carry on from here" : "Not now"}
          </button>
        </Sheet>
      )}

      {testing && (
        <Sheet onClose={() => setTesting(null)}>
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
        </Sheet>
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
        <Sheet onClose={() => setRestore(null)}>
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
        </Sheet>
      )}

      {placing && (
        <Sheet onClose={() => setPlacing(false)}>
          <div className="d-center">
            <Gauge size={44} color="var(--d-blue)" />
            <div className="d-title" style={{ fontSize: 22 }}>
              {placing === "recheck" ? "Are you in the right place?" : "How much Hebrew do you know?"}
            </div>
            <div className="d-sub" style={{ marginBottom: 16 }}>
              {placing === "recheck"
                ? "This asks three questions at a time from around where you are now, and moves up or down depending on how they go. It takes about twenty questions, or four minutes. If it finds you further along than the path thinks, everything up to there opens. If it does not, nothing you have already done is taken away."
                : "This asks three questions at a time and gets harder while you keep passing. When a set beats you it narrows in on the level you are actually at rather than stopping there, so it usually takes about twenty questions, or four minutes. Whatever you clear is unlocked and the path starts from there, and you can always go back down it."}
            </div>
          </div>
          <button className="d-btn blue" disabled={busy} onClick={() => startPlacement(placing === "recheck")}>
            {busy ? <Loader size={16} className="spin" /> : placing === "recheck" ? "Check my level" : "Start the placement test"}
          </button>
          <button className="d-btn ghost" style={{ marginTop: 10 }} onClick={() => setPlacing(false)}>
            {placing === "recheck" ? "Not now" : "I'll start from the beginning"}
          </button>
        </Sheet>
      )}

      {placed != null && (
        <Sheet onClose={() => setPlaced(null)} className="d-center">
          <Gauge size={56} color="var(--d-blue)" className="d-grow" />
          {placed.recheck && placed.reached <= placed.was ? (
            <>
              <div className="d-title" style={{ fontSize: 24 }}>You are in the right place</div>
              <div className="d-sub">
                The test did not find anything past unit {placed.was} that you already know, so
                the path stays exactly where it was. Nothing you had done has been taken away.
              </div>
            </>
          ) : placed.recheck ? (
            <>
              <div className="d-title" style={{ fontSize: 26 }}>You are further on than the path thought</div>
              <div className="d-sub">
                Units {placed.was + 1} to {placed.reached} are open now, which is{" "}
                {placed.reached - placed.was} more than before. Everything behind you is still
                there to practise whenever you want it.
              </div>
            </>
          ) : placed.reached > 0 ? (
            <>
              <div className="d-title" style={{ fontSize: 26 }}>You start at unit {placed.reached + 1}</div>
              <div className="d-sub">
                That is {placed.reached} unit{placed.reached === 1 ? "" : "s"} unlocked, or{" "}
                {course.units.filter((u) => u.unit <= placed.reached).reduce((a, u) => a + u.nodes.length, 0)}{" "}
                nodes of the path, already counted as done. Everything behind you is still there
                to practise.
              </div>
            </>
          ) : (
            <>
              <div className="d-title" style={{ fontSize: 24 }}>Starting at the beginning</div>
              <div className="d-sub">Unit 1 teaches the alphabet, which is the right place to start.</div>
            </>
          )}
          <button className="d-btn" style={{ marginTop: 20 }} onClick={() => setPlaced(null)}>
            {placed.recheck && placed.reached <= placed.was ? "Carry on" : "Take me there"}
          </button>
        </Sheet>
      )}

      {chest != null && (
        <Sheet onClose={() => setChest(null)} className="d-center">
          <ChestArt size={88} className="d-grow" />
          <div className="d-title" style={{ fontSize: 24 }}>You opened a chest!</div>
          <div className="d-stat" style={{ justifyContent: "center", fontSize: 26, color: "var(--d-gold)" }}><Zap size={26} /> +{chest} XP</div>
          <button className="d-btn" style={{ marginTop: 20 }} onClick={() => setChest(null)}>Collect</button>
        </Sheet>
      )}

      {streakCard && (
        <Sheet onClose={() => setStreakCard(null)} className="d-center">
          <Flame size={72} color="var(--d-orange)" fill="var(--d-orange)" className="d-grow" />
          <div className="d-title" style={{ fontSize: 30, color: "var(--d-orange)" }}>{duo.streak} day streak!</div>
          <div className="d-sub">
            {today >= duo.goal ? "Daily goal met." : `${duo.goal - today} XP left of today's goal.`}
          </div>
          <button className="d-btn" style={{ marginTop: 20 }} onClick={() => setStreakCard(null)}>Continue</button>
        </Sheet>
      )}
    </main>
  );
}
