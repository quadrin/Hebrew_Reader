/* A goal meter caps its fill, never the earned XP or the overflow readout. */
export function dailyGoalProgress(today, goal) {
  const earned = Number.isFinite(today) ? Math.max(0, Math.floor(today)) : 0;
  const target = Number.isFinite(goal) && goal >= 1 ? Math.floor(goal) : 20;
  const completed = Math.min(earned, target);
  const overflow = Math.max(0, earned - target);
  return {
    earned, target, completed, overflow,
    percent: (completed / target) * 100,
    met: earned >= target,
    remaining: Math.max(0, target - earned),
  };
}
