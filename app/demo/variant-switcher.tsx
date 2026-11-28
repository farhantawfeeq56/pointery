"use client";

import { useCallback, useEffect, useState } from "react";

const NAMES = [
  "Classic ?",
  "Ask pill",
  "Search stub",
  "Spark ✦",
  "Nudge bubble",
  "Live dot",
  "Edge tab",
  "Helper online",
  "Ghost hint",
  "Command btn",
] as const;

// Demo-only closed-state lab: replaces the kit's default fab with 10 ideas.
// Clicking a launcher dispatches the configured trigger so the REAL palette opens.
export default function VariantSwitcher() {
  const [idx, setIdx] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      const raw = localStorage.getItem("vartest-closed-idx");
      return raw ? Number(raw) % 10 : 0;
    } catch { return 0; }
  });
  const [trigger, setTrigger] = useState("ctrl+k");
  const go = useCallback((n: number) => {
    const v = ((n % 10) + 10) % 10;
    setIdx(v);
    try { localStorage.setItem("vartest-closed-idx", String(v)); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.config?.trigger) setTrigger(d.config.trigger); })
      .catch(() => {});
    // Hide the kit's own fab — variant 1 below is its pixel-twin, wired to the real palette.
    const s = document.createElement("style");
    s.textContent = ".pointery-fab{display:none!important}";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key >= "1" && e.key <= "9") go(Number(e.key) - 1);
      else if (e.key === "0") go(9);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const open = useCallback(() => {
    const parts = trigger.toLowerCase().split("+").map((p) => p.trim()).filter(Boolean);
    const key = parts.pop() ?? "k";
    const shift = parts.includes("shift");
    const mod = parts.includes("ctrl") || parts.includes("cmd") || parts.includes("meta");
    const alt = parts.includes("alt");
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key, shiftKey: shift, ctrlKey: mod, altKey: alt, bubbles: true })
    );
  }, [trigger]);

  const centered = idx === 2;
  const edge = idx === 6;

  return (
    <>
      <div
        style={
          edge
            ? { position: "fixed", right: 0, top: "45%", zIndex: 59 }
            : centered
              ? { position: "fixed", bottom: 76, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 59, pointerEvents: "none" }
              : { position: "fixed", bottom: 76, right: 24, zIndex: 59 }
        }
      >
        <span style={centered ? { pointerEvents: "auto" } : undefined}>
          <Launcher i={idx} onOpen={open} />
        </span>
      </div>

      <div style={{ position: "fixed", bottom: 58, right: 18, zIndex: 80, fontSize: 12, color: "#666663", background: "rgb(255 255 255/.85)", border: "1px solid #E5E5E2", borderRadius: 999, padding: "3px 10px" }}>
        {idx + 1}/10 · {NAMES[idx]}
      </div>
      <div style={{ position: "fixed", bottom: 18, right: 18, zIndex: 80, display: "flex", alignItems: "center", gap: 2, background: "#0B0500", borderRadius: 999, padding: 5, boxShadow: "0 8px 24px rgb(0 0 0/.3)" }} role="tablist" aria-label="Closed-state variants">
        {NAMES.map((n, i) => {
          const num = (i + 1) % 10;
          const active = i === idx;
          return (
            <button key={n} role="tab" aria-selected={active} title={`${num}: ${n}`} onClick={() => go(i)}
              style={{ minWidth: 30, height: 30, borderRadius: 999, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: active ? "#fff" : "transparent", color: active ? "#0B0500" : "#fff", opacity: active ? 1 : 0.65 }}>
              {num}
            </button>
          );
        })}
      </div>
    </>
  );
}

function Launcher({ i, onOpen }: { i: number; onOpen: () => void }) {
  const base: React.CSSProperties = { cursor: "pointer", fontFamily: "inherit" };
  switch (i) {
    case 0:
      return (
        <button onClick={onOpen} title="Ask Pointery" aria-label="Ask Pointery"
          style={{ ...base, width: 44, height: 44, borderRadius: 999, background: "var(--pointery-primary,#00A878)", color: "#fff", fontSize: 20, fontWeight: 700, border: "none", boxShadow: "0 4px 12px rgb(0 0 0/.18)" }}>?</button>
      );
    case 1:
      return (
        <button onClick={onOpen} style={{ ...base, display: "flex", alignItems: "center", gap: 8, borderRadius: 999, background: "#0B0500", color: "#fff", border: "none", padding: "10px 14px", fontSize: 14, fontWeight: 600, boxShadow: "0 4px 12px rgb(0 0 0/.2)" }}>
          ✦ Ask <kbd style={{ background: "rgb(255 255 255/.15)", borderRadius: 6, padding: "1px 7px", fontSize: 11 }}>⇧A</kbd>
        </button>
      );
    case 2:
      return (
        <button onClick={onOpen} style={{ ...base, display: "flex", alignItems: "center", gap: 8, width: 340, maxWidth: "70vw", borderRadius: 12, background: "#fff", border: "1px solid #E5E5E2", padding: "11px 14px", fontSize: 14, color: "#666663", boxShadow: "0 8px 24px rgb(0 0 0/.1)" }}>
          <span>🔍</span><span style={{ flex: 1, textAlign: "left" }}>Ask anything…</span>
          <kbd style={{ border: "1px solid #E5E5E2", borderRadius: 6, padding: "1px 7px", fontSize: 11 }}>⌘K</kbd>
        </button>
      );
    case 3:
      return (
        <button onClick={onOpen} title="Ask AI" aria-label="Ask AI"
          style={{ ...base, width: 44, height: 44, borderRadius: 999, background: "linear-gradient(135deg,#7C5CFF,#00A878)", color: "#fff", fontSize: 19, border: "none", boxShadow: "0 4px 12px rgb(0 0 0/.2)" }}>✦</button>
      );
    case 4:
      return (
        <span style={{ position: "relative", display: "inline-block" }}>
          <span style={{ position: "absolute", bottom: 52, right: 0, width: 210, background: "#0B0500", color: "#fff", borderRadius: 12, padding: "10px 12px", fontSize: 13, lineHeight: 1.45, boxShadow: "0 8px 24px rgb(0 0 0/.25)" }}>
            Lost? Ask “where is export?” →
            <span style={{ position: "absolute", bottom: -6, right: 16, width: 12, height: 12, background: "#0B0500", transform: "rotate(45deg)" }} />
          </span>
          <button onClick={onOpen} aria-label="Ask Pointery"
            style={{ ...base, width: 44, height: 44, borderRadius: 999, background: "var(--pointery-primary,#00A878)", color: "#fff", fontSize: 20, fontWeight: 700, border: "none", boxShadow: "0 4px 12px rgb(0 0 0/.18)" }}>?</button>
        </span>
      );
    case 5:
      return (
        <button onClick={onOpen} title="Ask Pointery" aria-label="Ask Pointery"
          style={{ ...base, width: 14, height: 14, borderRadius: 999, background: "var(--pointery-primary,#00A878)", border: "2px solid #fff", boxShadow: "0 0 0 4px rgb(0 168 120/.3), 0 2px 8px rgb(0 0 0/.25)", transition: "transform .15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(2.4)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }} />
      );
    case 6:
      return (
        <button onClick={onOpen} style={{ ...base, writingMode: "vertical-rl", letterSpacing: 2, fontSize: 12, fontWeight: 700, background: "#0B0500", color: "#fff", border: "none", borderRadius: "10px 0 0 10px", padding: "14px 8px" }}>ASK ✦</button>
      );
    case 7:
      return (
        <button onClick={onOpen} style={{ ...base, display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #E5E5E2", borderRadius: 999, padding: "6px 14px 6px 6px", boxShadow: "0 4px 12px rgb(0 0 0/.12)", fontSize: 13, fontWeight: 600 }}>
          <span style={{ position: "relative", width: 30, height: 30, borderRadius: 999, background: "var(--pointery-primary,#00A878)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            P<span style={{ position: "absolute", bottom: 0, right: 0, width: 9, height: 9, borderRadius: 999, background: "#22c55e", border: "2px solid #fff" }} />
          </span>
          Ask Pointery <span style={{ color: "#22c55e", fontWeight: 400, fontSize: 12 }}>● online</span>
        </button>
      );
    case 8:
      return (
        <button onClick={onOpen} style={{ ...base, fontSize: 12, color: "#666663", border: "1px dashed #C9CEC4", borderRadius: 999, padding: "7px 12px", background: "rgb(255 255 255/.85)" }}>
          Press <kbd style={{ border: "1px solid #E5E5E2", borderRadius: 5, padding: "0 6px", background: "#fff", fontFamily: "inherit" }}>⇧A</kbd> to ask
        </button>
      );
    default:
      return (
        <button onClick={onOpen} style={{ ...base, display: "flex", alignItems: "center", gap: 8, borderRadius: 10, background: "#fff", border: "1px solid #E5E5E2", padding: "9px 12px", fontSize: 14, fontWeight: 600, boxShadow: "0 4px 12px rgb(0 0 0/.1)" }}>
          ⌘ Ask <kbd style={{ border: "1px solid #E5E5E2", borderRadius: 6, padding: "1px 7px", fontSize: 11, color: "#666663" }}>Ctrl K</kbd>
        </button>
      );
  }
}
