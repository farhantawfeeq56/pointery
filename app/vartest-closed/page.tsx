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

const BLURBS = [
  "Baseline: tiny ? circle. Invisible until needed — but nobody guesses what it does.",
  "Pill says the verb: “Ask” + shortcut. Costs ~120px, earns discovery.",
  "Fake search field, bottom-center. Users already know this pattern from Raycast/Linear.",
  "✦ instead of ?: reads as AI, not help-desk. Same footprint as classic.",
  "? + one-line coach mark (“Lost? try me”). Nudge once, dismiss forever.",
  "12px pulsing dot; grows to ? on hover. For apps where chrome must vanish.",
  "Vertical ASK tab on the right edge. Impossible to miss, always out of the way.",
  "Human face: avatar + “online”. Friendly — borrows Intercom trust.",
  "No button at all — just a kbd hint. Power-user minimal; zero pixels.",
  "⌘ button + kbd chip. Speaks command-palette language devs expect.",
];

function Launcher({ i, onOpen }: { i: number; onOpen: () => void }) {
  const base: React.CSSProperties = { cursor: "pointer", fontFamily: "inherit" };
  switch (i) {
    case 0:
      return (
        <button onClick={onOpen} title="Ask Pointery (⇧A)" aria-label="Ask Pointery"
          style={{ ...base, width: 44, height: 44, borderRadius: 999, background: "#00A878", color: "#fff", fontSize: 20, fontWeight: 700, border: "none", boxShadow: "0 4px 12px rgb(0 0 0/.18)" }}>?</button>
      );
    case 1:
      return (
        <button onClick={onOpen} style={{ ...base, display: "flex", alignItems: "center", gap: 8, borderRadius: 999, background: "#0B0500", color: "#fff", border: "none", padding: "10px 14px", fontSize: 14, fontWeight: 600, boxShadow: "0 4px 12px rgb(0 0 0/.2)" }}>
          ✦ Ask <kbd style={{ background: "rgb(255 255 255/.15)", borderRadius: 6, padding: "1px 7px", fontSize: 11 }}>⇧A</kbd>
        </button>
      );
    case 2:
      return (
        <button onClick={onOpen} style={{ ...base, display: "flex", alignItems: "center", gap: 8, width: 340, maxWidth: "60%", borderRadius: 12, background: "#fff", border: "1px solid #E5E5E2", padding: "11px 14px", fontSize: 14, color: "#666663", boxShadow: "0 8px 24px rgb(0 0 0/.1)" }}>
          <span>🔍</span><span style={{ flex: 1, textAlign: "left" }}>Ask anything…</span>
          <kbd style={{ border: "1px solid #E5E5E2", borderRadius: 6, padding: "1px 7px", fontSize: 11 }}>⌘K</kbd>
        </button>
      );
    case 3:
      return (
        <button onClick={onOpen} title="Ask AI (⇧A)" aria-label="Ask AI"
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
            style={{ ...base, width: 44, height: 44, borderRadius: 999, background: "#00A878", color: "#fff", fontSize: 20, fontWeight: 700, border: "none", boxShadow: "0 4px 12px rgb(0 0 0/.18)" }}>?</button>
        </span>
      );
    case 5:
      return (
        <button onClick={onOpen} title="Ask Pointery" aria-label="Ask Pointery"
          style={{ ...base, width: 14, height: 14, borderRadius: 999, background: "#00A878", border: "2px solid #fff", boxShadow: "0 0 0 4px rgb(0 168 120/.3), 0 2px 8px rgb(0 0 0/.25)", transition: "transform .15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(2.4)"; e.currentTarget.textContent = ""; }}
          onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"} />
      );
    case 6:
      return (
        <button onClick={onOpen} style={{ ...base, writingMode: "vertical-rl", letterSpacing: 2, fontSize: 12, fontWeight: 700, background: "#0B0500", color: "#fff", border: "none", borderRadius: "10px 0 0 10px", padding: "14px 8px" }}>ASK ✦</button>
      );
    case 7:
      return (
        <button onClick={onOpen} style={{ ...base, display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #E5E5E2", borderRadius: 999, padding: "6px 14px 6px 6px", boxShadow: "0 4px 12px rgb(0 0 0/.12)", fontSize: 13, fontWeight: 600 }}>
          <span style={{ position: "relative", width: 30, height: 30, borderRadius: 999, background: "#00A878", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            P<span style={{ position: "absolute", bottom: 0, right: 0, width: 9, height: 9, borderRadius: 999, background: "#22c55e", border: "2px solid #fff" }} />
          </span>
          Ask Pointery <span style={{ color: "#22c55e", fontWeight: 400, fontSize: 12 }}>● online</span>
        </button>
      );
    case 8:
      return (
        <span style={{ fontSize: 12, color: "#666663", border: "1px dashed #C9CEC4", borderRadius: 999, padding: "7px 12px", background: "rgb(255 255 255/.7)" }}>
          Press <kbd style={{ border: "1px solid #E5E5E2", borderRadius: 5, padding: "0 6px", background: "#fff", fontFamily: "inherit" }}>⇧A</kbd> to ask
        </span>
      );
    default:
      return (
        <button onClick={onOpen} style={{ ...base, display: "flex", alignItems: "center", gap: 8, borderRadius: 10, background: "#fff", border: "1px solid #E5E5E2", padding: "9px 12px", fontSize: 14, fontWeight: 600, boxShadow: "0 4px 12px rgb(0 0 0/.1)" }}>
          ⌘ Ask <kbd style={{ border: "1px solid #E5E5E2", borderRadius: 6, padding: "1px 7px", fontSize: 11, color: "#666663" }}>Ctrl K</kbd>
        </button>
      );
  }
}

export default function VarTestClosed() {
  const [idx, setIdx] = useState(0);
  const [opened, setOpened] = useState(false);
  const go = useCallback((n: number) => { setIdx(((n % 10) + 10) % 10); setOpened(false); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Escape") { setOpened(false); return; }
      if (e.key >= "1" && e.key <= "9") go(Number(e.key) - 1);
      else if (e.key === "0") go(9);
      else if (e.key === "ArrowRight") go(idx + 1);
      else if (e.key === "ArrowLeft") go(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, go]);

  // Hide the real global palette on this lab page — variants here are mocks.
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = ".pointery-fab,.pointery-overlay,.pointery-toast{display:none!important}";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const centered = idx === 2;
  const edge = idx === 6;

  return (
    <div style={{ minHeight: "100vh", background: "#F2F2EF", padding: "40px 20px 140px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <p style={{ fontSize: 12, letterSpacing: 2, color: "#666663", fontWeight: 700 }}>VARTEST · CLOSED STATE · 10 IDEAS</p>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: "6px 0" }}>{idx + 1}. {NAMES[idx]}</h1>
        <p style={{ color: "#666663", fontSize: 15, maxWidth: 620 }}>{BLURBS[idx]}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => go(idx - 1)} style={navBtn}>← Prev</button>
          <button onClick={() => go(idx + 1)} style={navBtn}>Next →</button>
          <span style={{ alignSelf: "center", fontSize: 12, color: "#666663" }}>keys 1–9, 0 · ←/→ · click launcher to preview open</span>
        </div>

        {/* fake app canvas */}
        <div style={{ position: "relative", marginTop: 20, background: "#FDFFFC", border: "1px solid #E5E5E2", borderRadius: 20, overflow: "hidden", minHeight: 420, boxShadow: "0 12px 32px rgb(0 0 0/.08)" }}>
          <div style={{ display: "flex", gap: 24, padding: 28 }}>
            <div style={{ width: 150 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#666663" }}>DEMO CRM</p>
              {["Dashboard", "Pipeline", "Contacts", "Settings"].map((n) => (
                <div key={n} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 14, fontWeight: n === "Dashboard" ? 700 : 400, background: n === "Dashboard" ? "#F2F2EF" : "none" }}>{n}</div>
              ))}
              <div style={{ marginTop: 16, background: "#F2F2EF", borderRadius: 12, padding: 10, fontSize: 12, color: "#666663" }}>
                Press <kbd style={kbd}>⇧A</kbd> and ask “where is export?”
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>Good morning, Farhan</h2>
              <p style={{ fontSize: 13, color: "#666663" }}>Here’s what needs you today. (Fake app — launcher is the thing under test.)</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
                {[["Open pipeline", "$48,200"], ["Closing soon", "2 deals"], ["Tasks", "3 open"]].map(([a, b]) => (
                  <div key={a} style={{ border: "1px solid #E5E5E2", borderRadius: 14, padding: 14 }}>
                    <p style={{ fontSize: 11, color: "#666663", textTransform: "uppercase", letterSpacing: 1 }}>{a}</p>
                    <p style={{ fontSize: 22, fontWeight: 700 }}>{b}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* launcher under test */}
          <div style={edge
            ? { position: "absolute", right: 0, top: "45%" }
            : centered
              ? { position: "absolute", bottom: 24, left: 0, right: 0, display: "flex", justifyContent: "center" }
              : { position: "absolute", bottom: 24, right: 24 }}>
            <Launcher i={idx} onOpen={() => setOpened(true)} />
          </div>

          {/* mock open palette */}
          {opened && (
            <div onClick={() => setOpened(false)} style={{ position: "absolute", inset: 0, background: "rgb(11 5 0/.25)", display: "flex", justifyContent: "center", paddingTop: 70 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: "86%", height: "fit-content", background: "#fff", borderRadius: 14, padding: 12, boxShadow: "0 12px 32px rgb(0 0 0/.2)" }}>
                <input autoFocus placeholder='Ask "where is export?"…' style={{ width: "100%", border: "1px solid #E5E5E2", borderRadius: 10, padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }} />
                {["Where is export?", "How do I invite a teammate?", "Show me the pipeline table"].map((s) => (
                  <div key={s} style={{ padding: "9px 6px", fontSize: 14, borderTop: "1px solid #F2F2EF" }}>● {s}</div>
                ))}
                <p style={{ fontSize: 11, color: "#666663", margin: "4px 2px 0" }}>mock open — Esc / click out to close · variant {idx + 1}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* floating segmented switcher, bottom-right */}
      <div style={{ position: "fixed", bottom: 18, right: 18, zIndex: 80, display: "flex", alignItems: "center", gap: 2, background: "#0B0500", borderRadius: 999, padding: 5, boxShadow: "0 8px 24px rgb(0 0 0/.3)" }} role="tablist" aria-label="Variants">
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
    </div>
  );
}

const navBtn: React.CSSProperties = { border: "1px solid #E5E5E2", background: "#fff", borderRadius: 999, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const kbd: React.CSSProperties = { border: "1px solid #E5E5E2", background: "#fff", borderRadius: 5, padding: "0 6px", fontFamily: "monospace" };
