/* Run against an HTTP(S) production preview after npm run build:
     node scripts/check-daily-goal-browser.mjs http://localhost:4173/
   Only isolated browser storage is used. No real progress or keys are read. */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const target = new URL(process.argv[2] || "http://localhost:4173/");
assert(["http:", "https:"].includes(target.protocol));
const format = (n) => n.toLocaleString("en-US");
const browser = await chromium.launch();
try {
  for (const theme of ["paper", "sepia", "dark"]) {
    for (const xp of [0, 5, 20, 30, 200, 12345, 1000000]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        serviceWorkers: "block", reducedMotion: "reduce",
      });
      try {
        await context.addInitScript(({ theme, xp }) => {
          const d = new Date();
          const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          localStorage.setItem("lavan-hebrew-reader-v1", JSON.stringify({
            prefs: { theme, fontScale: 1 }, welcomeDismissed: true,
          }));
          localStorage.setItem("lavan-duo-v1", JSON.stringify({ goal: 20, xp, days: { [day]: xp } }));
        }, { theme, xp });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(target.href, { waitUntil: "domcontentloaded" });
        const card = page.locator(".daily-goal-panel");
        await card.waitFor();
        const meter = card.getByRole("progressbar", { name: "Daily XP goal" });
        const overflow = card.locator(".xp-overflow-value");
        assert.equal(await meter.getAttribute("aria-valuenow"), String(Math.min(xp, 20)));
        assert.equal(await meter.getAttribute("aria-valuemax"), "20");
        assert.equal(await card.locator(".xp-slot-label").innerText(), `${format(Math.min(xp, 20))} / 20 XP`);
        assert.equal(await card.locator(".daily-goal-total").innerText(), `${format(xp)} / 20 XP today`);
        assert.equal(await overflow.count(), xp > 20 ? 1 : 0);
        if (xp > 20) assert.equal(await overflow.innerText(), `+${format(xp - 20)}`);
        assert.equal(await card.locator(".xp-slot-fill").evaluate((el) => el.style.width), `${Math.min(100, xp / 20 * 100)}%`);
        assert.equal(await card.locator(".xp-slot-fill").evaluate((el) => getComputedStyle(el).transitionDuration), "0s");
        assert.match(await card.locator(".xp-slot-label").evaluate((el) => getComputedStyle(el).fontFamily), /Rubik/);
        for (const width of [900, 1024, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          for (const element of await card.locator(".xp-meter-bezel, .xp-slot-label, .xp-overflow-badge, .goal-pill").all()) {
            const rect = await element.boundingBox();
            const bounds = await card.boundingBox();
            assert(rect && bounds && rect.x >= bounds.x && rect.x + rect.width <= bounds.x + bounds.width + 1, "Card overflow");
          }
        }
        await card.getByRole("button", { name: "Intense · 50", exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.daily-goal-panel [role="progressbar"]').getAttribute("aria-valuemax") === "50");
        assert.equal(await meter.getAttribute("aria-valuenow"), String(Math.min(xp, 50)));
        assert.equal(await card.getByRole("button", { name: "Intense · 50", exact: true }).getAttribute("aria-pressed"), "true");
        assert.equal(await overflow.count(), xp > 50 ? 1 : 0);
        if (xp > 50) assert.equal(await overflow.innerText(), `+${format(xp - 50)}`);
        assert.equal(await card.locator(".daily-goal-total").innerText(), `${format(xp)} / 50 XP today`);
        const casual = card.getByRole("button", { name: "Casual · 10", exact: true });
        await casual.focus();
        await page.keyboard.press("Space");
        await page.waitForFunction(() => document.querySelector('.daily-goal-panel [role="progressbar"]').getAttribute("aria-valuemax") === "10");
        assert.equal(await casual.getAttribute("aria-pressed"), "true");
        for (const width of [320, 390, 768]) {
          await page.setViewportSize({ width, height: 800 });
          assert(await card.isHidden(), "Sidebar should keep its existing mobile visibility");
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Page overflow");
        }
        assert.deepEqual(errors, []);
        console.log(`PASS ${theme} ${xp} XP: values, overflow, goal changes, keyboard, widths`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
