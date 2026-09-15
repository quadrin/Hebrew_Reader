/* The click sound.

   A lesson has answered a tap since the course was written — a word joining
   the answer, a right answer, a finished session — but the rest of the app was
   silent: the reader, the library, the browse screen, the settings, the bar
   across the top. An interface drawn to look like something you could press
   and then saying nothing when you press it feels broken rather than quiet, so
   every button in the app makes a noise now.

   One listener does it rather than a call inside every button. There are
   several hundred buttons across the reader, the path and the library, nearly
   all of them written before this existed, and a rule that has to be
   remembered at each of them is a rule that will be missed at a dozen.

   Three things it will not do:

   - speak over a button that has already answered its own press. The word bank
     says something of its own when a word goes back to it; the count of sounds
     played, read on the way down the tree and again on the way up, is what
     tells this listener that something did.
   - answer a click the app made itself. The navigation across the bottom works
     by clicking the old hidden controls, and one press is one sound.
   - argue with a button that asks for something else. data-sfx names the sound
     to make, and data-sfx="off" asks for silence — for that element and for
     everything inside it. */

import { sfx, soundPlays, warmAudio } from "./duo/audio.js";

/* Everything that behaves as a button, which includes the words in the reading
   text: tapping one opens its meaning, and that wants answering as much as any
   button does. Text fields are absent on purpose — a keystroke is not a press. */
const PRESSABLE = 'button, [role="button"], [role="menuitem"], a[href], summary, select';

const BACKWARDS = /^(back|close|cancel|dismiss|quit|exit|no thanks|not now)\b|^[×✕✖]$/i;

/* What the button is called, the way a person would say it: the label it
   carries for a screen reader, or the words printed on it. Icon-only buttons
   have nothing but the label, which is why that comes first. */
const nameOf = (el) => (el.getAttribute("aria-label") || el.textContent || el.title || "").trim();

/* Which press fits. The differences are small — they are all the same click
   with a different tail — but a switch that sounds identical on and off is a
   switch you have to look at, and not having to look is the whole point. */
function pressFor(el) {
  const asked = el.closest("[data-sfx]")?.getAttribute("data-sfx");
  if (asked) return asked;

  const expanded = el.getAttribute("aria-expanded");
  if (expanded) return expanded === "true" ? "close" : "open";
  if (el.tagName === "SELECT") return "open";

  /* Both ways a switch is written in this app: the ARIA state, and the button
     that ends in the word it is currently showing — "Off" in Settings,
     "Nikkud on" in the More menu. Either way the sound is the state the press
     is moving to, not the one it is leaving, which is why all of this is read
     before the button has run. */
  const name = nameOf(el);
  const pressed = el.getAttribute("aria-pressed");
  const showing = /(^|\s)(on|off)$/i.exec(name)?.[2].toLowerCase();
  if (pressed === "true" || (pressed === null && showing === "on")) return "toggleOff";
  if (pressed === "false" || (pressed === null && showing === "off")) return "toggleOn";

  return BACKWARDS.test(name) ? "back" : "press";
}

/* The press this click has earned, worked out on the way down the tree and
   made on the way back up. Which sound it is has to be decided at the top: by
   the time a click comes back up, the button has run and a switch reading Off
   already reads On, so anything asked down here would say the opposite of what
   just happened. How many sounds had played is noted at the same moment, for
   the comparison at the bottom. */
let pending = null;

const mark = (e) => {
  /* A click the app made itself arrives in the middle of the real one that
     caused it, so it is stepped over rather than answered: leaving what is
     pending alone is what keeps the press that started it. */
  if (!e.isTrusted) return;
  pending = null;
  const el = e.target?.closest?.(PRESSABLE);
  if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return;
  const name = pressFor(el);
  if (name !== "off") pending = { click: e, name, sounds: soundPlays() };
};

const answer = (e) => {
  if (!pending || pending.click !== e) return;
  const press = pending;
  pending = null;
  if (soundPlays() !== press.sounds) return;   /* the button answered for itself */
  sfx(press.name);
};

export function startClickSounds() {
  /* Down the tree first and up it last: everything the button itself does
     happens in between, which is what makes the pair of them work — the state
     is still the old one at the top, and whatever the button had to say has
     been said by the bottom. A handler that stops the click travelling costs
     its button the sound, which is the right way round: it was handled. */
  document.addEventListener("click", mark, true);
  document.addEventListener("click", answer, false);
  /* A browser makes no sound until the page has been touched. The touch that
     is about to become this click is that permission, so the audio is opened
     on the way down and is already running when the click lands. */
  document.addEventListener("pointerdown", warmAudio, true);
}
