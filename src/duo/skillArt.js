/* The tree's own skill icons.

   Duolingo drew every skill in the legacy tree as a flat picture on a coloured
   disc, and shipped the set as three 1100x1100 sprite sheets — full colour for
   a skill you are working on, gold for a finished one, grey for a locked one.
   The sheets are in src/assets/tree (see SOURCE.md there); duo.css points the
   three variants at them and this works out which cell to show.

   The grid is ten columns of 110, six rows used, counted from one, left to
   right — and that number is the icon id the scrape recorded for each skill,
   so a unit's `icon` field indexes straight into the sheet. */

/* Three of the ids the Hebrew tree uses have no artwork in the sheets: cell 53
   is blank in all three, and 63 and 65 fall past the end of the grid. Each is
   answered with the picture its own siblings carry — the verb skills run, the
   discussion skills talk, and a legend is a ghost story. */
const STAND_IN = { 53: 52, 63: 47, 65: 25 };

/* Anything the sheets have never heard of gets the talking heads. */
const FALLBACK = 35;

export function skillArt(icon) {
  const i = STAND_IN[icon] || (icon >= 1 && icon <= 57 ? icon : FALLBACK);
  return { "--sx": (i - 1) % 10, "--sy": Math.floor((i - 1) / 10) };
}
