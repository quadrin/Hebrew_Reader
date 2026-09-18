/* The pictures the course teaches new words with.

   scripts/fetch-images.mjs scrapes a photograph for every word it can find one
   for and files it under the word's English gloss, tidied down to something
   that survives the difference between "the Apple" and "apple". Both ends use
   the tidying here so that the file written by the scraper is the file the
   lesson asks for. */

import { VAGUE_PICTURES } from "./vaguePictures.js";

export const glossKey = (en) => String(en || "")
  .toLowerCase()
  .replace(/\([^)]*\)/g, " ")
  .replace(/^(to|the|a|an)\s+/g, "")
  .replace(/[^a-z\s'-]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

/* A word's picture, if it has one.

   Only its own gloss counts, and only the senses inside that gloss: "בַּיִת"
   glossed "house / home" is a picture of a house either way, but the word's
   list of alternates is a different matter. The lexicon files את — the
   accusative marker, which is not a thing at all — under alternates that
   include "the fruit", and a pronoun illustrated with a fruit platter is worse
   than a pronoun illustrated with nothing. */
export function pictureFor(images, word) {
  if (!images || !word?.en) return null;
  const whole = shown(images, glossKey(word.en));
  if (whole) return whole;
  for (const sense of String(word.en).split(/[/,;]/)) {
    const hit = shown(images, glossKey(sense));
    if (hit) return hit;
  }
  return null;
}

/* The file for a gloss — unless its picture is one of the ones that do not
   show their word, which stay on disk and out of the lessons. */
const shown = (images, key) => (VAGUE_PICTURES.has(key) ? null : images[key]?.f || null);
