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
  labels: {
    placeholder: 'Ask "where is export?" or "how do I invite?"',
    empty: "No match - try “export”, “invite”, or “pipeline”.",
    confirmTitle: "Run this action?",
    asking: "Asking…",
    blocked: "“{action}” needs approval - taking you there instead.",
    done: "Done - {action}.",
    unreachable: "Pointery is unreachable - is {endpoint} mounted?",
    pressEnter: "No match - press Enter to ask anyway.",
    guideComplete: "Guide complete.",
    ambiguous: "Several rows match - showing “{title}”.",
    confirmBody: "“{action}” needs your confirmation.",
    back: "Back",
    next: "Next",
    doneBtn: "Done",
    cancel: "Cancel",
    confirmBtn: "Confirm",
    fabLabel: "Ask Pointery",
  },
  endpoint: "/api/ask",
  timing: { toastMs: 4200, pulseMs: 2600, closeMs: 160, focusMs: 30, navigateMs: 450, navigateIdleMs: 50 },
  fab: true as boolean | string,
  hiddenRoutes: ["/"],
};

// shortcut: {token} templates in labels - unknown tokens left as-is.
const fmt = (t: string, vars: Record<string, string>) =>
  t.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

export function pulse(key: string, filter?: string, ms = 2600) {
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
    window.setTimeout(() => target.classList.remove("pointery-pulse"), ms);
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
  // single-char triggers (e.g. "?") need shift to type - don't require it off.
  if (!(t.key.length === 1 && !t.mod && !t.alt)) {
    if (e.shiftKey !== t.shift) return false;
  }
  if (e.altKey !== t.alt) return false;
  if (e.ctrlKey || e.metaKey ? !t.mod : t.mod) return false;
  return true;
}

export default function Pointery(props: PointeryProps) {
  const cfg = {
    ...DEFAULTS, ...props,
    theme: { ...DEFAULTS.theme, ...props.theme },
    labels: { ...DEFAULTS.labels, ...props.labels },
    timing: { ...DEFAULTS.timing, ...props.timing },
  };
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [guide, setGuide] = useState<GuideState>(null);
  const [pendingAction, setPendingAction] = useState<{ name: string; label: string; target?: string } | null>(null);
  const [guideIdx, setGuideIdx] = useState(0);
  const [sel, setSel] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const say = useCallback((text: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text });
    toastTimer.current = window.setTimeout(() => setToast(null), cfg.timing.toastMs);
  }, [cfg.timing.toastMs]);

  // Animated close: plays the exit animation, then unmounts the palette.
  const close = useCallback(() => {
    if (!open) return;
    if (!cfg.animation || cfg.animation === "none" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setOpen(false); return; }
    setLeaving(true);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => { setOpen(false); setLeaving(false); }, cfg.timing.closeMs);
  }, [open, cfg.animation, cfg.timing.closeMs]);

  // Drop a pending exit timer on unmount.
  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);

  // apply theme vars (+ white-label passthrough)
  useEffect(() => {
    const root = document.documentElement;
    if (cfg.theme.primary) root.style.setProperty("--pointery-primary", cfg.theme.primary);
    if (cfg.theme.accent) root.style.setProperty("--pointery-accent", cfg.theme.accent);
    if (cfg.theme.background) root.style.setProperty("--color-surface", cfg.theme.background);
    if (cfg.theme.text) root.style.setProperty("--color-text-primary", cfg.theme.text);
    if (cfg.theme.border) root.style.setProperty("--color-border", cfg.theme.border);
    if (cfg.theme.radius != null) root.style.setProperty("--pointery-radius", `${cfg.theme.radius}px`);
    if (cfg.zIndex != null) root.style.setProperty("--pointery-z", String(cfg.zIndex));
    if (cfg.paletteWidth != null) root.style.setProperty("--pointery-width", `${cfg.paletteWidth}px`);
    if (cfg.overlayBlur != null) root.style.setProperty("--pointery-overlay-blur", `${cfg.overlayBlur}px`);
    if (cfg.cssVars) for (const [k, v] of Object.entries(cfg.cssVars)) root.style.setProperty(k.startsWith("--") ? k : `--pointery-${k}`, v);
  }, [cfg.theme.primary, cfg.theme.accent, cfg.theme.background, cfg.theme.text, cfg.theme.border, cfg.theme.radius, cfg.zIndex, cfg.paletteWidth, cfg.overlayBlur, cfg.cssVars]);

  // Several rows matched the filter - toast which one is shown.
  useEffect(() => {
    const onAmbiguous = (e: Event) => {
      const title = (e as CustomEvent<string>).detail;
      if (title) say(fmt(cfg.labels.ambiguous!, { title }));
    };
    window.addEventListener("pointery:ambiguous", onAmbiguous);
    return () => window.removeEventListener("pointery:ambiguous", onAmbiguous);
  }, [say, cfg.labels.ambiguous]);

  // Esc always closes; cfg.trigger toggles - even while typing in the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); setGuide(null); setPendingAction(null); return; }
      if (triggerMatches(e, cfg.trigger)) {
        e.preventDefault();
        if (open) close();
        else {
          if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
          setLeaving(false);
          setSel(0);
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, cfg.trigger, close]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), cfg.timing.focusMs); }, [open, cfg.timing.focusMs]);

  // Default action behavior: log + event + toast. Consumers override
  // via onAction for real side-effects (their data stays theirs).
  const runAction = useCallback(async (name: string, label?: string) => {
    if (props.onAction) return props.onAction(name);
    try {
      const log = JSON.parse(localStorage.getItem("pointery-actions") ?? "[]");
      log.push({ name, at: Date.now() });
      localStorage.setItem("pointery-actions", JSON.stringify(log));
    } catch { /* storage unavailable - event still fires */ }
    window.dispatchEvent(new CustomEvent("pointery:action", { detail: name }));
    say(fmt(cfg.labels.done!, { action: label ?? name }));
  }, [props, say, cfg.labels.done]);

  const goSpot = useCallback((go?: string, spot?: string, hint?: string, filter?: string) => {
    if (go) router.push(go as never);
    if (spot) setTimeout(() => pulse(spot, filter, cfg.timing.pulseMs), go ? cfg.timing.navigateMs : cfg.timing.navigateIdleMs);
    if (hint) say(hint);
  }, [router, say, cfg.timing.pulseMs, cfg.timing.navigateMs, cfg.timing.navigateIdleMs]);

  // Submit closes the palette at once; the answer surfaces as toast, guide
  // card, confirm dialog, navigation and pulse - nothing waits on a row click.
  const ask = useCallback(async (query: string) => {
    const queryText = query.trim();
    if (!queryText) return;
    close();
    // Palette is gone, so pending state lives in the toast slot - every
    // outcome below replaces it (answer, hint, done, empty, unreachable).
    say(cfg.labels.asking!);
    try {
      const r = await fetch(cfg.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: queryText, page: window.location.pathname }) });
      const data = (await r.json()) as PointeryResult;
      // One toast per ask: the first message wins, the rest stay silent.
      let announced = false;
      if (data.answer) { say(data.answer); announced = true; }
      const walkthrough = data.plan ?? data.guide;
      if (walkthrough) {
        setGuide({ title: walkthrough.title, steps: walkthrough.steps, i: 0 });
        setGuideIdx(0);
        // Card is the feedback - dismiss the Asking toast instead of leaving it stale.
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        setToast(null);
        const first = walkthrough.steps[0];
        // Card shows the step - announce silently (navigate + pulse only).
        if (first) goSpot(first.go, first.spot, undefined, "filter" in first ? first.filter : undefined);
        announced = true;
      }
      // Blocked actions fall through to spot/go below - never execute.
      if (data.action && !cfg.allowActions.includes(data.action)) {
        const subject = (data.actionLabel ?? data.action) + (data.actionTarget ? ` on ${data.actionTarget}` : "");
        say(fmt(cfg.labels.blocked!, { action: subject }));
        announced = true;
        data.action = undefined;
      }
      if (data.action) {
        const label = data.actionLabel ?? data.hint ?? data.action;
        const subject = label + (data.actionTarget ? ` on ${data.actionTarget}` : "");
        if (data.confirm === false) await runAction(data.action, subject);
        else {
          // Confirm dialog speaks for itself - drop the pending toast.
          if (toastTimer.current) window.clearTimeout(toastTimer.current);
          setToast(null);
          setPendingAction({ name: data.action, label: subject });
        }
      }
      else if (!walkthrough && (data.go || data.spot)) goSpot(data.go, data.spot, announced ? undefined : data.hint, data.filter);
      else if (!announced) say(cfg.labels.empty!);
    } catch {
      say(fmt(cfg.labels.unreachable!, { endpoint: cfg.endpoint }));
    }
  }, [cfg.allowActions, cfg.labels, cfg.endpoint, goSpot, runAction, say, close]);

  if (!open && !guide && !toast && !pendingAction) {
    if (cfg.fab === false) return null;
    const glyph = typeof cfg.fab === "string" ? cfg.fab : "?";
    return (
      <button
        onClick={() => { setSel(0); setOpen(true); }}
        aria-label={cfg.labels.fabLabel}
        className="pointery-fab"
        title={`${cfg.labels.fabLabel} (${cfg.trigger})`}
      >{glyph}</button>
    );
  }

  const pos = cfg.position === "center" ? "pointery-pos-center" : cfg.position === "bottom" ? "pointery-pos-bottom" : "pointery-pos-top";
  const anim = !cfg.animation || cfg.animation === "none" ? "" : `pointery-anim-${cfg.animation}`;
  // Classic list of the config suggestions, filtered as you type.
  // Submit (or a row click) closes the palette and asks - no result rows;
  // the answer acts directly (toast, guide card, confirm, navigate, pulse).
  const needle = q.trim().toLowerCase();
  const rows = (cfg.suggestions ?? []).filter((s) => s.trim() && (!needle || s.toLowerCase().includes(needle)));
  const active = rows.length ? Math.min(sel, rows.length - 1) : 0;

  return (
    <>
      {toast && (
        <div key={toast.id} className={["pointery-toast", anim].filter(Boolean).join(" ")} role="status">{toast.text}</div>
      )}

      {guide && (
        <div className="pointery-guide" role="dialog" aria-label={guide.title}>
          <button className="pointery-guide-close" onClick={() => setGuide(null)} aria-label="Close guide">✕</button>
          <div className="pointery-guide-title">{guide.title} <span>· {guideIdx + 1}/{guide.steps.length}</span></div>
          <p className="pointery-guide-step">{guide.steps[guideIdx]?.text}</p>
          <div className="pointery-guide-row">
            <button disabled={guideIdx === 0} onClick={() => { const n = guideIdx - 1; setGuideIdx(n); const s = guide.steps[n]; goSpot(s.go, s.spot, undefined, s.filter); }}>{cfg.labels.back}</button>
            {guideIdx < guide.steps.length - 1
              ? <button className="primary" onClick={() => { const n = guideIdx + 1; setGuideIdx(n); const s = guide.steps[n]; goSpot(s.go, s.spot, undefined, s.filter); }}>{cfg.labels.next}</button>
              : <button className="primary" onClick={() => { setGuide(null); say(cfg.labels.guideComplete!); }}>{cfg.labels.doneBtn}</button>}
          </div>
        </div>
      )}

      {pendingAction && (
        <div className="pointery-confirm" role="alertdialog" aria-label={cfg.labels.confirmTitle}>
          <p><strong>{cfg.labels.confirmTitle}</strong><br />{fmt(cfg.labels.confirmBody!, { action: pendingAction.label })}</p>
          <div className="pointery-guide-row">
            <button onClick={() => setPendingAction(null)}>{cfg.labels.cancel}</button>
            <button className="primary" onClick={async () => { const a = pendingAction; setPendingAction(null); close(); await runAction(a.name, a.label); }}>{cfg.labels.confirmBtn}</button>
          </div>
        </div>
      )}

      {(open || leaving) && (
        <div className={`pointery-overlay ${pos}${leaving ? " pointery-leaving" : ""}`} onClick={close}>
          <div className={["pointery-palette", anim, leaving && "pointery-leaving"].filter(Boolean).join(" ")} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ask Pointery">
            <form onSubmit={(e) => { e.preventDefault(); const hit = rows[active]; if (hit) { setQ(hit); setSel(0); void ask(hit); } else void ask(q); }}>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setPendingAction(null); setSel(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, Math.max(rows.length - 1, 0))); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
                }}
                placeholder={cfg.labels.placeholder}
                aria-label="Ask Pointery"
                role="combobox"
                aria-controls="pointery-list"
                aria-expanded={rows.length > 0}
                aria-activedescendant={rows.length ? `pointery-opt-${active}` : undefined}
              />
            </form>
            <div className="pointery-view">
            {rows.length > 0 && (
              <ul id="pointery-list" className="pointery-list" role="listbox" aria-label="Suggestions">
                {rows.map((s, i) => (
                  <li key={s} id={`pointery-opt-${i}`} role="option" aria-selected={i === active}>
                    <button className="pointery-row" data-active={i === active} onMouseEnter={() => setSel(i)} onClick={() => { setQ(s); setSel(0); void ask(s); }}>
                      <span className="pointery-row-dot" aria-hidden />
                      <span className="pointery-row-text">{s}</span>
                      <kbd>↵</kbd>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {rows.length === 0 && q.trim() && (
              <p className="pointery-meta">{cfg.labels.pressEnter}</p>
            )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
