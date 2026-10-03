import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Download, Loader, Trash2 } from "lucide-react";
import {
  subscribeOfflineGrader, getOfflineGraderSnapshot, initOfflineGrader,
  downloadOfflineGrader, cancelOfflineGraderDownload, setOfflineGraderEnabled,
  removeOfflineGrader,
} from "./offlineGrader.js";

/* The same device-local controls live in the reader's Settings and the
   course's Profile. Opening either only checks storage; it never downloads. */
export default function OfflineGraderSection({ course = false }) {
  const state = useSyncExternalStore(subscribeOfflineGrader, getOfflineGraderSnapshot, getOfflineGraderSnapshot);
  const [actionError, setActionError] = useState("");
  const active = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    initOfflineGrader();
    return () => { alive.current = false; };
  }, []);

  const run = async (action) => {
    if (active.current) return;
    active.current = true;
    setActionError("");
    try { await action(); }
    catch (err) { if (alive.current) setActionError(err?.message || "That didn't finish. Please try again."); }
    finally { active.current = false; }
  };
  const installing = !!state.installing;
  const downloading = state.phase === "downloading";
  const checking = state.phase === "checking";
  const installed = ["ready", "loading", "grading"].includes(state.phase);
  const inUse = state.phase === "loading" || state.phase === "grading";
  const unsupported = state.phase === "unsupported";
  const pct = Math.max(0, Math.min(100, Math.round(state.progress || 0)));
  const buttonClass = course ? "d-btn ghost small" : "ghost-btn";
  const sub = course ? "var(--d-sub)" : "var(--sub)";
  const ink = course ? "var(--d-ink)" : "var(--ink)";
  const accent = course ? "var(--d-green)" : "var(--blue)";
  const muted = course ? "var(--d-mute)" : "var(--soft)";
  const error = actionError || (state.phase === "error" ? state.message : "");

  return (
    <section aria-label="Offline answer grading" style={{ marginTop: 22 }}>
      <div className={course ? "d-title" : "field-label"} style={{ marginTop: 0 }}>
        Offline answer grading <span style={{ fontSize: 12, fontWeight: 500, color: sub }}>Experimental</span>
      </div>
      <div className={course ? "d-card" : undefined}>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: sub, lineHeight: 1.55 }}>
          Download Qwen3-1.7B to check typed answers against the course's reference translations on this device.
          The package is about 1.5 GB, including its tokenizer and runtime. Use Wi-Fi and leave room for the download.
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: sub, lineHeight: 1.55 }}>
          Local checks can take several seconds and may be less accurate. They run after you press Check;
          accepted alternatives are never saved for future answers. Speech, explanations and the other AI tutor
          features still need a connection and your own API key. This download and its switch stay on this device.
        </p>

        {installed && (
          <label style={{ display: "flex", alignItems: "center", gap: 9, color: ink, fontSize: 13.5, marginBottom: 10 }}>
            <input type="checkbox" checked={state.enabled} disabled={installing} onChange={(e) => run(() => setOfflineGraderEnabled(e.target.checked))} />
            Use local text grading offline or after a network failure
          </label>
        )}

        {(checking || downloading || inUse || installing) && (
          <div style={{ marginBottom: 10 }}>
            {downloading && (
              <div role="progressbar" aria-label="Offline grader download" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={pct} style={{ height: 8, borderRadius: 4, background: muted, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: accent }} />
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: sub }}>
              <Loader size={14} className="spin" aria-hidden="true" />
              <span role="status" style={{ flex: 1 }}>
                {downloading ? `Downloading… ${pct}%` : checking ? "Checking this device…"
                  : state.phase === "loading" ? "Loading the local model…" : "Checking an answer locally…"}
              </span>
              {installing && <button type="button" className={buttonClass} onClick={cancelOfflineGraderDownload}>Cancel</button>}
            </div>
          </div>
        )}

        {state.phase === "ready" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: accent, fontSize: 13, marginBottom: 10 }} role="status">
            <Check size={14} aria-hidden="true" />
            {state.enabled ? "Ready for offline text checks" : "Downloaded on this device; offline grading is off"}
          </div>
        )}

        {!checking && !downloading && !installing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {!installed && !unsupported && (
              <button type="button" className={buttonClass} onClick={() => run(downloadOfflineGrader)}>
                <Download size={15} aria-hidden="true" />
                {state.phase === "error" ? "Retry download (about 1.5 GB)" : "Download offline grader (about 1.5 GB)"}
              </button>
            )}
            {(installed || state.phase === "error" || (state.phase === "idle" && state.message)) && (
              <button type="button" className={buttonClass} disabled={inUse || installing} onClick={() => run(removeOfflineGrader)}>
                <Trash2 size={15} aria-hidden="true" /> Remove offline grader
              </button>
            )}
          </div>
        )}
        {(error || state.message) && (
          <p role={error ? "alert" : "status"} style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.5,
            color: error ? (course ? "var(--d-red)" : "var(--red)") : sub }}>
            {error || state.message}
          </p>
        )}
      </div>
    </section>
  );
}
