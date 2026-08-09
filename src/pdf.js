/* PDF import — runs entirely in the browser on the reader's own file.
   pdf.js is lazy-loaded from a CDN only when a PDF is actually opened. */

import { stripBidi } from "./text.js";

const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let pdfjsPromise = null;
export function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PDFJS_URL;
    s.onload = () => {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        resolve(window.pdfjsLib);
      } catch (e) {
        reject(e);
      }
    };
    s.onerror = () => reject(new Error("pdfjs load failed"));
    document.head.appendChild(s);
  });
  return pdfjsPromise;
}

/* Rebuild each page in logical (reading) order. Some RTL PDFs stream
   their text runs in visual left-to-right order, so we group items into
   lines by y-position and read each line right-to-left by x-position. */
function reconstructPage(tc) {
  const items = tc.items.filter((i) => i.str && i.str.trim().length > 0);
  const lines = new Map();
  for (const it of items) {
    const y = Math.round(it.transform[5]);
    let key = null;
    for (const k of lines.keys()) {
      if (Math.abs(k - y) <= 3) { key = k; break; }
    }
    if (key === null) { key = y; lines.set(key, []); }
    lines.get(key).push(it);
  }
  const sortedYs = [...lines.keys()].sort((a, b) => b - a);
  const out = [];
  for (const y of sortedYs) {
    const lineItems = lines.get(y).sort((a, b) => b.transform[4] - a.transform[4]);
    let line = lineItems.map((i) => i.str).join(" ");
    line = stripBidi(line)
      .replace(/\s+([,.;:!?״”)\]])/g, "$1")
      .replace(/([([“])\s+/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!line) continue;
    if (/^\d+$/.test(line)) continue; /* bare page numbers */
    out.push(line);
  }
  return out.join(" ");
}

export async function extractPdf(file, onProgress) {
  const pdfjs = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let title = "";
  try {
    const meta = await doc.getMetadata();
    title = (meta?.info?.Title || "").trim();
  } catch (e) { /* metadata optional */ }
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(reconstructPage(tc));
    if (p % 5 === 0 || p === doc.numPages) onProgress(p, doc.numPages);
  }
  return { title, pages };
}
