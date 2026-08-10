/* EPUB import — an EPUB is a zip of XHTML chapters. Unzip with fflate,
   read the spine order from the OPF manifest, and extract plain text.
   Chapter titles come from the book's own table of contents (EPUB2 .ncx or
   EPUB3 nav doc), falling back to each chapter's first heading. */

import { unzipSync, strFromU8 } from "fflate";

/* resolve "dir/../x" style relative paths and strip fragments/queries */
const normPath = (dir, href) => {
  const raw = decodeURIComponent(String(href)).replace(/[#?].*$/, "");
  const parts = (dir + raw).split("/");
  const out = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== "." && p !== "") out.push(p);
  }
  return out.join("/");
};

export async function extractEpub(file, onProgress) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const files = unzipSync(buf);
  const read = (path) => (files[path] ? strFromU8(files[path]) : "");

  const container = read("META-INF/container.xml");
  const opfPath = container.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new Error("not an epub: missing container.xml rootfile");
  const opf = read(opfPath);
  const dir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  const title = opf.match(/<dc:title[^>]*>([^<]*)<\/dc:title>/i)?.[1]?.trim() || "";

  const manifest = {};
  let ncxHref = null, navHref = null;
  for (const m of opf.matchAll(/<item\s[^>]*\/?>/g)) {
    const id = m[0].match(/\bid="([^"]+)"/)?.[1];
    const href = m[0].match(/\bhref="([^"]+)"/)?.[1];
    if (!id || !href) continue;
    manifest[id] = href;
    if (/application\/x-dtbncx\+xml/.test(m[0]) || /\.ncx["']/.test(m[0])) ncxHref = href;
    if (/\bproperties="[^"]*\bnav\b[^"]*"/.test(m[0])) navHref = href;
  }
  const spine = [...opf.matchAll(/<itemref\s[^>]*idref="([^"]+)"/g)]
    .map((m) => manifest[m[1]])
    .filter(Boolean);
  if (!spine.length) throw new Error("epub has no readable spine");

  const parser = new DOMParser();

  /* normalized chapter path -> title, from the book's own TOC */
  const titles = {};
  if (ncxHref) {
    const ncx = read(normPath(dir, ncxHref));
    for (const m of ncx.matchAll(/<navLabel[^>]*>[\s\S]*?<text[^>]*>([^<]*)<\/text>[\s\S]*?<content[^>]*src="([^"]+)"/g)) {
      const p = normPath(dir, m[2]);
      if (m[1].trim() && !titles[p]) titles[p] = m[1].trim();
    }
  }
  if (navHref) {
    const navDoc = parser.parseFromString(read(normPath(dir, navHref)), "text/html");
    navDoc.querySelectorAll("nav a[href]").forEach((a) => {
      const p = normPath(dir, a.getAttribute("href"));
      const t = (a.textContent || "").trim();
      if (t && !titles[p]) titles[p] = t;
    });
  }

  const chapters = [];
  spine.forEach((href, i) => {
    const path = normPath(dir, href);
    const html = read(path);
    if (html) {
      const doc = parser.parseFromString(html, "text/html");
      doc.querySelectorAll("script,style,nav").forEach((n) => n.remove());
      const heading = doc.querySelector("h1,h2,h3")?.textContent?.trim() || "";
      /* textContent flattens block boundaries — mark them as newlines first so
         paragraph structure survives into the reader */
      doc.body?.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,blockquote,br,section,article,tr")
        .forEach((el) => el.appendChild(doc.createTextNode("\n")));
      const t = (doc.body?.textContent || "").trim();
      if (t) chapters.push({ title: titles[path] || heading, text: t });
    }
    onProgress?.(i + 1, spine.length);
  });
  if (!chapters.length) throw new Error("epub has no readable text");

  return { title, chapters, text: chapters.map((c) => c.text).join("\n") };
}
