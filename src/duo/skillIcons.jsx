/* The old tree's skill icons.

   Duolingo's legacy Hebrew tree gave every skill a flat picture of what it
   taught, and the scrape kept the icon id each skill used — that is the `icon`
   field on a unit, so units that shared a picture in the real tree share one
   here too (all four adjective skills are one sparkle, the six pa'al/nif'al
   verb skills are one bolt).

   The pictures themselves are drawn here rather than lifted: white silhouettes
   on the unit's colour, in the flat chunky style the tree used. They live in a
   24x24 box and are drawn with fills, not strokes, so they stay solid when a
   node shrinks. */

/* A Hebrew or Latin character used as its own icon — the alphabet skills and
   the number skills are clearer as letters than as any drawing of them. */
const glyph = (ch, size, font) => (
  /* the font has to come through `style`: a CSS variable in a presentation
     attribute is not resolved, and the glyph falls back to the browser's serif */
  <text
    x="12" y="12" fontSize={size} fontWeight="800" style={{ fontFamily: font }}
    textAnchor="middle" dominantBaseline="central" fill="currentColor"
  >{ch}</text>
);

const ICONS = {
  /* 1-2 · the alphabet */
  1: glyph("א", 21, "var(--d-heb)"),
  2: glyph("ב", 21, "var(--d-heb)"),

  /* 3 · food — a fork and a knife */
  3: (
    <>
      <path d="M4.6 2.4h1.8v6.2h1.1V2.4h1.8v6.2h1.1V2.4h1.8v7.4c0 1.7-1 3.2-2.5 3.9v7.5a1.5 1.5 0 0 1-3 0v-7.5a4.3 4.3 0 0 1-2.5-3.9V2.4Z" />
      <path d="M18.2 2.4c1.7 0 3 2.9 3 6.4 0 2.8-.8 5-2.1 5.9v6.7a1.5 1.5 0 0 1-3 0V2.4h2.1Z" />
    </>
  ),

  /* 4 · colours and the arts — a palette */
  4: (
    <path fillRule="evenodd" d="M12 2.6c-5.5 0-9.9 4-9.9 8.9 0 4.8 4 8.7 9 8.7 1.3 0 2.3-.9 2.3-2 0-.5-.2-1-.5-1.4-.3-.3-.5-.7-.5-1.2 0-1.1.9-2 2-2h1.7a5.4 5.4 0 0 0 5.4-5.4c0-3.9-4-5.6-9.5-5.6Zm-4.7 9.8a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Zm2.4-4.8a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Zm4.7 0a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Zm3.6 3.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Z" />
  ),

  /* 5 · the pa'al and nif'al verb skills — a bolt */
  5: <path d="M13.8 1.6 5.4 13.8h5.1L9.2 22.4l8.9-12.3h-5.3l1-8.5Z" />,

  /* 6 · animals — a paw */
  6: (
    <>
      <ellipse cx="5.8" cy="10.6" rx="2.3" ry="2.9" />
      <ellipse cx="10.1" cy="6.8" rx="2.4" ry="3.1" />
      <ellipse cx="15" cy="6.8" rx="2.4" ry="3.1" />
      <ellipse cx="19.2" cy="10.6" rx="2.3" ry="2.9" />
      <path d="M12.5 12.4c3.4 0 6.2 2.5 6.2 5.3 0 2-1.6 3.5-3.5 3.5-1.1 0-1.9-.3-2.7-.3s-1.6.3-2.7.3c-2 0-3.5-1.5-3.5-3.5 0-2.8 2.8-5.3 6.2-5.3Z" />
    </>
  ),

  /* 7 · science — a flask */
  7: <path d="M8.4 1.8h7.2v2.4h-1.4v4.9l5.1 8.8a3.2 3.2 0 0 1-2.8 4.8H7.5a3.2 3.2 0 0 1-2.8-4.8l5.1-8.8V4.2H8.4V1.8Z" />,

  /* 9 · sport — a ball */
  9: <path fillRule="evenodd" d="M12 2.4a9.6 9.6 0 1 0 0 19.2 9.6 9.6 0 0 0 0-19.2Zm0 4.2 5.3 3.9-2 6.2H8.7l-2-6.2L12 6.6Z" />,

  /* 10 · medical — a cross */
  10: <path d="M9.3 2.4h5.4v6.9h6.9v5.4h-6.9v6.9H9.3v-6.9H2.4V9.3h6.9V2.4Z" />,

  /* 11 · politics — a parliament */
  11: (
    <>
      <path d="M12 2 22.6 7.6H1.4L12 2Z" />
      <rect x="3.2" y="9.2" width="2.9" height="8.6" rx=".6" />
      <rect x="8.1" y="9.2" width="2.9" height="8.6" rx=".6" />
      <rect x="13" y="9.2" width="2.9" height="8.6" rx=".6" />
      <rect x="17.9" y="9.2" width="2.9" height="8.6" rx=".6" />
      <rect x="1.6" y="19.2" width="20.8" height="2.8" rx="1.2" />
    </>
  ),

  /* 12 · places — a pin */
  12: <path fillRule="evenodd" d="M12 1.8c-4.2 0-7.6 3.3-7.6 7.4 0 5.3 6.1 11.4 6.9 12.2.4.4 1 .4 1.4 0 .8-.8 6.9-6.9 6.9-12.2 0-4.1-3.4-7.4-7.6-7.4Zm0 10a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Z" />,

  /* 13 · geometry — the three shapes */
  13: (
    <>
      <circle cx="6" cy="6" r="4.2" />
      <rect x="13.6" y="2" width="8.4" height="8.4" rx="1.2" />
      <path d="M12 13.6 18.8 22H5.2L12 13.6Z" />
    </>
  ),

  /* 14 · prepositions and the construct state — into the box */
  14: (
    <>
      <path d="M13 1.6v4.6h3.2L12 11.4 7.8 6.2H11V1.6h2Z" />
      <path d="M3.2 11.2h4.4V13h8.8v-1.8h4.4v9.2a1.8 1.8 0 0 1-1.8 1.8H5a1.8 1.8 0 0 1-1.8-1.8v-9.2Z" />
    </>
  ),

  /* 15 · nature — a tree */
  15: (
    <>
      <path d="M12 1.4 17.8 9.2H6.2L12 1.4Z" />
      <path d="M12 6.8 19.4 16.4H4.6L12 6.8Z" />
      <rect x="10.4" y="15.6" width="3.2" height="6.6" rx="1" />
    </>
  ),

  /* 16 · abstract objects — a thought */
  16: (
    <>
      <circle cx="9.2" cy="8.4" r="4.7" />
      <circle cx="15.6" cy="7.6" r="3.9" />
      <circle cx="14.4" cy="12.4" r="4.3" />
      <circle cx="6.4" cy="17.6" r="2.1" />
      <circle cx="3.4" cy="21" r="1.4" />
    </>
  ),

  /* 17 · occupations — a briefcase */
  17: (
    <>
      <path d="M9.2 2.2h5.6A2.6 2.6 0 0 1 17.4 4.8v2.4h-2.8V5H9.4v2.2H6.6V4.8a2.6 2.6 0 0 1 2.6-2.6Z" />
      <rect x="2" y="7.4" width="20" height="13.4" rx="2.4" />
    </>
  ),

  /* 18 · there is / to have — an open hand */
  18: <path d="M7.2 12.6V4.6a1.6 1.6 0 0 1 3.2 0v4.6h.8V2.8a1.6 1.6 0 0 1 3.2 0v6.4h.8V4.4a1.6 1.6 0 0 1 3.2 0v8.8c0 4.8-2.6 9-6.6 9-2.7 0-4.4-1.4-5.9-3.7l-3.4-5a1.7 1.7 0 0 1 2.6-2.2l2.1 2.3Z" />,

  /* 19 · Israel — the star */
  19: (
    <>
      <path d="M12 1.8 21.8 18.6H2.2L12 1.8Z" />
      <path d="M12 22.2 2.2 5.4h19.6L12 22.2Z" />
    </>
  ),

  /* 20 · conjunctions — a link */
  20: <path fillRule="evenodd" d="M9.4 6.4h3.4v3.2H9.4a2.4 2.4 0 0 0 0 4.8h3.4v3.2H9.4a5.6 5.6 0 1 1 0-11.2Zm5.2 0a5.6 5.6 0 1 1 0 11.2h-3.4v-3.2h3.4a2.4 2.4 0 0 0 0-4.8h-3.4V6.4h3.4Z" />,

  /* 22 · numbers */
  22: glyph("123", 11, "var(--d-ui)"),

  /* 23 · education — a mortarboard */
  23: (
    <>
      <path d="M12 2.6 1 8.2l11 5.6 11-5.6-11-5.6Z" />
      <path d="M5.6 11.4 12 14.6l6.4-3.2v4.2c0 2-2.9 3.5-6.4 3.5s-6.4-1.5-6.4-3.5v-4.2Z" />
      <path d="M20.6 9.6h1.6v5.8a.8.8 0 0 1-1.6 0V9.6Z" />
    </>
  ),

  /* 24 · questions, languages */
  24: glyph("?", 21, "var(--d-ui)"),

  /* 26 · clothing — a shirt */
  26: <path d="M8.6 2.2 12 4.4l3.4-2.2 6.2 3.5-2.7 5.4-2.1-1.2v11.9H7.2V9.9l-2.1 1.2L2.4 5.7l6.2-3.5Z" />,

  /* 27 · dates and time — a clock */
  27: <path fillRule="evenodd" d="M12 2.2a9.8 9.8 0 1 0 0 19.6 9.8 9.8 0 0 0 0-19.6Zm0 2.8a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm-1.2 2h2.4v4.6l3.2 1.9-1.2 2-4.4-2.6V7Z" />,

  /* 28 · home */
  28: <path d="M12 1.8 1.2 11.4h3.2V21.6h5.2v-5.8h4.8v5.8h5.2V11.4h3.2L12 1.8Z" />,

  /* 29 · family — a grown-up and a child */
  29: (
    <>
      <circle cx="8" cy="6.2" r="3.5" />
      <path d="M1.8 21.4c0-4 2.8-7.2 6.2-7.2s6.2 3.2 6.2 7.2H1.8Z" />
      <circle cx="18.4" cy="10.8" r="2.7" />
      <path d="M14.2 21.4c0-3 1.9-5.4 4.2-5.4s4.2 2.4 4.2 5.4h-8.4Z" />
    </>
  ),

  /* 30 · technology — a phone */
  30: <path fillRule="evenodd" d="M6.8 1.4h10.4a2.8 2.8 0 0 1 2.8 2.8v15.6a2.8 2.8 0 0 1-2.8 2.8H6.8A2.8 2.8 0 0 1 4 19.8V4.2a2.8 2.8 0 0 1 2.8-2.8Zm3.2 2.4h4a.8.8 0 0 1 0 1.6h-4a.8.8 0 0 1 0-1.6ZM6.6 7h10.8v10.8H6.6V7Z" />,

  /* 31 · business — an office block */
  31: <path fillRule="evenodd" d="M2.4 8.2h8.4v13.4H2.4V8.2Zm2.2 2.4v2.2H7v-2.2H4.6Zm4 0v2.2h2.2v-2.2H8.6Zm-4 4.2v2.2H7v-2.2H4.6Zm4 0v2.2h2.2v-2.2H8.6ZM12.4 2.4h9.2v19.2h-9.2V2.4Zm2.2 2.6v2.2h2.2V5h-2.2Zm4 0v2.2h2V5h-2Zm-4 4.4v2.2h2.2V9.4h-2.2Zm4 0v2.2h2V9.4h-2Zm-4 4.4v2.2h2.2v-2.2h-2.2Zm4 0v2.2h2v-2.2h-2Z" />,

  /* 32 · outer space — a rocket */
  32: (
    <>
      <path fillRule="evenodd" d="M12 .8c3.1 2.7 4.9 6.8 4.9 11.2v5.2H7.1v-5.2C7.1 7.6 8.9 3.5 12 .8Zm0 4.8a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6Z" />
      <path d="M6.3 11.2v7.6l-3-2.2a2 2 0 0 1-.7-2.3l1.9-4.6c.4.6 1 1.2 1.8 1.5Z" />
      <path d="M17.7 11.2v7.6l3-2.2a2 2 0 0 0 .7-2.3l-1.9-4.6c-.4.6-1 1.2-1.8 1.5Z" />
      <path d="M9.4 18.6h5.2c0 2.4-1.4 4.2-2.6 4.8-1.2-.6-2.6-2.4-2.6-4.8Z" />
    </>
  ),

  /* 33 · feelings — a heart */
  33: <path d="M12 21.4 10.2 19.8C4.4 14.6 1.4 12 1.4 8.6a5.6 5.6 0 0 1 5.7-5.6c2 0 4 .9 4.9 2.5 1-1.6 2.9-2.5 4.9-2.5a5.6 5.6 0 0 1 5.7 5.6c0 3.4-3 6-8.8 11.2L12 21.4Z" />,

  /* 34 · formal — a bow tie */
  34: (
    <>
      <path d="M2.2 6.4 9.8 12l-7.6 5.6A1.1 1.1 0 0 1 .4 16.7V7.3a1.1 1.1 0 0 1 1.8-.9Z" />
      <path d="M21.8 6.4 14.2 12l7.6 5.6a1.1 1.1 0 0 0 1.8-.9V7.3a1.1 1.1 0 0 0-1.8-.9Z" />
      <rect x="9" y="8.8" width="6" height="6.4" rx="1.8" />
    </>
  ),

  /* 35 · people, pronouns, music — a person */
  35: (
    <>
      <circle cx="12" cy="6.8" r="4.3" />
      <path d="M3.2 21.6c0-4.7 3.9-8.2 8.8-8.2s8.8 3.5 8.8 8.2H3.2Z" />
    </>
  ),

  /* 36 · travel — a plane */
  36: <path d="M22 12c0-1-.8-1.8-1.8-1.8h-4.8L10.4 1.8H7.3l3 8.4H5.5L3.2 7.3H1.2L2.8 12l-1.6 4.7h2l2.3-2.9h4.8l-3 8.4h3.1l5.2-8.4h4.8c1 0 1.8-.8 1.8-1.8Z" />,

  /* 38 · emergency */
  38: <path fillRule="evenodd" d="M12 2c.7 0 1.3.4 1.6 1l8.9 15.8a1.8 1.8 0 0 1-1.6 2.8H3.1a1.8 1.8 0 0 1-1.6-2.8L10.4 3c.3-.6.9-1 1.6-1Zm-1.4 6.4v5.9h2.8V8.4h-2.8ZM12 16.3a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z" />,

  /* 39 · comparison — the scales */
  39: (
    <>
      <circle cx="12" cy="3.2" r="2" />
      <rect x="10.9" y="4.6" width="2.2" height="16" rx="1.1" />
      <rect x="6.6" y="20" width="10.8" height="2.6" rx="1.3" />
      <rect x="2.4" y="5.6" width="19.2" height="2.4" rx="1.2" />
      <path d="M1 9.6h8a4 4 0 0 1-8 0Z" />
      <path d="M15 9.6h8a4 4 0 0 1-8 0Z" />
    </>
  ),

  /* 40 · determiners — this one here */
  40: <path d="M9.4 3a1.9 1.9 0 0 1 3.8 0v6.8h.7V7.2a1.7 1.7 0 0 1 3.4 0V10h.7v-1a1.7 1.7 0 0 1 3.4 0v5.3c0 4.3-2.8 7.9-6.6 7.9-2.6 0-4.4-1.3-5.8-3.4l-3.7-5.2a1.9 1.9 0 0 1 2.8-2.5l1.3 1.3V3Z" />,

  /* 41 · possessives — a key */
  41: (
    <g transform="rotate(-45 12 12)">
      <path fillRule="evenodd" d="M6.8 6.4a5.6 5.6 0 1 1 0 11.2 5.6 5.6 0 0 1 0-11.2Zm0 3.5a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z" />
      <path d="M11.4 10.3h9.8v3.4h-1.7v2.7h-2.5v-2.7h-1.7v2.7h-2.5v-2.7h-1.4v-3.4Z" />
    </g>
  ),

  /* 44 · plurals — one and then another */
  44: (
    <>
      <path d="M3.4 2.4h11a1.8 1.8 0 0 1 1.8 1.8v2.6h-2.9V5.3H5v9.3h1.7v2.9H3.4a1.8 1.8 0 0 1-1.8-1.8V4.2a1.8 1.8 0 0 1 1.8-1.8Z" />
      <rect x="7.8" y="8" width="14.6" height="13.6" rx="1.9" />
    </>
  ),

  /* 45 · adjectives — a sparkle */
  45: (
    <>
      <path d="M11 1.4Q12.4 8.6 19.6 10 12.4 11.4 11 18.6 9.6 11.4 2.4 10 9.6 8.6 11 1.4Z" />
      <path d="M18.4 14.8Q19 18.6 22.8 19.2 19 19.8 18.4 23.6 17.8 19.8 14 19.2 17.8 18.6 18.4 14.8Z" />
    </>
  ),

  /* 46 · Jewish festivals — a menorah */
  46: (
    <>
      <rect x="1.6" y="8.8" width="1.8" height="4.6" rx=".9" />
      <rect x="5" y="8.8" width="1.8" height="4.6" rx=".9" />
      <rect x="8.4" y="8.8" width="1.8" height="4.6" rx=".9" />
      <rect x="11.1" y="6.6" width="1.8" height="12.4" rx=".9" />
      <rect x="13.8" y="8.8" width="1.8" height="4.6" rx=".9" />
      <rect x="17.2" y="8.8" width="1.8" height="4.6" rx=".9" />
      <rect x="20.6" y="8.8" width="1.8" height="4.6" rx=".9" />
      <rect x="1.6" y="12.2" width="20.8" height="1.8" rx=".9" />
      <rect x="7.4" y="19.4" width="9.2" height="2.4" rx="1.2" />
      <circle cx="2.5" cy="7" r="1.1" /><circle cx="5.9" cy="7" r="1.1" />
      <circle cx="9.3" cy="7" r="1.1" /><circle cx="12" cy="4.8" r="1.2" />
      <circle cx="14.7" cy="7" r="1.1" /><circle cx="18.1" cy="7" r="1.1" />
      <circle cx="21.5" cy="7" r="1.1" />
    </>
  ),

  /* 47 · adverbs — how fast, how well */
  47: (
    <>
      <path d="M12 3.4a10.6 10.6 0 0 0-9.8 14.6h4.8a6 6 0 1 1 10 0h4.8A10.6 10.6 0 0 0 12 3.4Z" />
      <rect x="10.9" y="7.6" width="2.2" height="8.6" rx="1.1" transform="rotate(38 12 16.2)" />
    </>
  ),

  /* 48 · phrases and idioms — two bubbles */
  48: (
    <>
      <path d="M8.6 2.2c4.4 0 8 2.8 8 6.3s-3.6 6.3-8 6.3c-.8 0-1.5-.1-2.2-.2l-4 2.3 1-3.5A6.9 6.9 0 0 1 .6 8.5c0-3.5 3.6-6.3 8-6.3Z" />
      <path d="M18.2 9.4c3.2.7 5.6 2.9 5.6 5.6 0 1.5-.8 3-2.1 3.9l.8 3-3.5-2c-.6.1-1.2.2-1.9.2-2.9 0-5.4-1.3-6.4-3.2 4.1-.5 7.5-3.3 7.5-6.8v-.7Z" />
    </>
  ),

  /* 49 · basics and the imperative — say it */
  49: <path d="M3 9.6a2 2 0 0 1 2-2h3.4l8.8-4.9c1.3-.7 2.8.2 2.8 1.6v15.4c0 1.4-1.5 2.3-2.8 1.6l-8.8-4.9H7.4l1.1 4.5A1.5 1.5 0 0 1 7 22.8h-1c-.7 0-1.3-.5-1.5-1.1l-1.4-5.6A2 2 0 0 1 3 15.4V9.6Z" />,

  /* 50 · weather and religion — sun behind cloud */
  50: (
    <>
      <circle cx="8.4" cy="6.6" r="3.6" />
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
        d="M8.4.8v1.8M2.6 6.6H.8M4.3 2.5 3 1.2M12.5 2.5l1.3-1.3M14.2 6.6H16" />
      <path d="M8.8 21.8a5 5 0 0 1-.5-10 6.1 6.1 0 0 1 11.6 1.5 4.3 4.3 0 0 1-.7 8.5H8.8Z" />
    </>
  ),

  /* 51 · objects — a parcel */
  51: <path fillRule="evenodd" d="M3 6.2h18a1.8 1.8 0 0 1 1.8 1.8v11.8a1.8 1.8 0 0 1-1.8 1.8H3a1.8 1.8 0 0 1-1.8-1.8V8A1.8 1.8 0 0 1 3 6.2Zm7.4 2.6v10.6h3.2V8.8h-3.2Z" />,

  /* 52 · infinitives and modals — no end to it */
  52: <path fillRule="evenodd" d="M6.6 7.2C3.8 7.2 1.6 9.4 1.6 12s2.2 4.8 5 4.8c2.4 0 3.9-1.6 5.4-3.5 1.5 1.9 3 3.5 5.4 3.5 2.8 0 5-2.2 5-4.8s-2.2-4.8-5-4.8c-2.4 0-3.9 1.6-5.4 3.5-1.5-1.9-3-3.5-5.4-3.5Zm0 3c1.2 0 2.1.8 3.6 2.4-1.5 1.6-2.4 2.4-3.6 2.4a2.4 2.4 0 1 1 0-4.8Zm10.8 0a2.4 2.4 0 1 1 0 4.8c-1.2 0-2.1-.8-3.6-2.4 1.5-1.6 2.4-2.4 3.6-2.4Z" />,

  /* 53 · pi'el, nif'al, the conditional — a turn of the form */
  53: (
    <>
      <path fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"
        d="M12 5a7.8 7.8 0 1 1-7.3 5" />
      <path d="M10.4 1 16.4 5.1l-6 4.1V1Z" />
    </>
  ),

  /* 63 · discussions and decisions — back and forth */
  63: (
    <>
      <path d="M2 2.4h8.4a1.9 1.9 0 0 1 1.9 1.9v4.6a1.9 1.9 0 0 1-1.9 1.9H7.2l-3.8 2.6v-2.6H2A1.9 1.9 0 0 1 .1 8.9V4.3A1.9 1.9 0 0 1 2 2.4Z" />
      <path d="M13.6 12.2H22a1.9 1.9 0 0 1 1.9 1.9v4.6a1.9 1.9 0 0 1-1.9 1.9h-1.2v2.6l-3.8-2.6h-3.4a1.9 1.9 0 0 1-1.9-1.9v-4.6a1.9 1.9 0 0 1 1.9-1.9Z" />
    </>
  ),

  /* 65 · legends — a storybook */
  65: (
    <>
      <path d="M11.2 8.6v13.2c-2.7-1.9-5.8-2.5-9.2-1.9V6.8c3.4-.6 6.5 0 9.2 1.8Z" />
      <path d="M12.8 8.6c2.7-1.8 5.8-2.4 9.2-1.8v13.1c-3.4-.6-6.5 0-9.2 1.9V8.6Z" />
      <path d="M12 .6 13.5 3.7l3.5.4-2.6 2.4.7 3.4L12 8.2 8.9 9.9l.7-3.4L7 4.1l3.5-.4L12 .6Z" />
    </>
  ),
};

/* The nodes that are not a skill kept their own pictures in the tree: a
   dumbbell for practice, a chest for the reward, a trophy for the review. */
const NODE = {
  practice: (
    <path d="M2.4 10h2.4V8.2h3.4v7.6H4.8V14H2.4v-4Zm19.2 0h-2.4V8.2h-3.4v7.6h3.4V14h2.4v-4ZM8.6 10.2h6.8v3.6H8.6v-3.6Z" />
  ),
  chest: (
    <>
      <path d="M2 10.2V7.4A5.4 5.4 0 0 1 7.4 2h9.2A5.4 5.4 0 0 1 22 7.4v2.8H2Z" />
      <path d="M3.4 11.8h17.2v7.6a2.2 2.2 0 0 1-2.2 2.2H5.6a2.2 2.2 0 0 1-2.2-2.2v-7.6Z" />
      <rect x="10.4" y="8.6" width="3.2" height="5.4" rx="1" />
    </>
  ),
  unit_review: (
    <>
      <path d="M6.8 2.2h10.4v6.4a5.2 5.2 0 0 1-10.4 0V2.2Z" />
      <path d="M5.6 3.8v5.6a3.6 3.6 0 0 1-2.6-3.4V3.8h2.6Zm12.8 0H21v2.2a3.6 3.6 0 0 1-2.6 3.4V3.8Z" />
      <path d="M10.7 13.8h2.6v3.8h3.6v3.2H7.1v-3.2h3.6v-3.8Z" />
    </>
  ),
  locked: (
    <path fillRule="evenodd" d="M12 2.2a5.2 5.2 0 0 1 5.2 5.2v2.2h1.2a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2v-8.2a2 2 0 0 1 2-2h1.2V7.4A5.2 5.2 0 0 1 12 2.2Zm0 2.8a2.4 2.4 0 0 0-2.4 2.4v2.2h4.8V7.4A2.4 2.4 0 0 0 12 5Z" />
  ),
};

/* A node's picture: the unit's skill icon, or the node type's own. */
export default function SkillIcon({ icon, type, size = 30, style }) {
  const art = type && type !== "skill" ? NODE[type] : ICONS[icon];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={style}>
      {art || ICONS[35]}
    </svg>
  );
}
