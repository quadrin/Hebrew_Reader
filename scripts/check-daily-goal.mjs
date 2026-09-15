import assert from "node:assert/strict";
import { dailyGoalProgress } from "../src/dailyGoalProgress.js";

for (const goal of [10, 20, 30, 50]) {
  for (const earned of [0, 1, 5, 10, 20, 30, 50, 200, 999, 12345, 1000000]) {
    const p = dailyGoalProgress(earned, goal);
    assert.equal(p.earned, earned);
    assert.equal(p.target, goal);
    assert.equal(p.completed, Math.min(earned, goal));
    assert.equal(p.completed + p.overflow, earned);
    assert.equal(p.percent, Math.min(100, earned / goal * 100));
    assert.equal(p.met, earned >= goal);
    assert(p.percent >= 0 && p.percent <= 100);
  }
}
const p = dailyGoalProgress(200, 20);
assert.equal(p.completed, 20);
assert.equal(p.overflow, 180);
assert.equal(dailyGoalProgress(30, 50).percent, 60);
assert.equal(dailyGoalProgress(30, 50).overflow, 0);
assert.equal(dailyGoalProgress(30, 10).overflow, 20);
assert.equal(dailyGoalProgress(-1, 20).earned, 0);
assert.equal(dailyGoalProgress(NaN, 20).earned, 0);
assert.equal(dailyGoalProgress(Infinity, 20).earned, 0);
assert.equal(dailyGoalProgress(undefined, undefined).target, 20);
assert.equal(dailyGoalProgress(200, 0).target, 20);
console.log("PASS daily goal arithmetic: all goals, zero, partial, full and overflow; invalid inputs");
