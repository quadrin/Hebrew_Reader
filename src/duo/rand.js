/* One small deterministic generator, shared.

   The lesson builder wants randomness that survives a reload: the same seed
   has to give the same lesson, with the same exercises in the same order.
   Mulberry32 is a few lines of arithmetic with no state outside the closure,
   which is all that needs.

   The picking and shuffling built on top of it live here too, rather than
   inside the lesson builder, because the reading feed builds its drill from
   the paragraphs somebody has just read and wants exactly the same guarantee:
   re-opening a drill after a crash gives back the drill that was interrupted. */

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rng(seed) {
  const r = mulberry32(seed >>> 0);
  const rand = () => r();
  rand.int = (n) => Math.floor(r() * n);
  rand.pick = (arr) => arr[Math.floor(r() * arr.length)];
  rand.shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  rand.sample = (arr, n) => rand.shuffle(arr).slice(0, n);
  return rand;
}

export const hash = (s) => [...String(s)].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 17);
