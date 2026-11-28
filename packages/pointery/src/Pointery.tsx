"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PointeryProps, PointeryResult } from "./types.js";
import { getSuggestions } from "./resolver.js";

type Toast = { id: number; text: string } | null;
type GuideState = { title: string; steps: { text: string; go: string; spot: string; filter?: string }[]; i: number } | null;

const DEFAULTS = {
  trigger: "shift+a",
  theme: { primary: "#00A878", radius: 14 },
  position: "top" as const,
  animation: "slide" as const,
  suggestions: getSuggestions(),
  allowActions: [],
  labels: { placeholder: 'Ask "where is export?" or "how do I invite?"', empty: "No match — try “export”, “invite”, or “pipeline”.", confirmTitle: "Run this action?" },
  endpoint: "/api/ask",
};

export function pulse(key: string, filter?: string) {
  // Toast-friendly row title: join cells, not raw textContent (which glues words).
  const rowTitle = (row: Element) => {
    const cells = Array.from(row.querySelectorAll("td, th"))
      .map((c) => (c.textContent ?? "").trim())
      .filter(Boolean);
    const text = cells.length ? cells.join(" · ") : ((row.textContent ?? "").trim().replace(/\s+/g, " "));
    return text.slice(0, 60);
  };
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-pointery="${key}"]`);
    if (!el) return;
    // rows:true container + filter: pulse the matching row, else the container.
    let target: Element = el;
    const needle = filter?.trim().toLowerCase();
    if (needle) {
      const rows = el.querySelectorAll("tr, li, [role=row]");
      const pool: Element[] = rows.length ? Array.from(rows) : Array.from(el.children);
      const hits = pool.filter((n) => (n.textContent ?? "").toLowerCase().includes(needle));
      if (hits[0]) {
        target = hits[0];
        if (hits.length > 1) {
          const title = rowTitle(hits[0]);
          if (title) window.dispatchEvent(new CustomEvent("pointery:ambiguous", { detail: title }));
        }
      }
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("pointery-pulse");
    // restart animation
    void (target as HTMLElement).offsetWidth;
    target.classList.add("pointery-pulse");
    window.setTimeout(() => target.classList.remove("pointery-pulse"), 2600);
  });
}

// trigger format: "+"-joined combo, e.g. "shift+a", "cmd+k", "ctrl+shift+p".
// ctrl/cmd are treated as the same primary mod so presets work cross-platform.
function parseTrigger(t: string) {
  const parts = t.toLowerCase().split("+").map((s) => s.trim()).filter(Boolean);
  const key = parts.pop() ?? "";
  return {
    key,
    shift: parts.includes("shift"),
    mod: parts.includes("ctrl") || parts.includes("cmd") || parts.includes("meta") || parts.includes("control") || parts.includes("command"),
    alt: parts.includes("alt") || parts.includes("opt") || parts.includes("option"),
  };
}

function triggerMatches(e: KeyboardEvent, trigger: string) {
  const t = parseTrigger(trigger);
  if (!t.key || e.key.toLowerCase() !== t.key) return false;
  // single-char triggers (e.g. "?") need shift to type — don't require it off.
  if (!(t.key.length === 1 && !t.mod && !t.alt)) {
    if (e.shiftKey !== t.shift) return false;
  }
  if (e.altKey !== t.alt) return false;
  if (e.ctrlKey || e.metaKey ? !t.mod : t.mod) return false;
  return true;
}

export default function Pointery(props: PointeryProps) {
  const cfg = { ...DEFAULTS, ...props, theme: { ...DEFAULTS.theme, ...props.theme }, labels: { ...DEFAULTS.labels, ...props.labels } };
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<PointeryResult | null>(null);
  const [resSeq, setResSeq] = useState(0); // bumps per answer so the result state re-animates
  const [toast, setToast] = useState<Toast>(null);
  const [guide, setGuide] = useState<GuideState>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [guideIdx, setGuideIdx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const say = useCallback((text: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text });
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  // Animated close: plays the exit animation, then unmounts the palette.
  const close = useCallback(() => {
    if (!open) return;
    if (!cfg.animation || cfg.animation === "none" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setOpen(false); return; }
    setLeaving(true);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => { setOpen(false); setLeaving(false); }, 160);
  }, [open, cfg.animation]);

  // Drop a pending exit timer on unmount.
  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);

  // apply theme vars
  useEffect(() => {
    const root = document.documentElement;
    if (cfg.theme.primary) root.style.setProperty("--pointery-primary", cfg.theme.primary);
    if (cfg.theme.radius != null) root.style.setProperty("--pointery-radius", `${cfg.theme.radius}px`);
  }, [cfg.theme.primary, cfg.theme.radius]);

  // Several rows matched the filter — toast which one is shown.
  useEffect(() => {
    const onAmbiguous = (e: Event) => {
      const title = (e as CustomEvent<string>).detail;
      if (title) say(`Several rows match — showing “${title}”.`);
    };
    window.addEventListener("pointery:ambiguous", onAmbiguous);
    return () => window.removeEventListener("pointery:ambiguous", onAmbiguous);
  }, [say]);

  // Esc always closes; cfg.trigger toggles — even while typing in the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); setGuide(null); setPendingAction(null); return; }
      if (triggerMatches(e, cfg.trigger)) {
        e.preventDefault();
        if (open) close();
        else {
          if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
          setLeaving(false);
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, cfg.trigger, close]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); }, [open ]);

  // Default action behavior: log + event + toast. Consumers override
  // via onAction for real side-effects (their data stays theirs).
  const runAction = useCallback(async (name: string) => {
    if (props.onAction) return props.onAction(name);
    try {
      const log = JSON.parse(localStorage.getItem("pointery-actions") ?? "[]");
      log.push({ name, at: Date.now() });
      localStorage.setItem("pointery-actions", JSON.stringify(log));
    } catch { /* storage unavailable — event still fires */ }
    window.dispatchEvent(new CustomEvent("pointery:action", { detail: name }));
    say(`Done — ${name}.`);
  }, [props, say]);

  const goSpot = useCallback((go?: string, spot?: string, hint?: string, filter?: string) => {
    if (go) router.push(go as never);
    if (spot) setTimeout(() => pulse(spot, filter), go ? 450 : 50);
    if (hint) say(hint);
  }, [router, say]);

  const ask = useCallback(async (query: string) => {
    const queryText = query.trim();
    if (!queryText) return;
    setLoading(true);
    try {
      const r = await fetch(cfg.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: queryText, page: window.location.pathname }) });
      const data = (await r.json()) as PointeryResult;
      setRes(data); setResSeq((s) => s + 1);
      if (data.answer) say(data.answer);
      if (data.plan) { setGuide({ title: data.plan.title, steps: data.plan.steps, i: 0 }); setGuideIdx(0); }
      else if (data.guide) { setGuide({ title: data.guide.title, steps: data.guide.steps, i: 0 }); setGuideIdx(0); }
      // Blocked actions fall through to spot/go/guide below — never execute.
      if (data.action && !cfg.allowActions.includes(data.action)) {
        say(`“${data.action}” needs approval — taking you there instead.`);
        data.action = undefined;
      }
      if (data.action) {
        if (data.confirm === false) { close(); await runAction(data.action); }
        else setPendingAction(data.action);
      }
      else if (data.go || data.spot) goSpot(data.go, data.spot, data.hint, data.filter);
      else if (!data.answer && !data.guide && !data.plan) say(cfg.labels.empty!);
    } catch {
      say(`Pointery is unreachable — is ${cfg.endpoint} mounted?`);
    } finally { setLoading(false); }
  }, [cfg.allowActions, cfg.labels.empty, cfg.endpoint, goSpot, runAction, say, close]);

  const startGuide = (g: NonNullable<GuideState>) => {
    const s = g.steps[guideIdx];
    if (s) goSpot(s.go, s.spot, `${g.title} — step ${guideIdx + 1}/${g.steps.length}: ${s.text}`, s.filter);
  };

  if (!open && !guide && !toast && !pendingAction) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask Pointery"
        className="pointery-fab"
        title={`Ask Pointery (${cfg.trigger})`}
      >?</button>
    );
  }

  const pos = cfg.position === "center" ? "pointery-pos-center" : cfg.position === "bottom" ? "pointery-pos-bottom" : "pointery-pos-top";
  const anim = !cfg.animation || cfg.animation === "none" ? "" : `pointery-anim-${cfg.animation}`;
  // Keyed wrapper remounts (replaying the enter animation) on every state swap.
  const hasRes = Boolean(res && (res.go || res.spot || res.action || res.guide || res.plan));
  const viewKey = loading ? "loading" : hasRes ? `result-${resSeq}` : !q ? "suggest" : "empty";

  return (
    <>
      {toast && (
        <div key={toast.id} className={["pointery-toast", anim].filter(Boolean).join(" ")} role="status">{toast.text}</div>
      )}

      {guide && (
        <div className="pointery-guide" role="dialog" aria-label={guide.title}>
          <div className="pointery-guide-title">{guide.title} <span>· {guideIdx + 1}/{guide.steps.length}</span></div>
          <p className="pointery-guide-step">{guide.steps[guideIdx]?.text}</p>
          <div className="pointery-guide-row">
            <button disabled={guideIdx === 0} onClick={() => { const n = guideIdx - 1; setGuideIdx(n); const s = guide.steps[n]; goSpot(s.go, s.spot, undefined, s.filter); }}>Back</button>
            {guideIdx < guide.steps.length - 1
              ? <button className="primary" onClick={() => { const n = guideIdx + 1; setGuideIdx(n); const s = guide.steps[n]; goSpot(s.go, s.spot, s.text, s.filter); }}>Next</button>
              : <button className="primary" onClick={() => { setGuide(null); say("Guide complete."); }}>Done</button>}
            <button onClick={() => setGuide(null)} aria-label="Close guide">✕</button>
          </div>
        </div>
      )}

      {pendingAction && (
        <div className="pointery-confirm" role="alertdialog" aria-label={cfg.labels.confirmTitle}>
          <p><strong>{cfg.labels.confirmTitle}</strong><br />“{pendingAction}” — destructive actions need your OK.</p>
          <div className="pointery-guide-row">
            <button onClick={() => setPendingAction(null)}>Cancel</button>
            <button className="primary" onClick={async () => { const a = pendingAction; setPendingAction(null); close(); await runAction(a); }}>Confirm</button>
          </div>
        </div>
      )}

      {(open || leaving) && (
        <div className={`pointery-overlay ${pos}${leaving ? " pointery-leaving" : ""}`} onClick={close}>
          <div className={["pointery-palette", anim, leaving && "pointery-leaving"].filter(Boolean).join(" ")} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ask Pointery">
            <form onSubmit={(e) => { e.preventDefault(); ask(q); }}>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setRes(null); setPendingAction(null); }}
                placeholder={cfg.labels.placeholder}
                aria-label="Ask Pointery"
              />
            </form>
            <div key={viewKey} className="pointery-view">
            {loading && <p className="pointery-meta">Thinking…</p>}
            {!q && (
              <div className="pointery-suggest">
                {(cfg.suggestions ?? []).map((s, i) => (
                  s.trim() ? <button key={i} onClick={() => { setQ(s); ask(s); }}>{s}</button> : null
                ))}
              </div>
            )}
            {!loading && res && (res.go || res.spot || res.action || res.guide || res.plan) && (
              <div className="pointery-result">
                {res.hint && <p><strong>{res.hint}</strong></p>}
                <div className="pointery-guide-row">
                  {(res.go || res.spot) && <button className="primary" onClick={() => { goSpot(res.go, res.spot, res.hint, res.filter); close(); }}>Take me there</button>}
                  {res.plan && <button className="primary" onClick={() => { setGuideIdx(0); startGuide({ title: res.plan!.title, steps: res.plan!.steps, i: 0 }); close(); }}>Start steps ({res.plan!.steps.length})</button>}
                  {res.guide && !res.plan && <button className="primary" onClick={() => { setGuideIdx(0); startGuide({ title: res.guide!.title, steps: res.guide!.steps, i: 0 }); close(); }}>Start guide</button>}
                  {res.action && <button className="primary" onClick={async () => { const a = res.action!; if (res.confirm) { close(); setPendingAction(a); } else { close(); await runAction(a); } }}>Run action</button>}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
