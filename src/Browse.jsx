/* Browse — open public-domain Hebrew books straight from three online
   libraries. Downloading happens here (with progress); the finished book is
   handed to the app, which paginates and stores it exactly like an imported
   file. */

import { useState, useEffect, useRef } from "react";
import {
  Search, Loader, ChevronRight, ChevronLeft, KeyRound, Eye, EyeOff, Check,
  FolderOpen, FileText, User,
} from "lucide-react";
import {
  SHELF_LEVELS, fetchShelfIndex, fetchShelfBook,
  SEFARIA_SHELF, fetchSefariaBook,
  searchWikisource, fetchWikisourceBook,
  WS_SHELVES, fetchWikisourceCategory,
  BY_GENRES, BY_SORTS, BENYEHUDA_KEY_URL,
  searchBenYehuda, fetchBenYehudaText,
  getBenYehudaKey, setBenYehudaKey, testBenYehudaKey,
  fetchAuthorIndex, fetchAuthorWorks, BY_GENRE_LABELS,
  WIKIBOOKS_SECTIONS, fetchWikibooksSection,
} from "./library.js";
import { useEnglishTitles } from "./titles.js";

const SOURCES = [
  { id: "shelf", label: "Shelf" },
  { id: "grammar", label: "Grammar" },
  { id: "sefaria", label: "Sefaria" },
  { id: "wikisource", label: "Wikisource" },
  { id: "benyehuda", label: "Ben-Yehuda" },
];

const LEVEL_LABEL = { easiest: "easiest", easier: "easier", medium: "medium", harder: "harder" };

export default function BrowseScreen({ C, HEB_FONT, UI_FONT, onImport, translateTitles }) {
  const [tab, setTab] = useState("shelf");
  const [busy, setBusy] = useState(null);   /* {label, done, total} */
  const [error, setError] = useState("");

  /* Shelf */
  const [shelf, setShelf] = useState(null);
  const [shelfLevel, setShelfLevel] = useState(1);
  const [shelfErr, setShelfErr] = useState("");

  /* Wikisource — a search, and a category tree to walk when you haven't got
     a search in mind. `wsPath` is the breadcrumb: [] is the shelf list. */
  const [wsQuery, setWsQuery] = useState("");
  const [wsResults, setWsResults] = useState(null);
  const [wsSearching, setWsSearching] = useState(false);
  const [wsPath, setWsPath] = useState([]);          /* [{cat, label}] */
  const [wsCat, setWsCat] = useState(null);          /* {cats, pages} */
  const [wsCatLoading, setWsCatLoading] = useState(false);
  const [wsShown, setWsShown] = useState(60);

  /* Ben-Yehuda */
  const [byKey, setByKeyVal] = useState("");
  const [byShowKey, setByShowKey] = useState(false);
  const [byKeyStatus, setByKeyStatus] = useState(null); /* {kind, msg} */
  const [byQuery, setByQuery] = useState("");
  const [byGenre, setByGenre] = useState("poetry");
  const [bySort, setBySort] = useState("alphabetical");
  const [byResults, setByResults] = useState(null);
  const [bySearching, setBySearching] = useState(false);
  const [byPage, setByPage] = useState(0);
  const [byMode, setByMode] = useState("authors");   /* authors | search */
  const [byKeyOpen, setByKeyOpen] = useState(false);

  /* The author directory, bundled with the app */
  const [authors, setAuthors] = useState(null);
  const [authorsErr, setAuthorsErr] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [author, setAuthor] = useState(null);        /* the opened author */
  const [authorLoading, setAuthorLoading] = useState(false);
  const [authorGenre, setAuthorGenre] = useState("");
  const [authorShown, setAuthorShown] = useState(40);
  const [dirShown, setDirShown] = useState(60);

  const wsInput = useRef(null);

  useEffect(() => {
    setByKeyVal(getBenYehudaKey());
    if (!shelf) {
      fetchShelfIndex()
        .then(setShelf)
        .catch((e) => setShelfErr(e.message || "couldn't read the shelf"));
    }
  }, []);

  /* Load the directory the first time the tab is opened, not on every visit */
  useEffect(() => {
    if (tab !== "benyehuda" || authors || authorsErr) return;
    fetchAuthorIndex()
      .then(setAuthors)
      .catch((e) => setAuthorsErr(e.message || "couldn't read the directory"));
  }, [tab]);

  const hasKey = !!getBenYehudaKey();

  /* ---------------- downloading ---------------- */
  const download = async (label, fetcher) => {
    setError("");
    setBusy({ label, done: 0, total: 1 });
    try {
      const book = await fetcher((done, total) => setBusy({ label, done, total }));
      setBusy(null);
      onImport(book);
    } catch (e) {
      setBusy(null);
      setError(e.message || "that download didn't work — try again");
    }
  };

  const openShelf = (entry) =>
    download(entry.title, async () => {
      const { title, text, src } = await fetchShelfBook(entry);
      return { title, chapters: null, text, src };
    });

  const openGrammar = (section) =>
    download(section.title, (p) => fetchWikibooksSection(section, p));

  const openSefaria = (entry) =>
    download(`${entry.en}`, (p) => fetchSefariaBook(entry, p));

  const openWikisource = (title) =>
    download(title, (p) => fetchWikisourceBook(title, p));

  const openBenYehuda = (item, knownAuthor) => {
    /* Browsing needs no key, so this is the first place many people meet the
       requirement — open the box rather than just naming it. */
    if (!getBenYehudaKey()) {
      setByKeyOpen(true);
      setError("Ben-Yehuda needs a key before it will hand over a work — add yours above.");
      return;
    }
    return download(item.title, async () => {
      const { title, text, src } = await fetchBenYehudaText(item.id, null, {
        title: item.title, author: item.author || knownAuthor || "",
      });
      return { title, chapters: null, text, src };
    });
  };

  /* ---------------- walking Wikisource's categories ---------------- */
  const openCategory = async (cat, label) => {
    setError("");
    setWsCatLoading(true);
    setWsResults(null);
    try {
      const body = await fetchWikisourceCategory(cat);
      setWsCat(body);
      setWsShown(60);
      setWsPath((p) => [...p, { cat, label }]);
    } catch (e) {
      setError(e.message || "couldn't open that shelf");
    } finally {
      setWsCatLoading(false);
    }
  };

  /* Going back re-fetches rather than caching each level: a step back is one
     small request, and the alternative is a stack of stale category listings. */
  const upOneCategory = async () => {
    const back = wsPath.slice(0, -1);
    setWsPath(back);
    setWsCat(null);
    const parent = back[back.length - 1];
    if (!parent) return;
    setWsCatLoading(true);
    try {
      setWsCat(await fetchWikisourceCategory(parent.cat));
      setWsShown(60);
    } catch (e) {
      setError(e.message || "couldn't go back — try a shelf below");
      setWsPath([]);
    } finally {
      setWsCatLoading(false);
    }
  };

  /* ---------------- the Ben-Yehuda author directory ---------------- */
  const openAuthor = async (entry) => {
    setError("");
    setAuthorLoading(true);
    setAuthorGenre("");
    setAuthorShown(40);
    try {
      setAuthor(await fetchAuthorWorks(entry.i));
    } catch (e) {
      setError(e.message || "couldn't open that writer");
    } finally {
      setAuthorLoading(false);
    }
  };

  /* ---------------- searches ---------------- */
  const runWsSearch = async () => {
    const q = wsQuery.trim();
    if (!q) return;
    setWsSearching(true);
    setError("");
    setWsPath([]);
    setWsCat(null);
    try {
      setWsResults(await searchWikisource(q));
    } catch (e) {
      setError(e.message || "that search didn't work");
      setWsResults([]);
    } finally {
      setWsSearching(false);
    }
  };

  const runBySearch = async (page = 0) => {
    if (!getBenYehudaKey()) {
      setByKeyOpen(true);
      setError("Ben-Yehuda's search needs a key — add yours above.");
      return;
    }
    setBySearching(true);
    setError("");
    try {
      const { items } = await searchBenYehuda({
        query: byQuery.trim(), genres: byGenre ? [byGenre] : [], page, sortBy: bySort,
      });
      setByResults(items);
      setByPage(page);
    } catch (e) {
      setError(e.message || "that search didn't work");
      setByResults([]);
    } finally {
      setBySearching(false);
    }
  };

  const saveByKey = async () => {
    const trimmed = byKey.trim();
    if (!trimmed) {
      setBenYehudaKey("");
      setByKeyStatus({ kind: "ok", msg: "Key removed." });
      return;
    }
    setByKeyStatus({ kind: "testing", msg: "Checking your key…" });
    try {
      await testBenYehudaKey(trimmed);
      setBenYehudaKey(trimmed);
      setByKeyStatus({ kind: "ok", msg: "Connected — Ben-Yehuda's catalogue is open." });
    } catch (e) {
      setByKeyStatus({
        kind: "error",
        msg: e.status === 401 ? "Ben-Yehuda rejected that key — check it and try again."
          : `Couldn't reach Ben-Yehuda: ${e.message}`,
      });
    }
  };

  /* Both long lists page in chunks, so a writer with 500 works costs one
     screenful of translation rather than 500 titles' worth. */
  const authorWorks = author ? author.works.filter((w) => !authorGenre || w.genre === authorGenre) : [];
  const authorWorksShown = authorWorks.slice(0, authorShown);
  const wsPagesShown = (wsCat?.pages || []).slice(0, wsShown);

  /* Everything on screen that is a Hebrew title or shelf name. Sefaria and the
     bundled shelf already carry their English, so only these two libraries —
     whose lists arrive live, or as bare catalogue rows — need translating. */
  const onScreen = [
    ...(wsCat?.cats || []).map((c) => c.label),
    ...wsPagesShown.map((p) => p.title),
    ...(wsResults || []).map((r) => r.title),
    ...(author ? authorWorksShown : byResults || []).map((w) => w.title),
  ];
  const en = useEnglishTitles(onScreen, translateTitles);

  /* ---------------- shared bits ---------------- */
  const rowStyle ={ display: "flex", alignItems: "center", gap: 12, width: "100%", background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 14, padding: "12px 14px", marginTop: 8, cursor: "pointer", textAlign: "left", fontFamily: UI_FONT, color: C.ink };

  /* .primary-btn is width:100% for standalone use; beside an input it has to
     shrink to its label or it squeezes the field to nothing. */
  const inlineBtn = { width: "auto", flex: "0 0 auto" };
  const fieldStyle = { flex: 1, minWidth: 0 };

  /* Level colour runs green (easiest) to red (hardest); `tone` keeps the
     plain green/blue/neutral chips used elsewhere. */
  const Chip = ({ children, tone, level }) => (
    <span style={{
      fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
      background: level ? C.lvBg[level - 1] : tone === "green" ? C.greenSoft : tone === "blue" ? C.blueSoft : C.soft,
      color: level ? C.lvInk[level - 1] : tone === "green" ? C.green : tone === "blue" ? C.blue : C.sub,
      whiteSpace: "nowrap",
    }}>{children}</span>
  );

  return (
    <main style={{ paddingTop: 18 }} aria-label="Browse public-domain libraries">
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Free Hebrew books</div>
      <div className="seg" role="group" aria-label="Library source" style={{ margin: "10px 0 4px" }}>
        {SOURCES.map((s) => (
          <button key={s.id} className={tab === s.id ? "on" : ""} onClick={() => { setTab(s.id); setError(""); }}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ paddingBottom: 24 }}>

        {busy && (
          <div style={{ textAlign: "center", padding: "14px 0 4px" }}>
            <Loader size={22} color={C.blue} className="spin" />
            <div style={{ fontSize: 14.5, fontWeight: 500, marginTop: 8 }}>Downloading “{busy.label}”…</div>
            {busy.total > 1 && (
              <>
                <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>{busy.done} of {busy.total} chapters</div>
                <div style={{ height: 6, background: C.soft, borderRadius: 999, marginTop: 10, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round((busy.done / Math.max(busy.total, 1)) * 100)}%`, background: C.blue, transition: "width .3s" }} />
                </div>
              </>
            )}
          </div>
        )}

        {error && !busy && (
          <div style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.5, borderRadius: 10, padding: "9px 12px", background: C.redSoft, color: C.red }}>
            {error}
          </div>
        )}

        {/* ---------------- Shelf ---------------- */}
        {tab === "shelf" && !busy && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
              Short works from Project Ben-Yehuda, graded by how much of each is written in the 2,000
              commonest Hebrew words — green is easiest, red hardest. Bundled with the app: no key, and
              they open offline. Titles are romanized where the Hebrew is vocalized enough to sound out.
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              {SHELF_LEVELS.map((l) => (
                <button
                  key={l.id}
                  className="chip"
                  onClick={() => setShelfLevel(l.id)}
                  style={{
                    border: `1.5px solid ${shelfLevel === l.id ? C.lvInk[l.id - 1] : C.line}`,
                    background: shelfLevel === l.id ? C.lvBg[l.id - 1] : C.card,
                    color: shelfLevel === l.id ? C.lvInk[l.id - 1] : C.sub,
                    borderRadius: 999, padding: "5px 11px", fontSize: 12.5,
                    fontWeight: shelfLevel === l.id ? 600 : 500,
                    fontFamily: UI_FONT, cursor: "pointer",
                  }}
                >
                  <span style={{ color: C.lvInk[l.id - 1], fontWeight: 700 }}>{l.id}</span> · {l.label}
                </button>
              ))}
            </div>

            {shelfErr && (
              <div style={{ marginTop: 12, fontSize: 13.5, color: C.sub, lineHeight: 1.5 }}>
                The bundled shelf isn't available in this build ({shelfErr}). The other three libraries
                still work.
              </div>
            )}
            {!shelf && !shelfErr && (
              <div style={{ textAlign: "center", padding: "18px 0" }}>
                <Loader size={20} color={C.blue} className="spin" />
              </div>
            )}

            {(shelf?.books || []).filter((b) => b.level === shelfLevel).map((b) => (
              <button key={b.id} style={rowStyle} onClick={() => openShelf(b)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontWeight: 600, fontSize: 16, lineHeight: 1.4 }}>{b.title}</div>
                  {/* what the title means, with how it sounds alongside it */}
                  {(b.titleTranslated || b.titleEn) && (
                    <div dir="ltr" style={{ fontSize: 13.5, color: C.ink, marginTop: 2, fontWeight: 500 }}>
                      {b.titleTranslated || b.titleEn}
                      {b.titleTranslated && b.titleEn && (
                        <span style={{ color: C.sub, fontWeight: 400 }}> · {b.titleEn}</span>
                      )}
                    </div>
                  )}
                  {/* the separator stays in the ltr run — inside the rtl span
                      it renders on the far side of the Hebrew name */}
                  <div dir="ltr" style={{ fontSize: 12.5, color: C.sub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.authorEn}
                    {b.authorEn && b.author ? " · " : ""}
                    <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT }}>{b.author}</span>
                    {b.authorNote ? ` — ${b.authorNote}` : ""}
                  </div>
                  {/* A one-line English summary where the shelf has one; where
                      it doesn't, the book's own opening lines stand in. */}
                  {b.summary ? (
                    <div dir="ltr" style={{
                      fontSize: 13, color: C.sub, marginTop: 6, lineHeight: 1.5,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {b.summary}
                    </div>
                  ) : b.blurb ? (
                    <div dir="rtl" lang="he" style={{
                      fontFamily: HEB_FONT, fontSize: 14, color: C.sub, marginTop: 6, lineHeight: 1.6,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {b.blurb}
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                    <Chip level={b.level}>{b.coverage}% common words</Chip>
                    <Chip>{b.minutes} min</Chip>
                    {b.nikkud && <Chip tone="green">nikkud</Chip>}
                    <Chip>{b.genre}</Chip>
                  </div>
                </div>
                <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
              </button>
            ))}

            {shelf && (
              <div style={{ fontSize: 12, color: C.sub, marginTop: 14, lineHeight: 1.5, opacity: 0.85 }}>
                {shelf.books.length} works · public domain, digitised by {shelf.credit}
                {shelf.version ? ` · dump ${shelf.version}` : ""}
              </div>
            )}
          </div>
        )}

        {/* ---------------- Grammar (Wikibooks) ---------------- */}
        {tab === "grammar" && !busy && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
              Wikibooks' Hebrew course, under CC BY-SA. Thin on reading, but its alphabet pages and verb
              tables are the reference to keep beside a book. No key needed.
            </div>
            {WIKIBOOKS_SECTIONS.map((s) => (
              <button key={s.prefix} style={rowStyle} onClick={() => openGrammar(s)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15.5 }}>{s.title}</div>
                  <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>{s.note}</div>
                </div>
                <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
              </button>
            ))}
            <div style={{ fontSize: 12, color: C.sub, marginTop: 14, lineHeight: 1.5, opacity: 0.85 }}>
              Text by Wikibooks contributors, CC BY-SA 4.0
            </div>
          </div>
        )}

        {/* ---------------- Sefaria ---------------- */}
        {tab === "sefaria" && !busy && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
              Classical texts, fully vocalized. No sign-up — tap a title to download it.
            </div>
            {SEFARIA_SHELF.map((b) => (
              <button key={b.ref} style={rowStyle} onClick={() => openSefaria(b)}>
                <div className="book-cover" style={{ background: C.blueSoft, color: C.blue, flexShrink: 0 }}>
                  <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontWeight: 700, fontSize: 15, lineHeight: 1.1, textAlign: "center", padding: 2 }}>
                    {b.he.split(" ")[0]}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontWeight: 700, fontSize: 16.5 }}>{b.he}</div>
                  <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{b.en} · {b.chapters} chapters</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                    <Chip tone={b.level === "easiest" || b.level === "easier" ? "green" : b.level === "medium" ? "blue" : undefined}>
                      {LEVEL_LABEL[b.level]}
                    </Chip>
                    <Chip>{b.note}</Chip>
                  </div>
                </div>
                <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}

        {/* ---------------- Wikisource ---------------- */}
        {tab === "wikisource" && !busy && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
              Hebrew Wikisource — novels, poetry, essays and translations in the public domain. No
              sign-up. Open a shelf to see what's there, or search if you have a title in mind.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                ref={wsInput}
                className="text-input"
                dir="rtl" lang="he"
                style={{ ...fieldStyle, fontFamily: HEB_FONT, fontSize: 16 }}
                value={wsQuery}
                onChange={(e) => setWsQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runWsSearch(); }}
                placeholder="שם ספר או מחבר…"
                aria-label="Search Hebrew Wikisource"
              />
              <button className="primary-btn" style={{ ...inlineBtn, padding: "0 16px" }} onClick={runWsSearch} disabled={wsSearching || !wsQuery.trim()}>
                {wsSearching ? <Loader size={16} className="spin" /> : <Search size={16} />}
              </button>
            </div>

            {/* --- search results --- */}
            {wsResults && !wsResults.length && !wsSearching && (
              <div style={{ fontSize: 13.5, color: C.sub, marginTop: 12 }}>Nothing found for that. Try the author's name in Hebrew, or open a shelf below.</div>
            )}

            {(wsResults || []).map((r) => (
              <button key={r.title} style={rowStyle} onClick={() => openWikisource(r.title)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontWeight: 600, fontSize: 16, lineHeight: 1.4 }}>{r.title}</div>
                  {en(r.title) && (
                    <div dir="ltr" style={{ fontSize: 13.5, color: C.ink, marginTop: 2, fontWeight: 500 }}>{en(r.title)}</div>
                  )}
                  <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3 }}>
                    {r.words ? `${r.words.toLocaleString()} words` : "Wikisource"}
                  </div>
                </div>
                <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
              </button>
            ))}

            {/* --- browsing the category tree --- */}
            {!wsResults && (
              <>
                {wsPath.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <button className="ghost-btn" style={{ ...inlineBtn, padding: "0 12px", height: 34 }} onClick={upOneCategory}>
                      <ChevronLeft size={15} style={{ verticalAlign: "-3px" }} /> Back
                    </button>
                    <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 15.5, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {wsPath[wsPath.length - 1].label}
                    </div>
                  </div>
                )}

                {wsCatLoading && (
                  <div style={{ textAlign: "center", padding: "18px 0" }}>
                    <Loader size={20} color={C.blue} className="spin" />
                  </div>
                )}

                {/* the top level: curated shelves with English names */}
                {!wsPath.length && !wsCatLoading && WS_SHELVES.map((s) => (
                  <button key={s.cat} style={rowStyle} onClick={() => openCategory(s.cat, s.cat)}>
                    <FolderOpen size={17} color={C.blue} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15.5 }}>
                        {s.title}
                        <span dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, color: C.sub, fontWeight: 400, marginInlineStart: 7 }}>{s.cat}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>{s.note}</div>
                    </div>
                    <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
                  </button>
                ))}

                {/* inside a shelf: its subcategories, then its own works */}
                {wsCat && !wsCatLoading && (
                  <>
                    {wsCat.cats.length > 0 && (
                      <div style={{ fontSize: 12, color: C.sub, marginTop: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>
                        {wsCat.cats.length} shelves
                      </div>
                    )}
                    {wsCat.cats.map((c) => (
                      <button key={c.title} style={rowStyle} onClick={() => openCategory(c.title, c.label)}>
                        <FolderOpen size={17} color={C.blue} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 16, fontWeight: 600 }}>{c.label}</div>
                          {en(c.label) && <div dir="ltr" style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{en(c.label)}</div>}
                        </div>
                        <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
                      </button>
                    ))}

                    {wsCat.pages.length > 0 && (
                      <div style={{ fontSize: 12, color: C.sub, marginTop: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>
                        {wsCat.pages.length} to read
                      </div>
                    )}
                    {wsPagesShown.map((p) => (
                      <button key={p.title} style={rowStyle} onClick={() => openWikisource(p.title)}>
                        <FileText size={17} color={C.sub} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontWeight: 600, fontSize: 16, lineHeight: 1.4 }}>{p.title}</div>
                          {en(p.title) && (
                            <div dir="ltr" style={{ fontSize: 13.5, color: C.ink, marginTop: 2, fontWeight: 500 }}>{en(p.title)}</div>
                          )}
                          {p.minutes > 0 && (
                            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3 }}>≈ {p.minutes} min</div>
                          )}
                        </div>
                        <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
                      </button>
                    ))}

                    {wsCat.pages.length > wsPagesShown.length && (
                      <button className="ghost-btn" style={{ marginTop: 10 }} onClick={() => setWsShown((n) => n + 60)}>
                        Show more ({wsCat.pages.length - wsPagesShown.length} left)
                      </button>
                    )}

                    {!wsCat.cats.length && !wsCat.pages.length && (
                      <div style={{ fontSize: 13.5, color: C.sub, marginTop: 14, lineHeight: 1.5 }}>
                        This shelf is empty — Wikisource keeps some categories for housekeeping. Go back
                        and try another.
                      </div>
                    )}
                  </>
                )}

                <div style={{ fontSize: 12, color: C.sub, marginTop: 16, lineHeight: 1.5, opacity: 0.85 }}>
                  Times are estimates from the page's size. A book split into chapters downloads all of
                  them, so it will take longer than its own page suggests.
                </div>
              </>
            )}

            {wsResults && (
              <button className="ghost-btn" style={{ marginTop: 12 }} onClick={() => { setWsResults(null); setWsQuery(""); }}>
                Back to the shelves
              </button>
            )}
          </div>
        )}

        {/* ---------------- Ben-Yehuda ---------------- */}
        {tab === "benyehuda" && !busy && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
              Project Ben-Yehuda holds the modern Hebrew canon — some 65,000 works by 4,400 writers, all
              public domain. Browsing the writers below costs nothing; opening a work needs a free key,
              issued instantly.
            </div>

            {/* The key box is a wall of form to put in front of a library, so it
                folds away once a key is saved — and stays a banner until then. */}
            {!hasKey && !byKeyOpen && (
              <div style={{ background: C.blueSoft, border: `1px solid ${C.blueLine}`, borderRadius: 12, padding: "10px 12px", fontSize: 13, color: C.blue, marginTop: 10, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 180 }}>
                  Look around freely — you'll need a key from{" "}
                  <a className="inline-link" href={BENYEHUDA_KEY_URL} target="_blank" rel="noreferrer">benyehuda.org</a>{" "}
                  to open anything. It's stored only in this browser.
                </span>
                <button className="ghost-btn" style={{ ...inlineBtn, padding: "0 12px", height: 32 }} onClick={() => setByKeyOpen(true)}>
                  <KeyRound size={13} style={{ verticalAlign: "-2px" }} /> Add key
                </button>
              </div>
            )}
            {hasKey && !byKeyOpen && (
              <button className="ghost-btn" style={{ ...inlineBtn, padding: "0 12px", height: 32, marginTop: 10, fontSize: 12.5 }} onClick={() => setByKeyOpen(true)}>
                <KeyRound size={13} style={{ verticalAlign: "-2px" }} /> Key saved — change it
              </button>
            )}

            {byKeyOpen && (
              <>
                <div className="field-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <KeyRound size={13} /> Ben-Yehuda key
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="text-input"
                    style={fieldStyle}
                    type={byShowKey ? "text" : "password"}
                    value={byKey}
                    onChange={(e) => { setByKeyVal(e.target.value); setByKeyStatus(null); }}
                    placeholder="paste your key"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button className="ghost-btn" style={{ ...inlineBtn, padding: "0 14px" }} onClick={() => setByShowKey((v) => !v)} aria-label={byShowKey ? "Hide key" : "Show key"}>
                    {byShowKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button className="primary-btn" style={{ ...inlineBtn, padding: "0 16px" }} onClick={saveByKey} disabled={byKeyStatus?.kind === "testing"}>
                    {byKeyStatus?.kind === "testing" ? "…" : "Save"}
                  </button>
                </div>
                {byKeyStatus && (
                  <div style={{
                    marginTop: 8, fontSize: 13, lineHeight: 1.5, borderRadius: 10, padding: "8px 11px",
                    background: byKeyStatus.kind === "error" ? C.redSoft : byKeyStatus.kind === "ok" ? C.greenSoft : C.soft,
                    color: byKeyStatus.kind === "error" ? C.red : byKeyStatus.kind === "ok" ? C.green : C.sub,
                  }}>
                    {byKeyStatus.kind === "ok" && <Check size={13} strokeWidth={2.6} style={{ verticalAlign: "-2px", marginInlineEnd: 4 }} />}
                    {byKeyStatus.msg}
                  </div>
                )}
                {!hasKey && (
                  <div style={{ fontSize: 12.5, color: C.sub, marginTop: 8, lineHeight: 1.5 }}>
                    Get one at <a className="inline-link" href={BENYEHUDA_KEY_URL} target="_blank" rel="noreferrer">benyehuda.org</a> — it arrives by email in a moment.
                  </div>
                )}
              </>
            )}

            <div className="seg" role="group" aria-label="How to find a work" style={{ margin: "12px 0 0" }}>
              <button className={byMode === "authors" ? "on" : ""} onClick={() => { setByMode("authors"); setError(""); }}>Writers</button>
              <button className={byMode === "search" ? "on" : ""} onClick={() => { setByMode("search"); setError(""); }}>Search</button>
            </div>

            {/* ---- the directory ---- */}
            {byMode === "authors" && (
              <>
                {authorsErr && (
                  <div style={{ fontSize: 13.5, color: C.sub, marginTop: 14, lineHeight: 1.5 }}>
                    The writer directory isn't in this build ({authorsErr}). Search still works.
                  </div>
                )}
                {!authors && !authorsErr && (
                  <div style={{ textAlign: "center", padding: "18px 0" }}>
                    <Loader size={20} color={C.blue} className="spin" />
                  </div>
                )}

                {/* one writer's shelf */}
                {author ? (
                  <>
                    <button className="ghost-btn" style={{ ...inlineBtn, padding: "0 12px", height: 34, marginTop: 14 }} onClick={() => setAuthor(null)}>
                      <ChevronLeft size={15} style={{ verticalAlign: "-3px" }} /> All writers
                    </button>
                    <div style={{ marginTop: 12 }}>
                      <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontSize: 21, fontWeight: 700, lineHeight: 1.3 }}>{author.name}</div>
                      {author.nameEn && <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{author.nameEn}</div>}
                      {author.note && <div style={{ fontSize: 13, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>{author.note}</div>}
                      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>
                        {author.works.length} {author.works.length === 1 ? "work" : "works"}
                        {author.total > author.works.length ? ` of ${author.total}` : ""}
                      </div>
                    </div>

                    {(() => {
                      const genres = [...new Set(author.works.map((w) => w.genre).filter(Boolean))];
                      const shown = authorWorksShown;
                      const total = authorWorks.length;
                      return (
                        <>
                          {genres.length > 1 && (
                            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                              {[{ id: "", label: "All" }, ...genres.map((g) => ({ id: g, label: BY_GENRE_LABELS[g] || g }))].map((g) => (
                                <button
                                  key={g.id}
                                  onClick={() => { setAuthorGenre(g.id); setAuthorShown(40); }}
                                  style={{
                                    border: `1.5px solid ${authorGenre === g.id ? C.blue : C.line}`,
                                    background: authorGenre === g.id ? C.blueSoft : C.card,
                                    color: authorGenre === g.id ? C.blue : C.sub,
                                    borderRadius: 999, padding: "5px 11px", fontSize: 12.5,
                                    fontWeight: authorGenre === g.id ? 600 : 500,
                                    fontFamily: UI_FONT, cursor: "pointer",
                                  }}
                                >{g.label}</button>
                              ))}
                            </div>
                          )}

                          {shown.map((w) => (
                            <button key={w.id} style={rowStyle} onClick={() => openBenYehuda(w, author.name)}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontWeight: 600, fontSize: 16, lineHeight: 1.4 }}>{w.title}</div>
                                {en(w.title) && (
                                  <div dir="ltr" style={{ fontSize: 13.5, color: C.ink, marginTop: 2, fontWeight: 500 }}>{en(w.title)}</div>
                                )}
                                <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                                  {w.genre && <Chip>{BY_GENRE_LABELS[w.genre] || w.genre}</Chip>}
                                  {w.translated && <Chip tone="blue">translated</Chip>}
                                </div>
                              </div>
                              <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
                            </button>
                          ))}

                          {total > shown.length && (
                            <button className="ghost-btn" style={{ marginTop: 10 }} onClick={() => setAuthorShown((n) => n + 60)}>
                              Show more ({total - shown.length} left)
                            </button>
                          )}
                        </>
                      );
                    })()}

                    <div style={{ fontSize: 12, color: C.sub, marginTop: 16, lineHeight: 1.5, opacity: 0.85 }}>
                      Public domain, digitised by {authors?.credit || "Project Ben-Yehuda volunteers"}
                    </div>
                  </>
                ) : authors ? (
                  <>
                    {authorLoading && (
                      <div style={{ textAlign: "center", padding: "18px 0" }}>
                        <Loader size={20} color={C.blue} className="spin" />
                      </div>
                    )}
                    <input
                      className="text-input"
                      style={{ marginTop: 12, width: "100%" }}
                      value={authorFilter}
                      onChange={(e) => { setAuthorFilter(e.target.value); setDirShown(60); }}
                      placeholder="Filter by name — English or Hebrew"
                      aria-label="Filter writers"
                    />
                    {(() => {
                      const q = authorFilter.trim().toLowerCase();
                      const matches = authors.authors.filter((a) =>
                        !q || a.name.includes(authorFilter.trim())
                          || a.nameEn.toLowerCase().includes(q) || a.note.toLowerCase().includes(q));
                      const shown = matches.slice(0, dirShown);
                      return (
                        <>
                          <div style={{ fontSize: 12, color: C.sub, marginTop: 10, lineHeight: 1.5 }}>
                            {matches.length === 1 ? "1 writer" : `${matches.length} writers`}
                            {q ? "" : ", the most prolific first"}.
                          </div>
                          {shown.map((a) => (
                            <button key={a.i} style={rowStyle} onClick={() => openAuthor(a)}>
                              <User size={17} color={C.sub} style={{ flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontWeight: 600, fontSize: 16, lineHeight: 1.4 }}>{a.name}</div>
                                {a.nameEn && <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>{a.nameEn}</div>}
                                {a.note && (
                                  <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.note}</div>
                                )}
                                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                                  <Chip>{a.works === 1 ? "1 work" : `${a.works} works`}</Chip>
                                  {a.genres.slice(0, 3).map((g) => <Chip key={g}>{BY_GENRE_LABELS[g] || g}</Chip>)}
                                </div>
                              </div>
                              <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
                            </button>
                          ))}
                          {matches.length > shown.length && (
                            <button className="ghost-btn" style={{ marginTop: 10 }} onClick={() => setDirShown((n) => n + 60)}>
                              Show more ({matches.length - shown.length} left)
                            </button>
                          )}
                          {!matches.length && (
                            <div style={{ fontSize: 13.5, color: C.sub, marginTop: 12 }}>
                              No writer by that name. The directory holds those with three works or more —
                              try Search for the rest.
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : null}
              </>
            )}

            {/* ---- search ---- */}
            {byMode === "search" && (
              <>
                <div className="field-label">Search the catalogue</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="text-input"
                    dir="rtl" lang="he"
                    style={{ ...fieldStyle, fontFamily: HEB_FONT, fontSize: 16 }}
                    value={byQuery}
                    onChange={(e) => setByQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") runBySearch(0); }}
                    placeholder="מילה, שם יצירה או מחבר…"
                    aria-label="Search Project Ben-Yehuda"
                  />
                  <button className="primary-btn" style={{ ...inlineBtn, padding: "0 16px" }} onClick={() => runBySearch(0)} disabled={bySearching}>
                    {bySearching ? <Loader size={16} className="spin" /> : <Search size={16} />}
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <select className="text-input" style={{ flex: 1 }} aria-label="Genre" value={byGenre} onChange={(e) => setByGenre(e.target.value)}>
                    <option value="">Every genre</option>
                    {BY_GENRES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </select>
                  <select className="text-input" style={{ flex: 1 }} aria-label="Sort" value={bySort} onChange={(e) => setBySort(e.target.value)}>
                    {BY_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>

                {byResults && !byResults.length && !bySearching && (
                  <div style={{ fontSize: 13.5, color: C.sub, marginTop: 12 }}>No works matched that.</div>
                )}

                {(byResults || []).map((r) => (
                  <button key={r.id} style={rowStyle} onClick={() => openBenYehuda(r)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div dir="rtl" lang="he" style={{ fontFamily: HEB_FONT, fontWeight: 600, fontSize: 16, lineHeight: 1.4 }}>{r.title}</div>
                      {en(r.title) && (
                        <div dir="ltr" style={{ fontSize: 13.5, color: C.ink, marginTop: 2, fontWeight: 500 }}>{en(r.title)}</div>
                      )}
                      <div dir="rtl" lang="he" style={{ fontSize: 12.5, color: C.sub, marginTop: 3, fontFamily: HEB_FONT }}>
                        {[r.author, r.genre, r.year].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
                  </button>
                ))}

                {byResults && byResults.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button className="ghost-btn" style={{ flex: 1 }} disabled={byPage === 0 || bySearching} onClick={() => runBySearch(byPage - 1)}>Previous</button>
                    <button className="ghost-btn" style={{ flex: 1 }} disabled={bySearching} onClick={() => runBySearch(byPage + 1)}>More</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
