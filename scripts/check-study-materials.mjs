/* Browser regression for the presentational study layer.
   Run against a local production preview, never an existing browser profile:
     npm run build && npm run preview
     npx playwright install chromium
     node scripts/check-study-materials.mjs http://localhost:4173/
   Every case uses isolated storage. No API keys or user progress are loaded. */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const target = new URL(process.argv[2] || "http://localhost:4173/");
assert(["http:", "https:"].includes(target.protocol), "Supply an HTTP(S) preview URL");
const hubSelector = ".duo > div:has(> button.d-card.d-row)";
const cardSelector = "button.d-card.d-row";
const style = (locator, property) => locator.evaluate((el, key) => getComputedStyle(el).getPropertyValue(key), property);
async function insideWidth(page, locator) {
  const box = await locator.boundingBox();
  assert(box && box.x >= -1 && box.x + box.width <= page.viewportSize().width + 1, "Horizontal overflow");
}
const browser = await chromium.launch();
try {
  for (const width of [320, 390, 768, 1440]) {
    for (const theme of ["paper", "sepia", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: width < 768 ? 740 : 900 },
        serviceWorkers: "block", reducedMotion: "reduce",
      });
      try {
        await context.addInitScript((selectedTheme) => {
          localStorage.setItem("lavan-hebrew-reader-v1", JSON.stringify({
            prefs: { theme: selectedTheme, fontScale: 1 }, welcomeDismissed: true,
          }));
        }, theme);
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(target.href, { waitUntil: "domcontentloaded" });
        await page.locator('.primary-nav-btn[aria-label="Practice"]').click();
        await page.locator(cardSelector).first().waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
        const hub = page.locator(hubSelector);
        assert.equal(await hub.count(), 1, "PracticeHub structural selector changed");
        const fonts = await page.evaluate(async () => (await document.fonts.load('700 26px "Frank Ruhl Libre"')).length);
        assert(fonts > 0, "Display font did not load");
        for (const heading of await hub.locator(":scope > .d-title").all()) {
          assert.match(await style(heading, "font-family"), /Frank Ruhl Libre/);
        }
        for (const card of await page.locator(cardSelector).all()) {
          await insideWidth(page, card);
          assert.notEqual(await style(card, "background-image"), "none");
          assert.notEqual(await style(card.locator(":scope > span").first(), "background-image"), "none");
        }
        assert.match(await style(page.locator(`${cardSelector} > span:nth-child(2) > span:first-child`).first(), "font-family"), /Frank Ruhl Libre/);
        assert.match(await style(page.locator(`${cardSelector} .d-sub`).first(), "font-family"), /Rubik/);
        assert(await page.locator(cardSelector).first().isDisabled());
        await page.locator(cardSelector).first().hover();
        assert.equal(await style(page.locator(cardSelector).first(), "transform"), "none");
        await hub.getByRole("button", { name: "Show all", exact: true }).click();
        await hub.getByRole("button", { name: "From reading" }).click();
        assert.equal(await hub.getByText("nothing starred yet", { exact: true }).count(), 1);
        for (const key of await hub.locator("button.d-pill").all()) await insideWidth(page, key);
        await hub.getByRole("button", { name: "Hide", exact: true }).click();
        const show = hub.getByRole("button", { name: "Show all", exact: true });
        await show.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        assert.notEqual(await style(show, "outline-style"), "none");
        await hub.getByRole("button", { name: "Word families" }).click();
        await page.locator(".d-session").waitFor();
        const question = await page.locator(".d-question").innerText();
        const quit = page.locator(".d-session-top .d-icon-btn");
        await quit.click();
        const dialog = page.getByRole("dialog");
        await dialog.waitFor();
        await insideWidth(page, dialog);
        const rect = await dialog.boundingBox();
        assert(rect.y >= -1 && rect.y + rect.height <= page.viewportSize().height + 1, "Dialog exceeds viewport");
        assert.match(await style(dialog.locator(".d-title"), "font-family"), /Frank Ruhl Libre/);
        assert.match(await style(dialog.getByRole("button", { name: "Quit", exact: true }), "font-family"), /Rubik/);
        assert.notEqual(await style(dialog, "background-image"), "none");
        await page.waitForFunction(() => !!document.activeElement.closest('[role="dialog"]'));
        await dialog.getByRole("button", { name: "Keep learning", exact: true }).click();
        await dialog.waitFor({ state: "detached" });
        assert.equal(await page.locator(".d-question").innerText(), question);
        await quit.click();
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "detached" });
        assert.equal(await page.locator(".d-question").innerText(), question);
        await quit.click();
        await dialog.getByRole("button", { name: "Quit", exact: true }).click();
        await page.locator(".d-session").waitFor({ state: "detached" });
        await page.locator('.primary-nav-btn[aria-label="Learn"]').click();
        await page.locator('.d-node[aria-disabled="false"]').first().click();
        const popover = page.locator(".d-pop");
        await popover.waitFor();
        await insideWidth(page, popover);
        assert.match(await style(popover.locator(":scope > div").first(), "font-family"), /Frank Ruhl Libre/);
        assert.notEqual(await style(popover.locator(":scope > .d-btn"), "background-image"), "none");
        assert.deepEqual(errors, [], "Runtime errors");
        console.log(`PASS ${theme} ${width}px`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
