/* The browser's Back button, made to mean something.

   Tabs and sheets are React state, and a phone's Back button knew nothing of
   them: one press from a word sheet three levels into a Wikisource category
   left the app. Now each open layer — a sheet, a lesson, a category — pushes
   one history entry and Back closes the topmost; with nothing open, Back
   returns to the previous tab.

   A layer's close() may return false to say "I asked instead of closing"
   (a lesson opens its quit sheet); the entry is put back so the lesson
   stays reachable by Back. */
const stack = []; /* [{ key, close }] */
let ignore = 0; /* popstate events we caused ourselves */
let onTabPop = null;
const state = () => (typeof history !== "undefined" && history.state) || {};

export function pushLayer(key, close) {
  stack.push({ key, close });
  history.pushState({ layer: key, depth: stack.length, tab: state().tab }, "");
}

/* A layer closed by its own controls rather than by Back: drop its entry
   (and any above it, which are closing with it) from the history. */
export function popLayer(key) {
  const idx = stack.findIndex((l) => l.key === key);
  if (idx < 0) return;
  stack.length = idx;
  const steps = (state().depth || 0) - idx;
  if (steps > 0) { ignore += 1; history.go(-steps); }
}

export function pushTab(tab) {
  /* a tab change while a sheet is open is a jump, not a step back; it
     replaces rather than stacking */
  if (stack.length || !history.pushState) { history.replaceState({ ...state(), tab }, ""); return; }
  history.pushState({ tab, depth: 0 }, "");
}

export function startHistory(initialTab, setTab) {
  onTabPop = setTab;
  history.replaceState({ tab: initialTab, depth: 0 }, "");
  const onPop = (e) => {
    if (ignore > 0) { ignore -= 1; return; }
    const depth = e.state?.depth || 0;
    while (stack.length > depth) {
      const top = stack.pop();
      if (top.close?.() === false) {
        stack.push(top);
        history.pushState({ layer: top.key, depth: stack.length, tab: state().tab }, "");
        return;
      }
    }
    if (stack.length === 0 && e.state?.tab) onTabPop?.(e.state.tab);
  };
  window.addEventListener("popstate", onPop);
  return () => window.removeEventListener("popstate", onPop);
}
