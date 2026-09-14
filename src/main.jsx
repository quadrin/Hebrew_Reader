import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { createPortal } from "react-dom";
import { Route } from "lucide-react";
import { registerSW } from "virtual:pwa-register";
import "./fonts.css";
import App from "./App.jsx";
import "./skeuomorphic.css";
import "./skeuomorphic-icons.css";
import "./skeuomorphic-polish.css";
import Boundary from "./Boundary.jsx";

/* The app-level dock owns Path / Read / Browse / Library. On a phone, Learn
   also needs a direct entrance because Path remembers its inner Practice/You
   tab and the inner tab strip may be far above the current scroll position.
   A portal keeps this button inside the real nav without coupling App to the
   course shell's private tab state. */
function MobileLearnShortcut() {
  const [nav, setNav] = useState(null);

  useEffect(() => {
    const find = () => setNav(document.querySelector(".appbar nav"));
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.getElementById("root"), { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const openLearn = () => {
    document.querySelector('.appbar nav button[aria-label="Path"]')?.click();

    const chooseLearn = () => {
      const button = [...document.querySelectorAll(".d-tabs button")]
        .find((el) => /\bLearn\b/.test(el.textContent || ""));
      if (!button) return false;
      button.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return true;
    };

    if (chooseLearn()) return;
    const observer = new MutationObserver(() => {
      if (chooseLearn()) observer.disconnect();
    });
    observer.observe(document.getElementById("root"), { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 1200);
  };

  if (!nav) return null;
  return createPortal(
    <button className="mobile-learn-shortcut" onClick={openLearn} aria-label="Learn">
      <Route size={22} /> <span>Learn</span>
    </button>,
    nav,
  );
}

/* Offline cache that keeps itself fresh: check for a new build on every
   launch and hourly in long-lived tabs; when one activates, reload once so
   nobody is stuck reading a stale version. (No-op in the single-file build,
   where the PWA plugin is disabled.) */
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Boundary>
      <App />
      <MobileLearnShortcut />
    </Boundary>
  </React.StrictMode>,
);
