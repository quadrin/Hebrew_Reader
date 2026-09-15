import React from "react";
import { dailyGoalProgress } from "./dailyGoalProgress.js";
import "./daily-goal.css";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const tickNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/* React owns the complete meter, including the selected goal and overflow.
   No DOM observers, duplicated XP state, or progress writes live here. */
export default function DailyGoal({ today, goal, choices, onGoalChange }) {
  const p = dailyGoalProgress(today, goal);
  const extra = `+${number.format(p.overflow)}`;
  const status = p.overflow > 0 ? "Goal crushed — streak intact."
    : p.met ? "Goal met — the streak is safe."
    : `${number.format(p.remaining)} XP to go.`;
  const valueText = `${number.format(p.earned)} XP earned today; goal ${number.format(p.target)} XP.`
    + (p.overflow > 0 ? ` ${number.format(p.overflow)} XP beyond goal.` : "");

  return (
    <div className="panel daily-goal-panel">
      <div className="panel-title">Daily goal</div>
      <div className="daily-goal-body">
        <div className={`xp-meter${p.overflow > 0 ? " has-overflow" : ""}${extra.length > 8 ? " has-long-overflow" : ""}`}
          role="progressbar" aria-label="Daily XP goal"
          aria-valuemin={0} aria-valuemax={p.target} aria-valuenow={p.completed}
          aria-valuetext={valueText}>
          <div className="xp-meter-bezel" aria-hidden="true">
            <div className="xp-slot-group">
              <div className="xp-slot">
                <div className="xp-slot-fill" style={{ width: `${p.percent}%` }} />
                <span className="xp-slot-label">{number.format(p.completed)} / {number.format(p.target)} XP</span>
              </div>
              {/* The scale follows the selected goal. At a 20 XP goal its
                  labels stay 0 / 10 / 20, including when 200 XP are earned. */}
              <div className="xp-meter-scale" aria-hidden="true">
                {[0, .25, .5, .75, 1].map((fraction, index) => (
                  <span key={fraction} className={`xp-meter-tick${index % 2 === 0 ? " major" : ""}`}>
                    {index % 2 === 0 ? tickNumber.format(p.target * fraction) : ""}
                  </span>
                ))}
              </div>
            </div>
            {p.overflow > 0 && (
              <span className="xp-overflow-badge">
                <span className="xp-overflow-rays"><i /><i /><i /></span>
                <span className="xp-overflow-value">{extra}</span>
              </span>
            )}
          </div>
        </div>
        <div className="daily-goal-copy" aria-live="polite" aria-atomic="true">
          <div className="daily-goal-total">{number.format(p.earned)} / {number.format(p.target)} XP today</div>
          <div className="daily-goal-status">{status}</div>
          {p.overflow > 0 && <span className="daily-goal-sr">{number.format(p.overflow)} XP beyond goal.</span>}
        </div>
      </div>
      <div className="daily-goal-choices" role="group" aria-label="Daily XP target">
        {choices.map((choice) => (
          <button type="button" key={choice.xp}
            className={`goal-pill${p.target === choice.xp ? " on" : ""}`}
            aria-pressed={p.target === choice.xp} onClick={() => onGoalChange(choice.xp)}>
            {choice.name} · {choice.xp}
          </button>
        ))}
      </div>
    </div>
  );
}
