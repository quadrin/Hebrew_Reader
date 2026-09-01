/* The tree.

   Eighty-four skills in the rows Duolingo stood them in — one, two or three
   across, centred, with a checkpoint bar between the blocks. A skill is a disc
   with its picture, a track around it that fills as its lessons go by, and its
   name underneath; it is grey until everything above it is done and gold once
   its last lesson is. The lessons themselves are the levels behind that one
   disc, which is where the tree kept them.

   One section is on screen at a time — rendering all eighty-four skills at once
   is a lot of DOM for a page you scroll through linearly. */

import { useState, useEffect, useMemo, useRef } from "react";
import { useLayer } from "../useDialog.js";
import {
  Trophy, Check, BookOpen, ChevronDown, Loader, KeyRound, Castle, Gauge,
  LocateFixed,
} from "lucide-react";

import {
  useDuo, nodeStatus, currentPosition, cardId, isLastCard, nodeAt,
  unitStrength, wordsByUnit, STALE_BELOW,
} from "./state.js";
import { sinceLabel } from "./Screens.jsx";
import { sfx } from "./audio.js";
import { passageFor } from "./passages.js";
import { unitName } from "./unitNames.js";
import { skillArt } from "./skillArt.js";

/* The tree's own five, not the path's brighter set */
const UNIT_COLORS = [
  { c: "#7eb530", d: "#699628" },   /* green  */
  { c: "#1caff6", d: "#1794d1" },   /* blue   */
  { c: "#9b5fca", d: "#814ea8" },   /* purple */
  { c: "#fa811b", d: "#d66c14" },   /* orange */
  { c: "#dd381d", d: "#b82c15" },   /* red    */
];

const GOLD = { c: "#fbb430", d: "#d99826" };

/* A skill and its name occupy this much width, so a popup's arrow knows how
   far off centre the skill it belongs to is sitting. */
const COL = 104;
const arrowFor = (k, n) => Math.round((k - (n - 1) / 2) * COL);

/* The tree drew a track around every skill and filled it in as you worked
   through the levels — grey until you start, gold as it fills. */
function Ring({ fraction, color = GOLD.c, size = 80 }) {
  const r = (size - 7) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="d-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--d-mute)" strokeWidth="6" />
      {fraction > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={`${c * fraction} ${c}`}
        />
      )}
    </svg>
  );
}

/* The four checkpoints of the legacy tree, kept because they are where
   Duolingo let you skip a dozen skills by passing one test. */
function Checkpoint({ cp, done, busy, onTest }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="d-card d-center" style={{
      marginTop: 26, borderColor: done ? "var(--d-gold)" : "var(--d-line)",
      borderWidth: 3, background: done ? "color-mix(in srgb, var(--d-gold) 12%, var(--d-card))" : "var(--d-card)",
    }}>
      <Castle size={34} color={done ? "var(--d-gold)" : "var(--d-sub)"} />
      <div style={{ fontWeight: 800, fontSize: 17, marginTop: 4 }}>Checkpoint {cp.n}</div>
      <div className="d-sub">units {cp.first}–{cp.last} · {cp.skills} skills</div>
      {done ? (
        <div className="d-pill" style={{ marginTop: 10, background: "var(--d-gold)", color: "var(--d-on-fill)" }}>
          <Check size={13} /> passed
        </div>
      ) : open ? (
        <div style={{ marginTop: 10 }}>
          <div className="d-sub" style={{ marginBottom: 10 }}>
            Twenty-five exercises drawn from all {cp.units} units. Three mistakes ends it.
            Pass and every unit up to {cp.last} opens at once.
          </div>
          <button className="d-btn gold" disabled={busy} onClick={() => onTest(cp)}>
            {busy ? <Loader size={16} className="spin" /> : <><KeyRound size={16} /> Start the test</>}
          </button>
          <button className="d-btn ghost" style={{ marginTop: 8 }} onClick={() => setOpen(false)}>Not now</button>
        </div>
      ) : (
        <button className="d-btn ghost small" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>
          <KeyRound size={14} /> Test out of this block
        </button>
      )}
    </div>
  );
}

export default function Path({ course, onStart, onGuidebook, onTest, onCheckpoint, onPlacement, onPassage, busy }) {
  const duo = useDuo();
  const units = course.units;
  const here = useMemo(() => currentPosition(duo, units), [duo.lessons, duo.legendary, units]);
  const [section, setSection] = useState(() => units.find((u) => u.unit === here.unit)?.section || 1);
  const [picker, setPicker] = useState(false);
  const [open, setOpen] = useState(null);         /* the card whose popup is open */
  /* A unit that teaches more than one card's worth is drawn as two cards, so
     "before this one" is a position in the path rather than a unit number. */
  const order = useMemo(() => new Map(units.map((u, i) => [cardId(u), i])), [units]);
  /* How well each finished unit is still held. One pass over the word map up
     front, because the alternative is one pass per disc and the path draws
     dozens of them. */
  const tally = useMemo(() => wordsByUnit(duo), [duo.words]);
  const faded = (u) => {
    const st = unitStrength(duo, u.unit, Date.now(), tally);
    return st != null && st < STALE_BELOW;
  };
  const currentRef = useRef(null);
  const [pinned, setPinned] = useState(false);
  useLayer(open != null, "skill", () => setOpen(null));

  /* Follow the player when they move to a new section, but never fight a
     deliberate scroll back into an earlier one. */
  useEffect(() => {
    const s = units.find((u) => u.unit === here.unit)?.section;
    if (s) { setSection(s); setPinned(false); }
  }, [here.unit]);

  /* Anything that opens on a tap has to close on one too. A locked skill's
     popup has nothing in it to press, so the only way out was to find the disc
     again underneath the card now covering it. So: everything closes it except
     a disc — which has its own handler, and so still opens the skill you meant
     — and the popup's own buttons. Escape closes it too, and the section list
     behaves the same way. */
  useEffect(() => {
    if (open == null && !picker) return;
    const away = (e) => {
      const t = e.target;
      if (!t?.closest?.(".d-node, .d-pop button")) setOpen(null);
      if (!t?.closest?.(".d-section-picker button, .d-section-head button")) setPicker(false);
    };
    const esc = (e) => { if (e.key === "Escape") { setOpen(null); setPicker(false); } };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", esc);
    };
  }, [open, picker]);

  /* Scroll to where the player is — but only far enough. `center` would drag
     the page down even when the node is already on screen, which on the first
     load of the app pushes the header off the top for no reason. */
  useEffect(() => {
    if (!currentRef.current) return;
    if (section !== units.find((u) => u.unit === here.unit)?.section) return;
    const box = currentRef.current.getBoundingClientRect();
    const visible = box.top >= 90 && box.bottom <= window.innerHeight - 20;
    if (!visible) currentRef.current.scrollIntoView({ block: "center", behavior: "auto" });
  }, [section]);

  const sectionDef = course.sections.find((s) => s.n === section) || course.sections[0];
  const hereSection = units.find((u) => u.unit === here.unit)?.section;
  const color = (u) => UNIT_COLORS[(u.unit - 1) % UNIT_COLORS.length];

  /* The rows of the tree. Every skill carries the row it stood in when the
     tree was scraped, and a row held one, two or three of them. */
  const treeRows = useMemo(() => {
    const rows = [];
    for (const u of units.filter((x) => x.section === section)) {
      const last = rows[rows.length - 1];
      if (last && last[0].row === u.row) last.push(u);
      else rows.push([u]);
    }
    return rows;
  }, [units, section]);

  /* A skill's own progress: its lessons are the levels behind the one circle
     the tree showed, so they count together. */
  const unitProgress = (unitDef) => {
    let done = 0, total = 0, next = -1;
    unitDef.nodes.forEach((node, i) => {
      const st = nodeStatus(duo, unitDef, i);
      done += Math.min(st.done, st.total);
      total += st.total;
      if (next < 0 && !st.complete) next = i;
    });
    const complete = next < 0;
    /* a finished skill still has somewhere to send you: its practice */
    if (complete) {
      const p = unitDef.nodes.findIndex((n) => n.type === "practice");
      next = p < 0 ? 0 : p;
    }
    return { done, total, next, complete, fraction: total ? done / total : 0 };
  };

  const checkpoints = course.checkpoints || [];
  const checkpointAt = (unit) => checkpoints.find((c) => c.last === unit) || null;
  const checkpointDone = (cp) =>
    units.filter((u) => u.unit >= cp.first && u.unit <= cp.last)
      .every((u) => u.nodes.every((_, i) => nodeStatus(duo, u, i).complete));

  /* Nobody who already speaks some Hebrew should have to tap through the
     alphabet to reach the part they do not know, so the offer sits at the top
     of the path until there is any progress at all to lose. */
  const untouched = !Object.keys(duo.lessons || {}).length;

  return (
    <div className="d-path">
      {untouched && (
        <div className="d-card d-row" style={{ marginTop: 14, borderColor: "var(--d-blue)", borderWidth: 2 }}>
          <span style={{
            width: 44, height: 44, borderRadius: 12, background: "var(--d-blue)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Gauge size={22} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Already know some Hebrew?</div>
            <div className="d-sub">Answer about twenty questions and the path will start where you actually are.</div>
          </div>
          <button className="d-btn blue small" onClick={onPlacement}>Start</button>
        </div>
      )}

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
        <button className="d-icon-btn" style={{ borderColor: "rgba(16,21,28,.35)", color: "var(--d-on-fill)" }}
          onClick={() => setPicker((v) => !v)} aria-label="All sections">
          <ChevronDown size={20} />
        </button>
      </div>

      {hereSection && section !== hereSection && (
        <div className="d-jump-here">
          <button className="d-btn blue small" onClick={() => { setSection(hereSection); setPinned(false); }}>
            <LocateFixed size={15} /> Back to unit {here.unit}
          </button>
        </div>
      )}

      {picker && (
        <div className="d-card d-section-picker">
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

      {treeRows.map((row, r) => {
        const openInRow = open != null && row.some((u) => cardId(u) === open);
        /* the START callout stands above its skill, so its row needs the room —
           as padding, since sibling margins would just collapse into each other */
        const hasCurrent = row.some((u) => cardId(u) === here.card);
        const last = row[row.length - 1];
        /* a checkpoint waits for the whole unit, so not after p1 of one */
        const cp = isLastCard(last) ? checkpointAt(last.unit) : null;
        return (
          <div key={r}>
            {/* the tree put its skills in short centred rows of one to three,
                in the order and grouping Duolingo laid them out in */}
            <div className="d-tree-row" style={{ zIndex: openInRow ? 9 : 1, paddingTop: hasCurrent ? 22 : undefined }}>
              {row.map((u, k) => {
                const col = color(u);
                const pr = unitProgress(u);
                /* anything up to where you are, and anything already started:
                   a card with a ring around it is not a locked card */
                const unlocked = (order.get(cardId(u)) ?? 0) <= (order.get(here.card) ?? 0) || pr.done > 0;
                const isCurrent = cardId(u) === here.card;
                const nodeCol = pr.complete ? GOLD : col;
                const openHere = open === cardId(u);
                /* a finished unit that has not been practised in a long time */
                const dull = pr.complete && faded(u);

                return (
                  <div className="d-node-col" key={cardId(u)} ref={isCurrent ? currentRef : null}>
                    <div className="d-node-slot">
                      {isCurrent && !openHere && (
                        <div className="d-start-bubble">{pr.done === 0 ? "START" : "CONTINUE"}</div>
                      )}
                      <button
                        className={`d-node ${unlocked ? "" : "locked"}${pr.complete ? " gold" : ""}${dull ? " faded" : ""}`}
                        style={unlocked ? { "--d-node": nodeCol.c, "--d-node-dark": nodeCol.d } : undefined}
                        onClick={() => { sfx("tap"); setOpen(openHere ? null : cardId(u)); }}
                        aria-label={`${unitName(u)}, ${pr.done} of ${pr.total} lessons done${
                          unlocked ? "" : ", locked"}${pr.complete ? ", complete" : ""}${
                          dull ? `, last practised ${sinceLabel(duo.units?.[u.unit]?.at)}` : ""}`}
                        aria-disabled={!unlocked}
                      >
                        {/* a locked skill still showed its picture, greyed */}
                        <span
                          className={`d-skill-art${pr.complete ? " gold" : unlocked ? "" : " locked"}`}
                          style={skillArt(u.icon)}
                        />
                      </button>
                      <Ring fraction={pr.fraction} color={pr.complete ? GOLD.d : GOLD.c} />
                    </div>
                    <div className="d-node-name">{unitName(u)}</div>

                    {openHere && (
                      /* the card is centred on the row and only its arrow moves,
                         so a skill at the edge cannot push it off a narrow screen */
                      <div
                        className="d-pop"
                        style={{
                          top: "calc(100% + 10px)", "--d-arrow": `calc(50% + ${arrowFor(k, row.length)}px)`,
                          background: unlocked ? nodeCol.c : "var(--d-mute)",
                          color: unlocked ? "#fff" : "var(--d-sub)",
                          borderBottomColor: unlocked ? nodeCol.c : "var(--d-mute)",
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 17 }}>{unitName(u)}</div>
                        <div style={{ fontSize: 13, opacity: .92, marginTop: 2 }}>
                          {unlocked
                            ? `Unit ${u.unit} · ${u.objective || u.skill} · lesson ${Math.min(pr.done + 1, pr.total)} of ${pr.total}`
                            : "Finish the skills above to unlock this one"}
                        </div>
                        {/* the disc has gone pale, and this is the sentence that
                            says why, since a washed-out colour on its own is a
                            guess rather than a fact */}
                        {dull && (
                          <div style={{ fontSize: 13, opacity: .92, marginTop: 6, fontWeight: 700 }}>
                            You last practised this {sinceLabel(duo.units?.[u.unit]?.at)}.
                          </div>
                        )}
                        {unlocked && (
                          <>
                            <button
                              className="d-btn"
                              style={{ marginTop: 12, background: "#fff", color: nodeCol.c, boxShadow: "0 4px 0 rgba(0,0,0,.15)" }}
                              disabled={busy}
                              onClick={() => { setOpen(null); onStart(u, nodeAt(u, pr.next), u.nodes[pr.next], nodeStatus(duo, u, pr.next)); }}
                            >
                              {busy ? <Loader size={16} className="spin" />
                                : dull ? "Review it +5 XP"
                                : pr.complete ? "Practice +5 XP"
                                : u.nodes[pr.next].type === "chest" ? "Open the chest"
                                : "Start +10 XP"}
                            </button>
                            <div className="d-pop-links">
                              <button onClick={() => { setOpen(null); onGuidebook(u); }}>
                                <BookOpen size={15} /> Tips & notes
                              </button>
                              {!pr.complete && (
                                <button onClick={() => { setOpen(null); onTest(u); }}>
                                  <KeyRound size={15} /> Test out
                                </button>
                              )}
                              {/* the unit's own short text, for the units that
                                  have one — see src/duo/passages.js */}
                              {onPassage && passageFor(u.unit) && (
                                <button onClick={() => { setOpen(null); onPassage(u); }}>
                                  <BookOpen size={15} /> Read the story
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {cp && (
              <Checkpoint cp={cp} done={checkpointDone(cp)} busy={busy} onTest={onCheckpoint} />
            )}
          </div>
        );
      })}

      {/* the trophy that closes a section */}
      <div className="d-center" style={{ paddingTop: 18 }}>
        <div className="d-trophy" style={{
          background: treeRows.flat().every((u) => unitProgress(u).complete) ? "var(--d-gold)" : "var(--d-mute)",
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
