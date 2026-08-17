/* Renders the app icon from src/assets/hoopoe.svg — the copy in public/ that
   the manifest points at, the PNGs every platform wants its own size of, and
   the inline favicon in index.html.

   The drawing lives in src/ rather than in public/ because the app bar imports
   it too, and an asset imported from src is inlined into the single-file build
   where a public/ one would be a broken image. Everything else here is a copy
   of it, which is why they are generated rather than edited.

   The SVG is the drawing; everything else is a copy of it at the size some
   platform insists on. Chromium does the rasterizing — Playwright is already
   a dev dependency, and it renders the same SVG the browser will.

   The home-screen icon is the odd one out: iOS ignores the rounded corners
   and masks the icon itself, so a rounded PNG comes out with black corners.
   That one is rendered square.

   The favicon goes into index.html as a data URI rather than a link, because
   the single-file build has to stay one file with nothing beside it.

   Usage: npm run build:icons [-- --out <dir>]
   Set CHROME_PATH to use a Chromium that Playwright did not install. */

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outFlag = process.argv.indexOf("--out");
const OUT = outFlag > -1 ? resolve(process.argv[outFlag + 1]) : resolve(ROOT, "public");

const TARGETS = [
  { file: "icon-192.png", size: 192, corners: "rounded" },
  { file: "icon-512.png", size: 512, corners: "rounded" },
  { file: "apple-touch-icon.png", size: 180, corners: "square" },
];

const svg = readFileSync(resolve(ROOT, "src/assets/hoopoe.svg"), "utf8");
writeFileSync(resolve(OUT, "icon.svg"), svg);   /* what the manifest names */
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
try {
  for (const { file, size, corners } of TARGETS) {
    const art = corners === "square" ? svg.replace(/\srx="\d+"/, "") : svg;
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${art}`
    );
    writeFileSync(resolve(OUT, file), await page.screenshot({ omitBackground: corners === "rounded" }));
    await page.close();
    console.log(`${file}  ${size}×${size}  ${corners}`);
  }
} finally {
  await browser.close();
}

const indexPath = resolve(ROOT, "index.html");
const html = readFileSync(indexPath, "utf8");
const inline = svg.replace(/<!--[\s\S]*?-->/g, "").replace(/\s*\n\s*/g, " ").trim();
const uri = `data:image/svg+xml,${encodeURIComponent(inline)}`;
const next = html.replace(/(<link rel="icon" type="image\/svg\+xml" href=")[^"]*(")/, `$1${uri}$2`);
if (next === html && !html.includes(uri)) throw new Error("index.html has no <link rel=\"icon\" type=\"image/svg+xml\"> to write to");
writeFileSync(indexPath, next);
console.log(`index.html    favicon  ${uri.length} chars`);
