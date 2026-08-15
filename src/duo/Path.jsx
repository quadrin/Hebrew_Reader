/* The path.

   Four sections, eighty-four units, five hundred and twenty-eight nodes, in the
   order Duolingo publishes them. A node is a circle with a progress ring; it is
   locked until everything above it is done, it holds several lessons, and when
   the last one is finished it turns gold. One section is on screen at a time —
   rendering all 528 at once is a lot of DOM for a screen you scroll through
   linearly. */

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Star, Dumbbell, Gift, Trophy, Lock, Check, BookOpen, ChevronDown, Crown, Loader,
} from "lucide-react";

import { useDuo, nodeStatus, currentPosition } from "./state.js";
import { sfx } from "./audio.js";

const UNIT_COLORS = [
  { c: "#58cc02", d: "#4aa802" },   /* green  */
  { c: "#1cb0f6", d: "#1899d6" },   /* blue   */
  { c: "#ce82ff", d: "#a568cc" },   /* purple */
  { c: "#ff9600", d: "#e08600" },   /* orange */
  { c: "#ff4b4b", d: "#ea2b2b" },   /* red    */
  { c: "#00cd9c", d: "#00a87f" },   /* teal   */
];

const NODE_ICON = { skill: Star, practice: Dumbbell, chest: Gift, unit_review: Trophy };
const NODE_LABEL = {
  skill: "Lesson", practice: "Practice", chest: "Treasure chest", unit_review: "Unit review",
};

/* The serpentine. Duolingo's path swings left and right on a slow sine; the
   phase resets each unit so every unit starts under its own header. */
const offsetFor = (i) => Math.round(Math.sin(i * 0.9) * 62);

function Ring({ fraction, size = 82, color }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="d-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--d-mute)" strokeWidth="7" />
      {fraction > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={`${c * fraction} ${c}`}
        />
      )}
    </svg>
  );
}

export default function Path({ course, onStart, onGuidebook, busy }) {
  const duo = useDuo();
  const units = course.units;
  const here = useMemo(() => currentPosition(duo, units), [duo.lessons, duo.legendary, units]);
  const [section, setSection] = useState(() => units.find((u) => u.unit === here.unit)?.section || 1);
  const [picker, setPicker] = useState(false);
  const [open, setOpen] = useState(null);         /* {unit, node} of the open popup */
  const currentRef = useRef(null);
  const [pinned, setPinned] = useState(false);

  /* Follow the player when they move to a new section, but never fight a
     deliberate scroll back into an earlier one. */
  useEffect(() => {
    const s = units.find((u) => u.unit === here.unit)?.section;
    if (s && !pinned) setSection(s);
  }, [here.unit]);

  useEffect(() => {
    if (currentRef.current && section === units.find((u) => u.unit === here.unit)?.section) {
      currentRef.current.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, [section]);

  const sectionDef = course.sections.find((s) => s.n === section) || course.sections[0];
  const sectionUnits = units.filter((u) => u.section === section);
  const color = (u) => UNIT_COLORS[(u.unit - 1) % UNIT_COLORS.length];

  /* A node is open if everything before it on the path is finished. */
  const isUnlocked = (unitDef, i) => {
    if (unitDef.unit < here.unit) return true;
    if (unitDef.unit > here.unit) return false;
    return i <= here.node;
  };

  const nodeTitle = (unitDef, node, i) => {
    if (node.type === "skill") return `${unitDef.short || unitDef.skill}`;
    return NODE_LABEL[node.type] || "Lesson";
  };

  return (
    <div className="d-path">
      {/* section banner, with the section list behind it */}
      <div
        className="d-section-head"
        style={{ background: UNIT_COLORS[(section - 1) % UNIT_COLORS.length].c, boxShadow: `0 4px 0 ${UNIT_COLORS[(section - 1) % UNIT_COLORS.length].d}` }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".8px", opacity: .9 }}>
            SECTION {sectionDef.n} · {sectionDef.cefr}
          </div>
          <div style={{ fontSize: 19, fontWeight: 800 }}>{sectionDef.name}</div>
          <div style={{ fontSize: 13, opacity: .92 }}>units {sectionDef.first}–{sectionDef.last}</div>
        </div>
        <button className="d-icon-btn" style={{ borderColor: "rgba(255,255,255,.6)", color: "#fff" }}
          onClick={() => setPicker((v) => !v)} aria-label="All sections">
          <ChevronDown size={20} />
        </button>
      </div>

      {picker && (
        <div className="d-card">
          {course.sections.map((s) => (
            <button key={s.n} className="d-row" style={{
              width: "100%", background: "transparent", border: "none", cursor: "pointer",
              padding: "10px 2px", color: "var(--d-ink)", textAlign: "left",
            }} onClick={() => { setSection(s.n); setPinned(true); setPicker(false); }}>
              <span style={{
                width: 34, height: 34, borderRadius: 10, background: UNIT_COLORS[(s.n - 1) % UNIT_COLORS.length].c,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800,
              }}>{s.n}</span>
              <span style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, display: "block" }}>{s.name}</span>
                <span className="d-sub">{s.units} units · {s.cefr}</span>
              </span>
              {s.n === section && <Check size={18} color="var(--d-green)" />}
            </button>
          ))}
        </div>
      )}

      {sectionUnits.map((u) => {
        const col = color(u);
        const complete = u.nodes.every((_, i) => nodeStatus(duo, u, i).complete);
        return (
          <div key={u.unit}>
            <div className="d-unit-head" style={{ background: col.c, boxShadow: `0 4px 0 ${col.d}` }}>
              <div style={{ flex: 1 }}>
                <h3>Unit {u.unit}{complete && " ✓"}</h3>
                <p>{u.objective || u.skill}</p>
              </div>
              <button
                className="d-icon-btn"
                style={{ borderColor: "rgba(255,255,255,.65)", color: "#fff" }}
                onClick={() => onGuidebook(u)}
                aria-label="Guidebook"
                title="Guidebook"
              >
                <BookOpen size={19} />
              </button>
            </div>

            {u.nodes.map((node, i) => {
              const st = nodeStatus(duo, u, i);
              const unlocked = isUnlocked(u, i);
              const isCurrent = u.unit === here.unit && i === here.node;
              const Icon = st.legendary ? Crown : NODE_ICON[node.type] || Star;
              const filled = st.complete || unlocked;
              const nodeCol = st.legendary
                ? { c: "#ffc800", d: "#e6a500" }
                : node.type === "chest" ? { c: "#ffc800", d: "#e6a500" }
                : node.type === "unit_review" ? { c: "#ff9600", d: "#e08600" }
                : col;
              const openHere = open && open.unit === u.unit && open.node === i;

              return (
                /* the transform makes each row its own stacking context, so an
                   open popup has to lift its own row above the rows below it */
                <div className="d-node-wrap" key={i} style={{ transform: `translateX(${offsetFor(i)}px)`, zIndex: openHere ? 9 : 1 }}>
                  <div style={{ position: "relative" }} ref={isCurrent ? currentRef : null}>
                    {isCurrent && !openHere && (
                      <div className="d-start-bubble">{st.done === 0 ? (u.unit === 1 && i === 0 ? "START" : "START") : "CONTINUE"}</div>
                    )}
                    <button
                      className={`d-node ${filled ? "" : "locked"} ${isCurrent ? "current" : ""}`}
                      style={filled ? { "--d-node": nodeCol.c, "--d-node-dark": nodeCol.d } : undefined}
                      onClick={() => { sfx("tap"); setOpen(openHere ? null : { unit: u.unit, node: i }); }}
                      aria-label={`${nodeTitle(u, node, i)}, ${st.done} of ${st.total} done`}
                    >
                      {st.complete ? <Check size={28} strokeWidth={3.5} /> : filled ? <Icon size={26} /> : <Lock size={22} />}
                    </button>
                    {(st.fraction > 0 && !st.complete) && (
                      <Ring fraction={st.fraction} color={nodeCol.c} />
                    )}
                  </div>

                  {openHere && (
                    <div
                      className="d-pop"
                      style={{
                        top: 78, background: unlocked ? nodeCol.c : "var(--d-mute)",
                        color: unlocked ? "#fff" : "var(--d-sub)",
                        borderBottomColor: unlocked ? nodeCol.c : "var(--d-mute)",
                        transform: `translateX(calc(-50% - ${offsetFor(i)}px))`,
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 17 }}>{nodeTitle(u, node, i)}</div>
                      <div style={{ fontSize: 13, opacity: .92, marginTop: 2 }}>
                        {unlocked
                          ? node.type === "chest" ? "Open it for a reward"
                            : node.type === "unit_review" ? `Everything from unit ${u.unit}`
                            : `Lesson ${Math.min(st.done + 1, st.total)} of ${st.total}`
                          : "Complete all the levels above to unlock this"}
                      </div>
                      {unlocked && (
                        <button
                          className="d-btn"
                          style={{ marginTop: 12, background: "#fff", color: nodeCol.c, boxShadow: "0 4px 0 rgba(0,0,0,.15)" }}
                          disabled={busy}
                          onClick={() => { setOpen(null); onStart(u, i, node, st); }}
                        >
                          {busy ? <Loader size={16} className="spin" /> :
                            st.complete
                              ? (st.legendary ? "Practice +5 XP" : node.type === "skill" ? "Legendary +40 XP" : "Practice +5 XP")
                              : node.type === "chest" ? "Open" : "Start +10 XP"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* the trophy that closes a section */}
      <div className="d-center" style={{ paddingTop: 18 }}>
        <div className="d-trophy" style={{
          background: sectionUnits.every((u) => u.nodes.every((_, i) => nodeStatus(duo, u, i).complete)) ? "var(--d-gold)" : "var(--d-mute)",
          boxShadow: "none",
        }}>
          <Trophy size={40} />
        </div>
        <div className="d-sub">
          {sectionDef.name} · section {sectionDef.n} of {course.sections.length}
        </div>
        {section < course.sections.length && (
          <button className="d-btn ghost small" style={{ marginTop: 12 }}
            onClick={() => { setSection(section + 1); setPinned(true); window.scrollTo({ top: 0 }); }}>
            Next section
          </button>
        )}
      </div>
    </div>
  );
}
