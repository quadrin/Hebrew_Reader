/* What to show when a screen throws.

   React unmounts the whole tree when a render throws and nothing catches it,
   which turns one bad screen into a white page. The boot watchdog in
   index.html does not help: it looks once, two and a half seconds after load,
   so it catches an app that never started and misses an app that started fine
   and fell over when a tab was opened — which is the more common way to get a
   white page and the one that leaves nobody anything to report.

   So: keep the error, say what it was, and offer the two things that actually
   fix it. Reloading is the fix when the crash came from a half-updated cache,
   which on a phone that installed this weeks ago is most of the time; going
   back to the previous screen is the fix when it is the screen itself, and
   leaves the rest of the app usable in the meantime. */

import { Component } from "react";

export default class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    /* Left in the console on purpose. It is the only copy of the stack that
       survives, and "open the console and read it to me" is the difference
       between a bug that can be fixed and a screenshot of a white page. */
    console.error("A screen crashed:", err, info?.componentStack);
  }

  /* A tab change is a chance to try again: the screen that threw is not the
     screen being asked for now. */
  componentDidUpdate(prev) {
    if (this.state.err && prev.at !== this.props.at) this.setState({ err: null });
  }

  render() {
    const { err } = this.state;
    if (!err) return this.props.children;
    return (
      <div style={{
        maxWidth: 560, margin: "48px auto", padding: 24, borderRadius: 16,
        background: "var(--card, #fff)", border: "1px solid var(--line, #E3E1D8)",
        color: "var(--ink, #1B2432)", fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>That screen stopped working</div>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--sub, #5D6675)" }}>
          Nothing is lost — your progress is saved. Reloading fixes this most of
          the time, because it usually means the app updated underneath you and
          half of the old version is still in the way.
        </div>
        <pre style={{
          marginTop: 12, padding: 10, borderRadius: 8, fontSize: 12,
          whiteSpace: "pre-wrap", wordBreak: "break-all",
          background: "var(--soft, #F5F3ED)", color: "var(--red, #B3402E)",
        }}>{String(err?.message || err)}</pre>
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button
            onClick={() => this.setState({ err: null })}
            style={{ padding: "10px 16px", borderRadius: 12, border: "1px solid var(--line, #E3E1D8)", background: "transparent", color: "inherit", fontSize: 14, cursor: "pointer" }}
          >
            Try again
          </button>
          <button
            onClick={reloadClean}
            style={{ padding: "10px 16px", borderRadius: 12, border: "none", background: "var(--blue, #1cb0f6)", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            Reload the app
          </button>
        </div>
      </div>
    );
  }
}

/* Throw away the service worker and its caches before reloading. A plain
   reload is served by the same stale worker that caused the problem, which is
   how someone ends up pressing it five times; unregistering first means the
   next load comes from the network. Progress is in IndexedDB and is not
   touched by any of this. */
async function reloadClean() {
  try {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) { /* nothing to clear, or not allowed to: reload anyway */ }
  window.location.reload();
}
