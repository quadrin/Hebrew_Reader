/* Everything that is not the path or a lesson: the practice hub, the league,
   the day's quests, the gem shop and the profile.

   The league is the one thing here that cannot be honest — there is no server
   and no other players — so it is simulated: twenty-nine learners with their
   own rates, seeded from the week, climbing through the week the way a real
   cohort would, with promotion and demotion settled on Monday. */

import { useState } from "react";
import {
  Flame, Gem, Heart, Zap, Shield, Trophy, Target, Crown, BookOpen, Brain,
  Volume2, Mic, Check, Sparkles, Crosshair, RotateCcw, ChevronRight, Star,
} from "lucide-react";

import {
  useDuo, LEAGUES, GOALS, leagueStandings, achievements, totals, dueWords,
  refillHearts, buyFreeze, buyBoost, claimQuest, setSetting, setGoal, resetDuo,
  MAX_HEARTS, HEART_REFILL_COST, FREEZE_COST, XP_BOOST_COST, dayKey,
} from "./state.js";
import { sfx, playPhrase } from "./audio.js";

const ICONS = { flame: Flame, sparkles: Sparkles, book: BookOpen, crown: Crown, trophy: Trophy, target: Target, brain: Brain, crosshair: Crosshair };

function Bar({ value, max, color = "var(--d-green)" }) {
  return (
    <div style={{ height: 12, borderRadius: 999, background: "var(--d-mute)", overflow: "hidden", marginTop: 6 }}>
      <div style={{ height: "100%", width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, background: color, transition: "width .4s" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function PracticeHub({ course, onPractice }) {
  const duo = useDuo();
  const due = dueWords(duo);
  const words = Object.entries(duo.words).sort((a, b) => (a[1].due || 0) - (b[1].due || 0));
  const [showWords, setShowWords] = useState(false);

  const items = [
    { id: "mistakes", icon: RotateCcw, color: "var(--d-red)", title: "Mistakes", blurb: duo.mistakes.length ? `${duo.mistakes.length} to put right` : "Nothing wrong yet — well done", disabled: !duo.mistakes.length },
    { id: "personalized", icon: Brain, color: "var(--d-purple)", title: "Personalised practice", blurb: due.length ? `${due.length} words are due` : "Built from what you have met", disabled: !words.length },
    { id: "listening", icon: Volume2, color: "var(--d-blue)", title: "Listen up", blurb: "Ten listening exercises", disabled: false },
    { id: "speaking", icon: Mic, color: "var(--d-orange)", title: "Speak up", blurb: "Say it out loud", disabled: false },
  ];

  return (
    <div>
      <div className="d-title">Practice</div>
      {items.map((it) => (
        <button key={it.id} className="d-card d-row" disabled={it.disabled}
          style={{ width: "100%", textAlign: "left", cursor: it.disabled ? "default" : "pointer", opacity: it.disabled ? .55 : 1 }}
          onClick={() => onPractice(it.id)}>
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

      <div className="d-title">Words you have met</div>
      <div className="d-card">
        <div className="d-row">
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 24 }}>{words.length}</div>
            <div className="d-sub">{due.length} due for review</div>
          </div>
          <button className="d-btn ghost small" onClick={() => setShowWords((v) => !v)}>
            {showWords ? "Hide" : "Show all"}
          </button>
        </div>
        {showWords && (
          <div style={{ marginTop: 12, maxHeight: 380, overflowY: "auto" }}>
            {words.map(([he, w]) => (
              <div className="d-row" key={he} style={{ padding: "7px 0", borderTop: "1px solid var(--d-line)" }}>
                <button className="d-icon-btn" style={{ width: 32, height: 32 }} onClick={() => playPhrase(he, "")} aria-label="Play">
                  <Volume2 size={14} />
                </button>
                <span className="d-prompt-he" dir="rtl" style={{ fontSize: 20, flex: 1 }}>{he}</span>
                <span className="d-sub" style={{ flex: 1, textAlign: "end" }}>{w.en}</span>
                <span className="d-pill" style={{ marginInlineStart: 8 }}>{"★".repeat(Math.max(1, w.level))}</span>
              </div>
            ))}
            {!words.length && <div className="d-sub">Finish a lesson and the words will collect here.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function Leagues() {
  const duo = useDuo();
  const league = LEAGUES[duo.league.tier];
  const standings = leagueStandings(duo);
  const days = Math.max(0, 7 - Math.floor((Date.now() - new Date(duo.league.week + "T00:00:00").getTime()) / 86400000));

  return (
    <div>
      <div className="d-center" style={{ padding: "18px 0 8px" }}>
        <div style={{
          width: 92, height: 92, margin: "0 auto", borderRadius: 26, background: league.color,
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
        }}>
          <Trophy size={44} />
        </div>
        <div className="d-title" style={{ fontSize: 24, marginBottom: 2 }}>{league.name} League</div>
        <div className="d-sub">Top 7 move up · bottom 5 move down · {days} day{days === 1 ? "" : "s"} left</div>
      </div>

      <div className="d-card" style={{ padding: 6 }}>
        {standings.map((r, i) => {
          const zone = i < 7 ? "up" : i >= standings.length - 5 ? "down" : "";
          return (
            <div key={r.name + i} className="d-row" style={{
              padding: "9px 10px", borderRadius: 12,
              background: r.you ? "color-mix(in srgb, var(--d-green) 14%, transparent)" : "transparent",
              borderTop: i === 7 ? "2px dashed var(--d-green)" : i === standings.length - 5 ? "2px dashed var(--d-red)" : "none",
            }}>
              <span style={{
                width: 26, textAlign: "center", fontWeight: 800,
                color: i < 3 ? "var(--d-gold)" : zone === "down" ? "var(--d-red)" : "var(--d-sub)",
              }}>{i + 1}</span>
              <span style={{
                width: 32, height: 32, borderRadius: "50%", background: r.you ? "var(--d-green)" : "var(--d-mute)",
                color: r.you ? "#fff" : "var(--d-sub)", display: "flex", alignItems: "center",
                justifyContent: "center", fontWeight: 800, fontSize: 13,
              }}>{r.name.slice(0, 1)}</span>
              <span style={{ flex: 1, fontWeight: r.you ? 800 : 600 }}>{r.name}</span>
              <span className="d-sub" style={{ fontWeight: 700 }}>{r.xp} XP</span>
            </div>
          );
        })}
      </div>
      <div className="d-sub" style={{ marginTop: 10 }}>
        Your best week so far: {duo.league.best} XP{duo.league.top3 ? ` · ${duo.league.top3} top-three finish${duo.league.top3 > 1 ? "es" : ""}` : ""}.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function Quests() {
  const duo = useDuo();
  const today = duo.days[dayKey()] || 0;
  const goalPct = Math.min(100, Math.round((today / duo.goal) * 100));

  return (
    <div>
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

      <div className="d-title">Daily quests</div>
      {duo.quests.items.map((q) => {
        const done = q.n >= q.goal;
        return (
          <div className="d-card" key={q.id}>
            <div className="d-row">
              <span style={{
                width: 40, height: 40, borderRadius: 12, background: done ? "var(--d-gold)" : "var(--d-mute)",
                color: done ? "#fff" : "var(--d-sub)", display: "flex", alignItems: "center", justifyContent: "center",
              }}><Target size={20} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{q.label}</div>
                <Bar value={Math.min(q.n, q.goal)} max={q.goal} color={done ? "var(--d-gold)" : "var(--d-green)"} />
                <div className="d-sub" style={{ marginTop: 4 }}>{Math.min(q.n, q.goal)} / {q.goal}</div>
              </div>
              {q.claimed
                ? <Check size={22} color="var(--d-green)" />
                : <button className="d-btn gold small" disabled={!done} onClick={() => { claimQuest(q.id); sfx("gem"); }}>
                    <Gem size={14} /> {q.reward}
                  </button>}
            </div>
          </div>
        );
      })}
      <div className="d-sub">New quests arrive at midnight.</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function Shop() {
  const duo = useDuo();
  const [msg, setMsg] = useState("");
  const say = (t) => { setMsg(t); setTimeout(() => setMsg(""), 2200); };

  const items = [
    {
      id: "hearts", icon: Heart, color: "var(--d-red)", title: "Refill hearts",
      blurb: `You have ${duo.hearts} of ${MAX_HEARTS}`, cost: HEART_REFILL_COST,
      disabled: duo.hearts >= MAX_HEARTS || duo.gems < HEART_REFILL_COST,
      buy: () => (refillHearts() ? "Hearts refilled." : "Not enough gems."),
    },
    {
      id: "freeze", icon: Shield, color: "var(--d-blue)", title: "Streak freeze",
      blurb: `${duo.freezes} of 2 equipped — covers a missed day`, cost: FREEZE_COST,
      disabled: duo.freezes >= 2 || duo.gems < FREEZE_COST,
      buy: () => (buyFreeze() ? "Streak freeze equipped." : "Not enough gems."),
    },
    {
      id: "boost", icon: Zap, color: "var(--d-purple)", title: "XP boost",
      blurb: duo.boost > Date.now() ? `Active for ${Math.ceil((duo.boost - Date.now()) / 60000)} more minutes` : "Double XP for 15 minutes",
      cost: XP_BOOST_COST, disabled: duo.gems < XP_BOOST_COST,
      buy: () => (buyBoost() ? "Double XP for the next 15 minutes." : "Not enough gems."),
    },
  ];

  return (
    <div>
      <div className="d-row" style={{ marginTop: 14 }}>
        <div className="d-title" style={{ flex: 1, margin: 0 }}>Shop</div>
        <span className="d-stat gem"><Gem size={19} /> {duo.gems}</span>
      </div>
      <div className="d-sub" style={{ marginBottom: 12 }}>Gems come from quests, chests and the odd perfect lesson.</div>

      {items.map((it) => (
        <div className="d-card d-row" key={it.id}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: it.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <it.icon size={22} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800 }}>{it.title}</div>
            <div className="d-sub">{it.blurb}</div>
          </div>
          <button className="d-btn gold small" disabled={it.disabled} onClick={() => { const r = it.buy(); if (r) { sfx("gem"); say(r); } }}>
            <Gem size={14} /> {it.cost}
          </button>
        </div>
      ))}

      <div className="d-card d-row">
        <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--d-gold)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Heart size={22} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800 }}>Unlimited hearts</div>
          <div className="d-sub">Duolingo sells this one. Here it is a switch.</div>
        </div>
        <button
          className={`d-btn small ${duo.settings.unlimitedHearts ? "" : "ghost"}`}
          onClick={() => setSetting("unlimitedHearts", !duo.settings.unlimitedHearts)}
        >{duo.settings.unlimitedHearts ? "On" : "Off"}</button>
      </div>

      {msg && <div className="d-sub d-center" style={{ marginTop: 8, color: "var(--d-green)" }}>{msg}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function Profile({ course, onReset }) {
  const duo = useDuo();
  const t = totals(duo, course.units);
  const league = LEAGUES[duo.league.tier];
  const acc = duo.stats.answered ? Math.round((duo.stats.correct / duo.stats.answered) * 100) : 0;
  const [confirm, setConfirm] = useState(false);

  /* the last seven days, for the little streak calendar */
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    week.push({ key, letter: "SMTWTFS"[d.getDay()], xp: duo.days[key] || 0, frozen: duo.freezeUsed.includes(key) });
  }

  const stats = [
    { icon: Flame, color: "var(--d-orange)", v: duo.streak, k: "Day streak" },
    { icon: Zap, color: "var(--d-gold)", v: duo.xp, k: "Total XP" },
    { icon: Trophy, color: league.color, v: league.name, k: "Current league" },
    { icon: Crown, color: "var(--d-purple)", v: t.crowns, k: "Crowns" },
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
                {d.xp > 0 ? <Flame size={15} /> : d.frozen ? <Shield size={14} /> : ""}
              </div>
            </div>
          ))}
        </div>
        <div className="d-sub" style={{ marginTop: 10 }}>
          {duo.freezes > 0 ? `${duo.freezes} streak freeze${duo.freezes > 1 ? "s" : ""} equipped.` : "No streak freeze equipped — buy one in the shop."}
        </div>
      </div>

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

      <div className="d-title">Settings</div>
      <div className="d-card">
        {[
          ["sound", "Sound effects"],
          ["animations", "Animations"],
          ["listening", "Listening exercises"],
          ["speaking", "Speaking exercises"],
          ["keyboard", "Type answers in Hebrew"],
          ["unlimitedHearts", "Unlimited hearts"],
        ].map(([key, label]) => (
          <div className="d-row" key={key} style={{ padding: "9px 0", borderBottom: "1px solid var(--d-line)" }}>
            <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
            <button
              className={`d-btn small ${duo.settings[key] ? "" : "ghost"}`}
              onClick={() => setSetting(key, !duo.settings[key])}
            >{duo.settings[key] ? "On" : "Off"}</button>
          </div>
        ))}
        <div style={{ marginTop: 14 }}>
          {confirm ? (
            <>
              <div className="d-sub" style={{ marginBottom: 8 }}>This wipes every crown, the streak, the words and the gems.</div>
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
