/* Browse — open public-domain Hebrew books straight from three online
   libraries. Downloading happens here (with progress); the finished book is
   handed to the app, which paginates and stores it exactly like an imported
   file. */

import { useState, useEffect, useRef } from "react";
import { Search, Loader, ChevronRight, ChevronLeft, KeyRound, Eye, EyeOff, Check } from "lucide-react";
import {
  SHELF_LEVELS, fetchShelfIndex, fetchShelfBook,
  SEFARIA_SHELF, fetchSefariaBook,
  searchWikisource, fetchWikisourceBook,
  BY_GENRES, BY_SORTS, BENYEHUDA_KEY_URL,
  searchBenYehuda, fetchBenYehudaText,
  getBenYehudaKey, setBenYehudaKey, testBenYehudaKey,
} from "./library.js";

const SOURCES = [
  { id: "shelf", label: "Shelf" },
  { id: "sefaria", label: "Sefaria" },
  { id: "wikisource", label: "Wikisource" },
  { id: "benyehuda", label: "Ben-Yehuda" },
];

const LEVEL_LABEL = { easiest: "easiest", easier: "easier", medium: "medium", harder: "harder" };

export default function BrowseSheet({ open, C, HEB_FONT, UI_FONT, onClose, onImport }) {
  const [tab, setTab] = useState("shelf");
  const [busy, setBusy] = useState(null);   /* {label, done, total} */
  const [error, setError] = useState("");

  /* Shelf */
  const [shelf, setShelf] = useState(null);
  const [shelfLevel, setShelfLevel] = useState(1);
  const [shelfErr, setShelfErr] = useState("");

  /* Wikisource */
  const [wsQuery, setWsQuery] = useState("");
  const [wsResults, setWsResults] = useState(null);
  const [wsSearching, setWsSearching] = useState(false);

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

  const wsInput = useRef(null);

  useEffect(() => {
    if (open) {
      setError("");
      setByKeyVal(getBenYehudaKey());
      setByKeyStatus(null);
      if (!shelf) {
        fetchShelfIndex()
          .then(setShelf)
          .catch((e) => setShelfErr(e.message || "couldn't read the shelf"));
      }
    }
  }, [open]);

  if (!open) return null;

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

  const openSefaria = (entry) =>
    download(`${entry.en}`, (p) => fetchSefariaBook(entry, p));

  const openWikisource = (title) =>
    download(title, (p) => fetchWikisourceBook(title, p));

  const openBenYehuda = (item) =>
    download(item.title, async () => {
      const { title, text, src } = await fetchBenYehudaText(item.id);
      return { title, chapters: null, text, src };
    });

  /* ---------------- searches ---------------- */
  const runWsSearch = async () => {
    const q = wsQuery.trim();
    if (!q) return;
    setWsSearching(true);
    setError("");
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
    if (!getBenYehudaKey()) { setError("add your free Ben-Yehuda key below first"); return; }
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

  /* ---------------- shared bits ---------------- */
  const rowStyle = { display: "flex", alignItems: "center", gap: 12, width: "100%", background: C.card, border: `1.5px solid ${C.line}`, borderRadius: 14, padding: "12px 14px", marginTop: 8, cursor: "pointer", textAlign: "left", fontFamily: UI_FONT, color: C.ink };

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
    <div className="review-wrap" role="dialog" aria-label="Browse public-domain libraries">
      {/* A full screen rather than a bottom sheet: this is a catalogue you
          scroll and search, not a quick confirmation. */}
      <div style={{ position: "sticky", top: 0, zIndex: 3, background: C.paper, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 660, margin: "0 auto", padding: "14px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="icon-btn" onClick={onClose} aria-label="Back to library"><ChevronLeft size={20} /></button>
            <div style={{ flex: 1, fontWeight: 700, fontSize: 17 }}>Free Hebrew books</div>
          </div>
          <div className="seg" role="group" aria-label="Library source" style={{ margin: "12px 0 14px" }}>
            {SOURCES.map((s) => (
              <button key={s.id} className={tab === s.id ? "on" : ""} onClick={() => { setTab(s.id); setError(""); }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 660, margin: "0 auto", padding: "0 16px 48px", width: "100%" }}>

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
                  <div dir="rtl" style={{ fontFamily: HEB_FONT, fontWeight: 600, fontSize: 16, lineHeight: 1.4 }}>{b.title}</div>
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
                    <span dir="rtl" style={{ fontFamily: HEB_FONT }}>{b.author}</span>
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
                    <div dir="rtl" style={{
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

        {/* ---------------- Sefaria ---------------- */}
        {tab === "sefaria" && !busy && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
              Classical texts, fully vocalized. No sign-up — tap a title to download it.
            </div>
            {SEFARIA_SHELF.map((b) => (
              <button key={b.ref} style={rowStyle} onClick={() => openSefaria(b)}>
                <div className="book-cover" style={{ background: C.blueSoft, color: C.blue, flexShrink: 0 }}>
                  <span dir="rtl" style={{ fontFamily: HEB_FONT, fontWeight: 700, fontSize: 15, lineHeight: 1.1, textAlign: "center", padding: 2 }}>
                    {b.he.split(" ")[0]}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div dir="rtl" style={{ fontFamily: HEB_FONT, fontWeight: 700, fontSize: 16.5 }}>{b.he}</div>
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
              Search the whole of Hebrew Wikisource — novels, poetry, essays and translations that have
              entered the public domain. No sign-up.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                ref={wsInput}
                className="text-input"
                dir="rtl"
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

            {wsResults && !wsResults.length && !wsSearching && (
              <div style={{ fontSize: 13.5, color: C.sub, marginTop: 12 }}>Nothing found for that. Try the author's name in Hebrew.</div>
            )}

            {(wsResults || []).map((r) => (
              <button key={r.title} style={rowStyle} onClick={() => openWikisource(r.title)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div dir="rtl" style={{ fontFamily: HEB_FONT, fontWeight: 600, fontSize: 16, lineHeight: 1.4 }}>{r.title}</div>
                  <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3 }}>
                    {r.words ? `${r.words.toLocaleString()} words` : "Wikisource"}
                  </div>
                </div>
                <ChevronRight size={18} color={C.sub} style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}

        {/* ---------------- Ben-Yehuda ---------------- */}
        {tab === "benyehuda" && !busy && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
              Project Ben-Yehuda holds the modern Hebrew canon — some 65,000 works by 4,400 writers, all
              public domain. It asks every app for its own key, issued free and instantly.
            </div>

            {!hasKey && (
              <div style={{ background: C.blueSoft, border: `1px solid ${C.blueLine}`, borderRadius: 12, padding: "10px 12px", fontSize: 13, color: C.blue, marginTop: 10, lineHeight: 1.5 }}>
                Get a key at{" "}
                <a className="inline-link" href={BENYEHUDA_KEY_URL} target="_blank" rel="noreferrer">benyehuda.org</a>{" "}
                — it arrives by email in a moment. It's stored only in this browser.
              </div>
            )}

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

            <div className="field-label">Search the catalogue</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="text-input"
                dir="rtl"
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
                  <div dir="rtl" style={{ fontFamily: HEB_FONT, fontWeight: 600, fontSize: 16, lineHeight: 1.4 }}>{r.title}</div>
                  <div dir="rtl" style={{ fontSize: 12.5, color: C.sub, marginTop: 3, fontFamily: HEB_FONT }}>
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
          </div>
        )}
      </div>
    </div>
  );
}
