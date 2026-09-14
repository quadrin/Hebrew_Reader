import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { createPortal } from "react-dom";
import {
  BookOpen, Cloud, Dumbbell, Languages, Library, Menu, Route, Search, Settings, User,
} from "lucide-react";
import { registerSW } from "virtual:pwa-register";
import "./fonts.css";
import App from "./App.jsx";
import "./skeuomorphic.css";
import "./skeuomorphic-icons.css";
import "./skeuomorphic-polish.css";
import "./mobile-skeuomorphic-banner.css";
import "./primary-nav.css";
import "./primary-more-fix.css";
import Boundary from "./Boundary.jsx";

/* The visible navigation is the same on desktop and phone:
   Learn · Practice · Books · Library · More.

   App still owns its existing Path / Read / Browse / Library routing and the
   course still owns Learn / Practice / You internally. Keeping those controls
   mounted (but visually hidden) lets this small shell delegate to the existing
   history/state machinery instead of creating a second router. */
function PrimaryNavigation() {
  const [nav, setNav] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, redraw] = useState(0);

  useEffect(() => {
    const root = document.getElementById("root");

    /* Do this in JS as well as CSS. The PWA can briefly serve a new JS bundle
       alongside a cached CSS asset; relying on one selector left both the old
       and new navigation visible. These legacy controls remain mounted and
       clickable from code, but never participate in layout or tab order. */
    const suppressLegacy = () => {
      const currentNav = document.querySelector(".appbar nav");
      if (currentNav) setNav(currentNav);

      document
        .querySelectorAll(
          ".appbar nav > button:not(.primary-nav-btn), .appbar-inner > .bar-btn, .duo > .d-tabs, .duo > .d-practice-fab",
        )
        .forEach((el) => {
          el.style.setProperty("display", "none", "important");
          if (el.matches("button")) {
            el.tabIndex = -1;
            el.setAttribute("aria-hidden", "true");
          }
        });
    };

    suppressLegacy();
    const observer = new MutationObserver(suppressLegacy);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  /* Route and inner-course changes are reflected by class names on the old
     controls. Watch those so the replacement navigation keeps the right item
     pressed even when another control (Back, a side-rail button, etc.) moved
     the user. */
  useEffect(() => {
    const root = document.getElementById("root");
    let frame = 0;
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; redraw((n) => n + 1); });
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class", "aria-current", "aria-pressed"], childList: true, subtree: true });
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onPointerDown = (e) => {
      const target = e.target;
      if (target?.closest?.('.primary-more-menu, .primary-nav-btn[aria-label="More"]')) return;
      setMenuOpen(false);
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [menuOpen]);

  const originalNav = (label) => document.querySelector(`.appbar nav > button:not(.primary-nav-btn)[aria-label="${label}"]`);
  const innerTab = (label) => [...document.querySelectorAll(".duo > .d-tabs button")]
    .find((el) => (el.textContent || "").trim().startsWith(label));

  const openOriginal = (label) => {
    originalNav(label)?.click();
    setMenuOpen(false);
  };

  const openPathSection = (label) => {
    originalNav("Path")?.click();

    const choose = () => {
      const button = innerTab(label);
      if (!button) return false;
      button.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
      setMenuOpen(false);
      return true;
    };

    if (choose()) return;
    const root = document.getElementById("root");
    const observer = new MutationObserver(() => {
      if (choose()) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 1200);
  };

  if (!nav) return null;

  const pathActive = originalNav("Path")?.classList.contains("active");
  const innerActive = document.querySelector(".duo > .d-tabs button.on")?.textContent || "Learn";
  const learnActive = !!pathActive && /Learn/.test(innerActive);
  const practiceActive = !!pathActive && /Practice/.test(innerActive);
  const booksActive = originalNav("Read")?.classList.contains("active");
  const libraryActive = originalNav("Library")?.classList.contains("active");
  const browseActive = originalNav("Browse")?.classList.contains("active");
  const youActive = !!pathActive && /You/.test(innerActive);
  const moreActive = menuOpen || browseActive || youActive;

  const hiddenSync = document.querySelector('.appbar-inner > .bar-btn[aria-label="Sync status"], .appbar-inner > .bar-btn[aria-label="Set up sync"]');
  const hiddenSettings = document.querySelector('.appbar-inner > .bar-btn[aria-label="Settings"]');
  const hiddenNikkud = document.querySelector('.appbar-inner > .bar-btn[aria-label^="Nikkud "]');
  const syncLabel = hiddenSync?.getAttribute("aria-label") === "Set up sync" ? "Set up sync" : "Sync now";
  const nikkudOn = hiddenNikkud?.getAttribute("aria-pressed") === "true";

  const button = (key, Icon, label, active, onClick, extra = {}) => (
    <button
      key={key}
      className={`primary-nav-btn${active ? " active" : ""}`}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      {...extra}
    >
      <Icon size={17} /> <span className="tab-label">{label}</span>
    </button>
  );

  const moreMenu = menuOpen && (
    <div className="primary-more-menu" role="menu" aria-label="More" onPointerDown={(e) => e.stopPropagation()}>
      <div className="primary-more-title">More</div>
      <button className="primary-more-item" role="menuitem" onClick={() => openOriginal("Browse")}>
        <Search size={18} /> Browse books
      </button>
      <button className="primary-more-item" role="menuitem" onClick={() => openPathSection("You")}>
        <User size={18} /> You
      </button>
      <div className="primary-more-sep" />
      {hiddenNikkud && (
        <button className="primary-more-item" role="menuitem" onClick={() => { hiddenNikkud.click(); setMenuOpen(false); }}>
          <Languages size={18} /> Nikkud {nikkudOn ? "on" : "off"}
        </button>
      )}
      {hiddenSync && (
        <button className="primary-more-item" role="menuitem" onClick={() => { hiddenSync.click(); setMenuOpen(false); }}>
          <Cloud size={18} /> {syncLabel}
        </button>
      )}
      {hiddenSettings && (
        <button className="primary-more-item" role="menuitem" onClick={() => { hiddenSettings.click(); setMenuOpen(false); }}>
          <Settings size={18} /> Settings
        </button>
      )}
    </div>
  );

  return createPortal(
    <>
      {button("learn", Route, "Learn", learnActive, () => openPathSection("Learn"))}
      {button("practice", Dumbbell, "Practice", practiceActive, () => openPathSection("Practice"))}
      {button("books", BookOpen, "Books", booksActive, () => openOriginal("Read"))}
      {button("library", Library, "Library", libraryActive, () => openOriginal("Library"))}
      {button("more", Menu, "More", moreActive, () => setMenuOpen((v) => !v), { "aria-expanded": menuOpen, "aria-haspopup": "menu" })}
      {moreMenu}
    </>,
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
      <PrimaryNavigation />
    </Boundary>
  </React.StrictMode>,
);
