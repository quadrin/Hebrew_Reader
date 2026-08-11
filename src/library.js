/* Public-domain libraries — browse and open Hebrew books over the network.

   Three sources, all of which answer with open CORS headers, so the reader
   stays a static site with no server of its own:

     · Sefaria             classical texts, keyless
     · Hebrew Wikisource   full-text search over public-domain books, keyless
     · Project Ben-Yehuda  modern Hebrew literature, free self-service key

   Every fetch returns the shape the file importers already produce —
   { title, chapters: [{ title, text }], src } — so a downloaded book takes
   the same path through paginateChapters() as an EPUB does. `src` carries
   attribution (who published it, under what license) to show in the library.

   Nothing here downloads a text whose license isn't open; where a source
   states a license per version (Sefaria does), it is checked before import
   and recorded afterwards. */

const TIMEOUT_MS = 25000;

async function getJson(url, init = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal });
    const body = await r.text();
    let data = null;
    try { data = JSON.parse(body); } catch (e) { /* fall through to the status check */ }
    if (!r.ok) {
      const err = new Error(data?.error || data?.message || `request failed (${r.status})`);
      err.status = r.status;
      throw err;
    }
    if (data == null) throw new Error("that library sent back something unreadable");
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("the library took too long to answer — try again");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/* HTML → reading text. Block elements get a newline appended first so that
   paragraph structure survives textContent's flattening — the same trick the
   EPUB importer uses. */
const BLOCK_SEL = "p,div,h1,h2,h3,h4,h5,h6,li,blockquote,br,tr,dd,dt,section";

function htmlToText(html, dropSel) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  doc.querySelectorAll(`script,style${dropSel ? "," + dropSel : ""}`).forEach((n) => n.remove());
  doc.body?.querySelectorAll(BLOCK_SEL).forEach((el) => el.appendChild(doc.createTextNode("\n")));
  return (doc.body?.textContent || "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n[ \n]*/g, "\n")
    .trim();
}

/* פרק א, פרק ב … — chapter labels that read as Hebrew rather than "Chapter 1".
   15 and 16 are spelled טו/טז so they don't spell a divine name. */
const ONES = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
const HUNDREDS = ["", "ק", "ר", "ש", "ת"];

export function hebrewNumeral(n) {
  if (!Number.isInteger(n) || n < 1 || n > 499) return String(n);
  const out = HUNDREDS[Math.floor(n / 100)] + TENS[Math.floor((n % 100) / 10)] + ONES[n % 10];
  return out.replace(/יה$/, "טו").replace(/יו$/, "טז");
}

/* ================================================================== */
/* The shelf — graded books served from this app's own origin          */
/* ================================================================== */

/* Built by scripts/build-shelf.mjs from Project Ben-Yehuda's public-domain
   dump and committed alongside the app, so this shelf needs no key, crosses
   no origin, and — once a book has been opened — works offline. Each entry
   carries a reading level measured against the corpus: `coverage` is the
   share of the text built from the 2,000 commonest Hebrew words. */

const shelfUrl = (file) => new URL(`shelf/${file}`, document.baseURI).href;

let shelfIndex = null;

export async function fetchShelfIndex() {
  if (shelfIndex) return shelfIndex;
  const data = await getJson(shelfUrl("index.json"));
  shelfIndex = data;
  return data;
}

export async function fetchShelfBook(entry) {
  const data = await getJson(shelfUrl(`${entry.id}.json`));
  const text = String(data.text || "").trim();
  if (!text) throw new Error("that book came back empty");
  return {
    title: data.author ? `${data.title} — ${data.author}` : data.title,
    text,
    src: data.src,
  };
}

/* ================================================================== */
/* The course — graded units, also served from this origin             */
/* ================================================================== */

/* Built by scripts/build-course.mjs. Unit N teaches the next band of the
   corpus's frequency ranking and pairs it with a passage the learner can
   already almost read; the reading opens in the reader like any other book, so
   every feature applies to it. */

const courseUrl = (file) => new URL(`course/${file}`, document.baseURI).href;

let courseIndex = null;

export async function fetchCourseIndex() {
  if (courseIndex) return courseIndex;
  courseIndex = await getJson(courseUrl("index.json"));
  return courseIndex;
}

export async function fetchCourseUnit(n) {
  return getJson(courseUrl(`unit-${n}.json`));
}

export const SHELF_LEVELS = [
  { id: 1, label: "Starting out" },
  { id: 2, label: "Getting going" },
  { id: 3, label: "Comfortable" },
  { id: 4, label: "Stretching" },
  { id: 5, label: "Hardest" },
];

/* ================================================================== */
/* Sefaria — a curated shelf of classical texts                        */
/* ================================================================== */

const SEFARIA = "https://www.sefaria.org/api";

/* Sefaria hosts texts under a range of terms — some translations are
   non-commercial or all-rights-reserved. Only these get imported. */
const OPEN_LICENSE = /^\s*(public domain|pd|cc0|cc[- ]by(?:[- ]sa)?)\s*$/i;

/* Chapter counts and licenses below were read from the API, so the shelf can
   describe a book before anything is downloaded. */
export const SEFARIA_SHELF = [
  { ref: "Jonah", he: "יוֹנָה", en: "Jonah", chapters: 4, note: "Short narrative — the usual first read", level: "easiest" },
  { ref: "Ruth", he: "רוּת", en: "Ruth", chapters: 4, note: "Short narrative, plain vocabulary", level: "easiest" },
  { ref: "Esther", he: "אֶסְתֵּר", en: "Esther", chapters: 10, note: "Story-driven, late Biblical Hebrew", level: "easier" },
  { ref: "Song_of_Songs", he: "שִׁיר הַשִּׁירִים", en: "Song of Songs", chapters: 8, note: "Lyric poetry", level: "harder" },
  { ref: "Ecclesiastes", he: "קֹהֶלֶת", en: "Ecclesiastes", chapters: 12, note: "Reflective prose", level: "harder" },
  { ref: "Genesis", he: "בְּרֵאשִׁית", en: "Genesis", chapters: 50, note: "Torah — narrative throughout", level: "easier" },
  { ref: "Exodus", he: "שְׁמוֹת", en: "Exodus", chapters: 40, note: "Torah — narrative and law", level: "medium" },
  { ref: "Judges", he: "שׁוֹפְטִים", en: "Judges", chapters: 21, note: "Narrative cycles", level: "medium" },
  { ref: "Samuel_I", he: "שְׁמוּאֵל א", en: "Samuel I", chapters: 31, note: "Extended narrative", level: "medium" },
  { ref: "Proverbs", he: "מִשְׁלֵי", en: "Proverbs", chapters: 31, note: "Short self-contained sayings", level: "medium" },
  { ref: "Psalms", he: "תְּהִלִּים", en: "Psalms", chapters: 150, note: "Poetry — dense and figurative", level: "harder" },
  { ref: "Pirkei_Avot", he: "פִּרְקֵי אָבוֹת", en: "Pirkei Avot", chapters: 6, note: "Mishnaic Hebrew, short maxims", level: "medium" },
];

/* Sefaria wraps editorial apparatus in the text itself — footnote bodies and
   their markers read as noise mid-sentence, so they come out. */
const SEFARIA_DROP = "sup,.footnote,.footnote-marker,i.footnote";

export async function fetchSefariaBook(entry, onProgress) {
  onProgress?.(0, 1);
  const data = await getJson(`${SEFARIA}/v3/texts/${encodeURIComponent(entry.ref)}?version=hebrew`);
  const version = (data.versions || [])[0];
  const body = version?.text;
  if (!body || !body.length) throw new Error("Sefaria has no Hebrew text for that book");

  const license = String(version.license || "").trim();
  if (!OPEN_LICENSE.test(license)) {
    throw new Error(`That edition is published as “${license || "unstated"}”, so it isn't free to download here`);
  }

  /* A whole-book fetch nests chapters → verses; a flat text comes back as one
     level. Verses become lines so the reader paginates them as paragraphs. */
  const nested = Array.isArray(body[0]);
  const rawChapters = nested ? body : [body];
  const chapters = [];
  rawChapters.forEach((verses, i) => {
    const text = (Array.isArray(verses) ? verses : [verses])
      .map((v) => htmlToText(v, SEFARIA_DROP))
      .filter(Boolean)
      .join("\n");
    if (text) chapters.push({ title: nested ? `פרק ${hebrewNumeral(i + 1)}` : "", text });
    onProgress?.(i + 1, rawChapters.length);
  });
  if (!chapters.length) throw new Error("that book came back empty");

  return {
    title: `${entry.he} · ${entry.en}`,
    chapters,
    src: {
      name: "Sefaria",
      license,
      edition: version.versionTitle || "",
      url: `https://www.sefaria.org/${encodeURIComponent(entry.ref)}`,
    },
  };
}

/* ================================================================== */
/* Hebrew Wikisource — search the whole public-domain corpus            */
/* ================================================================== */

const WS_API = "https://he.wikisource.org/w/api.php";
const wsUrl = (params) =>
  `${WS_API}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`;

/* Site chrome that would otherwise land in the reading text */
const WS_DROP = [
  ".mw-editsection", ".reference", ".references", ".noprint", ".navbox",
  ".ws-noexport", ".headertemplate", ".mw-references-wrap", "#toc", ".toc",
  ".metadata", ".ambox", ".sisterproject", "table.header",
].join(",");

export async function searchWikisource(query, limit = 20) {
  const q = String(query || "").trim();
  if (!q) return [];
  const data = await getJson(wsUrl({
    action: "query", list: "search", srsearch: q,
    srnamespace: "0", srlimit: String(limit), srinfo: "", srprop: "wordcount",
  }));
  return (data?.query?.search || []).map((r) => ({
    title: r.title,
    words: r.wordcount || 0,
    url: `https://he.wikisource.org/wiki/${encodeURIComponent(r.title)}`,
  }));
}

async function wsPageText(title) {
  const data = await getJson(wsUrl({
    action: "parse", prop: "text", page: title, redirects: "1",
  }));
  return htmlToText(data?.parse?.text?.["*"] || "", WS_DROP);
}

/* Wikisource splits long books into "Book/Chapter" subpages; short ones sit on
   a single page with == headings ==. Handle both, and cap the subpage fan-out
   so opening a book can't fire off hundreds of requests. */
const WS_MAX_CHAPTERS = 60;

export async function fetchWikisourceBook(title, onProgress) {
  onProgress?.(0, 1);
  const listed = await getJson(wsUrl({
    action: "query", list: "allpages", apprefix: `${title}/`,
    apnamespace: "0", aplimit: String(WS_MAX_CHAPTERS),
  }));
  const subpages = (listed?.query?.allpages || []).map((p) => p.title);

  const chapters = [];
  let truncated = false;

  if (subpages.length) {
    const wanted = subpages.slice(0, WS_MAX_CHAPTERS);
    truncated = subpages.length > wanted.length;
    for (let i = 0; i < wanted.length; i++) {
      const text = await wsPageText(wanted[i]);
      if (text) chapters.push({ title: wanted[i].slice(title.length + 1), text });
      onProgress?.(i + 1, wanted.length);
    }
  } else {
    const text = await wsPageText(title);
    if (text) chapters.push(...splitOnHeadings(text));
    onProgress?.(1, 1);
  }

  if (!chapters.length) throw new Error("that page has no readable text — it may be an index or a scan");
  return {
    title,
    chapters,
    truncated,
    src: {
      name: "Hebrew Wikisource",
      license: "Public domain / CC BY-SA",
      url: `https://he.wikisource.org/wiki/${encodeURIComponent(title)}`,
    },
  };
}

/* A single-page book keeps its section headings inline after the HTML is
   flattened; short standalone lines become chapter breaks. */
function splitOnHeadings(text) {
  const lines = text.split("\n");
  const out = [];
  let cur = { title: "", text: "" };
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    const heading = l.length <= 40 && !/[.!?…:,;"']$/.test(l) && l.split(/\s+/).length <= 6;
    if (heading && cur.text.trim().length > 200) {
      out.push(cur);
      cur = { title: l, text: "" };
    } else {
      cur.text += (cur.text ? "\n" : "") + l;
    }
  }
  if (cur.text.trim()) out.push(cur);
  return out.length ? out : [{ title: "", text }];
}

/* ================================================================== */
/* Wikibooks — the grammar reference                                   */
/* ================================================================== */

/* English Wikibooks hosts a Hebrew course under CC BY-SA. Its prose is thin —
   the lessons are more outline than text — but its alphabet pages and verb
   tables are exactly the reference a reader wants beside a book, and they are
   the one openly-licensed thing of their kind. Imported as reference sections,
   not as reading. */

const WB_API = "https://en.wikibooks.org/w/api.php";
const wbUrl = (params) =>
  `${WB_API}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`;

export const WIKIBOOKS_SECTIONS = [
  { prefix: "Hebrew/Aleph-Bet", title: "The alphabet", note: "Letters, sounds and writing, page by page" },
  { prefix: "Hebrew/Verbs", title: "Verbs", note: "Binyanim and conjugation tables" },
  { prefix: "Hebrew/Basic", title: "Basic grammar", note: "Gender, number, the definite article" },
  { prefix: "Hebrew/Elementary", title: "Elementary lessons", note: "Early sentence patterns" },
  { prefix: "Hebrew/Vocabulary", title: "Vocabulary lists", note: "Themed word lists" },
];

export async function fetchWikibooksSection(section, onProgress) {
  onProgress?.(0, 1);
  const listed = await getJson(wbUrl({
    action: "query", list: "allpages", apprefix: `${section.prefix}/`,
    apnamespace: "0", aplimit: "60",
  }));
  /* the section's own page comes first, then its subpages in order */
  const pages = [section.prefix, ...(listed?.query?.allpages || []).map((p) => p.title)];

  const chapters = [];
  for (let i = 0; i < pages.length; i++) {
    const data = await getJson(wbUrl({ action: "parse", prop: "text", page: pages[i], redirects: "1" }));
    const text = htmlToText(data?.parse?.text?.["*"] || "", WS_DROP);
    if (text) {
      chapters.push({ title: pages[i].slice(section.prefix.length + 1) || section.title, text });
    }
    onProgress?.(i + 1, pages.length);
  }
  if (!chapters.length) throw new Error("that section came back empty");

  return {
    title: `Hebrew · ${section.title}`,
    chapters,
    src: {
      name: "Wikibooks",
      license: "CC BY-SA 4.0",
      credit: "Wikibooks contributors",
      url: `https://en.wikibooks.org/wiki/${encodeURIComponent(section.prefix)}`,
    },
  };
}

/* ================================================================== */
/* Project Ben-Yehuda — modern Hebrew literature (free key)            */
/* ================================================================== */

const BY_API = "https://benyehuda.org/api/v1";
const BY_KEY_STORE = "lavan-benyehuda-key";

export const BENYEHUDA_KEY_URL = "https://benyehuda.org/api_keys/new";

const safeGet = (k) => { try { return window.localStorage.getItem(k); } catch (e) { return null; } };
const safeSet = (k, v) => { try { window.localStorage.setItem(k, v); } catch (e) {} };
const safeDel = (k) => { try { window.localStorage.removeItem(k); } catch (e) {} };

export const getBenYehudaKey = () => safeGet(BY_KEY_STORE) || "";
export const setBenYehudaKey = (k) => (k && k.trim() ? safeSet(BY_KEY_STORE, k.trim()) : safeDel(BY_KEY_STORE));
export const hasBenYehudaKey = () => !!getBenYehudaKey();

/* Ben-Yehuda's own documentation gives this request body verbatim, minus the
   free-text field: their Swagger spec (the only place that names it) is
   returning a 500, so the field name below is the one detail here that isn't
   confirmed against the source. If free-text search ever comes back
   unfiltered, this constant is the single line to correct. */
const BY_QUERY_FIELD = "search_query";

export const BY_GENRES = [
  { id: "poetry", label: "Poetry · שירה" },
  { id: "prose", label: "Prose · פרוזה" },
  { id: "drama", label: "Drama · מחזות" },
  { id: "fables", label: "Fables · משלים" },
  { id: "article", label: "Essays · מאמרים" },
  { id: "memoir", label: "Memoir · זכרונות" },
  { id: "letters", label: "Letters · מכתבים" },
  { id: "reference", label: "Reference · עיון" },
];

export const BY_SORTS = [
  { id: "alphabetical", label: "A–Z" },
  { id: "popularity", label: "Most read" },
  { id: "publication_date", label: "Newest" },
];

/* The search response shape isn't documented either, so read it tolerantly:
   pull the first list-shaped value, and accept any of the usual field names. */
const pick = (obj, names, fallback = "") => {
  for (const n of names) {
    const v = obj?.[n];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
};

function byResultList(data) {
  if (Array.isArray(data)) return data;
  for (const k of ["data", "results", "works", "texts", "items", "records"]) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  const firstArray = Object.values(data || {}).find((v) => Array.isArray(v));
  return firstArray || [];
}

function byNormalize(item) {
  const author = pick(item, ["author_string", "author", "authors", "creator", "authority_name"]);
  return {
    id: pick(item, ["id", "text_id", "work_id", "manifestation_id"]),
    title: pick(item, ["title", "name", "work_title"], "—"),
    author: Array.isArray(author) ? author.join(", ") : String(author || ""),
    genre: pick(item, ["genre", "genres"]),
    year: pick(item, ["publication_date", "pby_publication_date", "year", "orig_publication_date"]),
  };
}

async function byPost(path, body) {
  return getJson(`${BY_API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
}

export async function searchBenYehuda({ query = "", genres = [], page = 0, sortBy = "alphabetical" } = {}, key) {
  const apiKey = key || getBenYehudaKey();
  if (!apiKey) throw new Error("add your free Ben-Yehuda key first");
  const body = {
    key: apiKey,
    view: "basic",
    file_format: "txt",
    snippet: false,
    page,
    sort_by: sortBy,
    sort_dir: "default",
  };
  if (genres.length) body.genres = genres;
  const q = String(query || "").trim();
  if (q) body[BY_QUERY_FIELD] = q;

  const data = await byPost("/search", body);
  const items = byResultList(data).map(byNormalize).filter((r) => r.id);
  return { items, total: Number(pick(data, ["total_count", "total", "count"], items.length)) };
}

/* A single work, as plain text. Ben-Yehuda serves html/txt/epub/pdf/docx;
   txt needs no cleaning and keeps the download small. */
export async function fetchBenYehudaText(id, key) {
  const apiKey = key || getBenYehudaKey();
  if (!apiKey) throw new Error("add your free Ben-Yehuda key first");
  const params = new URLSearchParams({ key: apiKey, view: "basic", file_format: "txt" });
  const data = await getJson(`${BY_API}/texts/${encodeURIComponent(id)}?${params}`);

  const meta = byNormalize(data.metadata || data);
  let text = pick(data, ["text", "content", "body", "download_url"], "");

  /* Some formats come back as a link to the file rather than the text */
  if (/^https?:\/\//.test(text)) {
    const r = await fetch(text);
    if (!r.ok) throw new Error("couldn't download that work");
    text = await r.text();
  }
  if (/<[a-z][\s\S]*>/i.test(text)) text = htmlToText(text);
  text = String(text || "").trim();
  if (!text) throw new Error("that work came back empty");

  const title = meta.title && meta.title !== "—" ? meta.title : `Ben-Yehuda ${id}`;
  return {
    title: meta.author ? `${title} — ${meta.author}` : title,
    text,
    src: {
      name: "Project Ben-Yehuda",
      license: "Public domain",
      url: `https://benyehuda.org/read/${encodeURIComponent(id)}`,
    },
  };
}

/* Verifies a key before it is saved, the way the AI providers' keys are. */
export async function testBenYehudaKey(key) {
  const trimmed = String(key || "").trim();
  if (!trimmed) throw new Error("paste a key first");
  await searchBenYehuda({ genres: ["poetry"], page: 0 }, trimmed);
  return true;
}
