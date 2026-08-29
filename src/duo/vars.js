/* The reader's theme, translated into the path's variables.

   duo.css keeps its greens and golds — those are Duolingo's, not the book's —
   but takes its paper, ink and lines from whichever theme the reader is in.
   The lesson player is not the only screen wearing this skin: the flashcard
   review and the cloze practice are lessons too, and they are rendered from
   App.jsx, so the translation lives here rather than inside either of them. */

export const duoVars = (C, UI_FONT, HEB_FONT) => ({
  "--d-bg": C.paper, "--d-card": C.card, "--d-ink": C.ink, "--d-sub": C.sub,
  "--d-line": C.line, "--d-mute": C.soft, "--d-mute-dark": C.line, "--d-muteInk": C.sub,
  "--d-marker": C.marker,
  "--d-ui": UI_FONT, "--d-heb": HEB_FONT,
});
