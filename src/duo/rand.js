/* One small deterministic generator, shared.

   The lesson builder and the league both want randomness that survives a
   reload: the same seed has to give the same lesson and the same set of
   twenty-nine rivals. Mulberry32 is thirty lines of arithmetic with no state
   outside the closure, which is all that needs. */

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
