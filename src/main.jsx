import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./fonts.css";
import App from "./App.jsx";

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
    <App />
  </React.StrictMode>
);
