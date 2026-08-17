/* Renders everything the app shows the hoopoe in, from the two drawings in art/.

   In:  art/hoopoe-icon.png   the face, filling a rounded tile — the app icon
        art/hoopoe-bird.png   the whole bird on nothing — the mark in the bar

   Out: public/icon-512.png   what a manifest asks for
        public/icon-192.png
        public/apple-touch-icon.png   square and opaque; iOS rounds it itself,
                                      and turns transparent corners black
        src/assets/hoopoe-mark.webp   the bar's copy, small enough to inline
        index.html                    the favicon, written in as a data URI

   Both drawings are exported with a soft shadow and a margin of nothing around
   them, so each is trimmed to what is actually drawn before it is scaled —
   otherwise the icon arrives at 512 pixels with 40 of them spent on air.

   Chromium does the work. It is already a dev dependency, and it crops and
   re-encodes the way the browser that will show the picture would.

   Run: npm run build:icons
   Set CHROME_PATH to use a Chromium that Playwright did not install. */

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "public");

const ICON = resolve(ROOT, "art/hoopoe-icon.png");
const BIRD = resolve(ROOT, "art/hoopoe-bird.png");
const TILE_ORANGE = "#F97316";           /* what fills the corners of the square one */

const dataUri = (file) => `data:image/png;base64,${readFileSync(file).toString("base64")}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage();
await page.setContent("<body></body>");

/* Draw a source picture into a square of the size wanted.

   Both drawings are exported flat onto pure black — no transparency anywhere,
   a soft shadow around the artwork, black to the edges of the file — so each
   has to be measured before it is scaled, and there are two ways to do it
   because the two pictures are different problems.

   The tile is measured along its centre lines, where it spans its full width
   and height, and then drawn through a rounded mask a little rounder than its
   own corners. Flooding the background out instead was the obvious thing and
   the wrong one: the black crest tips touch the top edge of the tile, so they
   are joined to the black outside it, and the flood ate them.

   The bird is measured by what is not the background, which works because the
   background is pure black and the bird's own black is not.

   `fill` scales to cover rather than to fit, which is what the square
   home-screen icon wants. */
async function square({ source, size, mode = "tile", background = null, type = "image/png", quality = 0.92, fill = false }) {
  const out = await page.evaluate(async ({ source, size, mode, background, type, quality, fill }) => {
    const img = new Image();
    img.src = source;
    await img.decode();

    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    const probe = document.createElement("canvas");
    probe.width = w0; probe.height = h0;
    const pctx = probe.getContext("2d", { willReadFrequently: true });
    pctx.drawImage(img, 0, 0);
    const px = pctx.getImageData(0, 0, w0, h0).data;
    const sum = (x, y) => { const i = (y * w0 + x) * 4; return px[i] + px[i + 1] + px[i + 2]; };

    let left, top, right, bottom;
    if (mode === "tile") {
      const midY = h0 >> 1, midX = w0 >> 1;
      const lit = (v) => v > 60;
      for (left = 0; left < w0 && !lit(sum(left, midY)); left++);
      for (right = w0 - 1; right > 0 && !lit(sum(right, midY)); right--);
      for (top = 0; top < h0 && !lit(sum(midX, top)); top++);
      for (bottom = h0 - 1; bottom > 0 && !lit(sum(midX, bottom)); bottom--);
    } else {
      top = h0; left = w0; right = 0; bottom = 0;
      for (let y = 0; y < h0; y++) {
        for (let x = 0; x < w0; x++) {
          if (sum(x, y) <= 30) continue;          /* pure black is the paper it sits on */
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    const w = right - left + 1, h = bottom - top + 1;
    if (w <= 0 || h <= 0) return null;

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";

    /* the background goes down first and unmasked: the square icon wants its
       corners filled, since iOS rounds the thing itself and paints anything
       transparent black */
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, size, size); }
    if (mode === "tile") {
      /* the mask: rounder than the drawing's own corners, so it takes a sliver
         of the tile rather than leaving a crumb of the black behind it */
      const r = size * 0.225;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.arcTo(size, 0, size, size, r);
      ctx.arcTo(size, size, 0, size, r);
      ctx.arcTo(0, size, 0, 0, r);
      ctx.arcTo(0, 0, size, 0, r);
      ctx.closePath();
      ctx.clip();
    }

    const scale = size / (fill ? Math.min(w, h) : Math.max(w, h));
    const dw = w * scale, dh = h * scale;
    ctx.drawImage(img, left, top, w, h, (size - dw) / 2, (size - dh) / 2, dw, dh);
    return canvas.toDataURL(type, quality);
  }, { source, size, mode, background, type, quality, fill });

  if (!out) throw new Error(`nothing to draw in ${source.slice(0, 40)}`);
  return Buffer.from(out.split(",")[1], "base64");
}

const icon = dataUri(ICON);
const bird = dataUri(BIRD);

const targets = [
  { file: resolve(OUT, "icon-512.png"), source: icon, size: 512 },
  { file: resolve(OUT, "icon-192.png"), source: icon, size: 192 },
  { file: resolve(OUT, "apple-touch-icon.png"), source: icon, size: 180, background: TILE_ORANGE, fill: true },
  { file: resolve(ROOT, "src/assets/hoopoe-mark.webp"), source: bird, size: 128, mode: "art", type: "image/webp", quality: 0.9 },
];

for (const t of targets) {
  const bytes = await square(t);
  writeFileSync(t.file, bytes);
  console.log(`${t.file.replace(`${ROOT}/`, "")}  ${t.size}×${t.size}  ${(bytes.length / 1024).toFixed(1)} KB`);
}

/* The favicon goes into index.html as a data URI rather than as a link,
   because the single-file build has nowhere to link to. */
const favicon = await square({ source: icon, size: 64 });
const uri = `data:image/png;base64,${favicon.toString("base64")}`;
const indexPath = resolve(ROOT, "index.html");
const html = readFileSync(indexPath, "utf8");
const tag = /<link\s+rel="icon"[^>]*>/;
/* the check is that the tag is there, not that it changed: a second run writes
   the same favicon back, and "no difference" is not "nothing to write to" */
if (!tag.test(html)) throw new Error('index.html has no <link rel="icon"> to write to');
writeFileSync(indexPath, html.replace(tag, `<link rel="icon" type="image/png" href="${uri}" />`));
console.log(`index.html    favicon  ${(uri.length / 1024).toFixed(1)} KB`);

await browser.close();
