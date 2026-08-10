/* EPUB import — an EPUB is a zip of XHTML chapters. Unzip with fflate,
   read the spine order from the OPF manifest, and extract plain text. */

import { unzipSync, strFromU8 } from "fflate";

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
  for (const m of opf.matchAll(/<item\s[^>]*\/?>/g)) {
    const id = m[0].match(/\bid="([^"]+)"/)?.[1];
    const href = m[0].match(/\bhref="([^"]+)"/)?.[1];
    if (id && href) manifest[id] = href;
  }
  const spine = [...opf.matchAll(/<itemref\s[^>]*idref="([^"]+)"/g)]
    .map((m) => manifest[m[1]])
    .filter(Boolean);
  if (!spine.length) throw new Error("epub has no readable spine");

  const parser = new DOMParser();
  const texts = [];
  spine.forEach((href, i) => {
    const path = decodeURIComponent(dir + href).replace(/[#?].*$/, "");
    const html = read(path);
    if (!html) return;
    const doc = parser.parseFromString(html, "text/html");
    doc.querySelectorAll("script,style,nav").forEach((n) => n.remove());
    /* textContent flattens block boundaries — mark them as newlines first so
       paragraph structure survives into the reader */
    doc.body?.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,blockquote,br,section,article,tr")
      .forEach((el) => el.appendChild(doc.createTextNode("\n")));
    const t = (doc.body?.textContent || "").trim();
    if (t) texts.push(t);
    onProgress?.(i + 1, spine.length);
  });

  return { title, text: texts.join("\n") };
}
