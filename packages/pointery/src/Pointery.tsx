"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PointeryProps, PointeryResult, PointeryRouteOverride } from "./types.js";
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
    done: "Completed “{action}”.",
    unreachable: "Can't reach the helper - check your connection and try again. Error code: ASK_UNREACHABLE.",
    missing: "Sorry - we can't locate that on this page.",
    timeout: "That's taking too long - try again. Error code: ASK_TIMEOUT.",
    badResponse: "Something's wrong on our end - unexpected reply. Error code: ASK_BAD_RESPONSE.",
    emptyQuery: "Type anything to ask - I'll take it from there.",
    guideComplete: "Guide completed.",
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
  timing: { toastMs: 4200, pulseMs: 2600, closeMs: 160, focusMs: 30, navigateMs: 450, navigateIdleMs: 50, askMs: 30000 },
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
    if (!el) {
      // shortcut: dev-only console line names the dead anchor; users get the toast via pointery:missing.
      if (process.env.NODE_ENV !== "production") console.warn(`[pointery] missing anchor "${key}" - no data-pointery in rendered DOM`);
      window.dispatchEvent(new CustomEvent("pointery:missing", { detail: key }));
      return;
    }
    // rows:true container + filter: pulse the matching row, else the container.
    let target: Element = el;
    const needle = filter?.trim().toLowerCase();
    if (needle) {
      const rows = el.querySelectorAll("tr, li, [role=row]");
      const pool: Element[] = rows.length ? Array.from(rows) : Array.from(el.children);
      const hits = pool.filter((n) => (n.textContent ?? "").toLowerCase().includes(needle));
      if (hits.length > 1) {
        // Close together (one unbroken run): a single ring around the group -
        // box-shadow/outline don't paint reliably on individual table rows.
        const parent = hits[0].parentElement;
        const order = parent ? Array.from(parent.children) : [];
        const at = hits.map((h) => order.indexOf(h));
        const run = parent !== null && at.every((i) => i >= 0) && Math.max(...at) - Math.min(...at) + 1 === hits.length;
        const title = rowTitle(hits[0]);
        if (title) window.dispatchEvent(new CustomEvent("pointery:ambiguous", { detail: title }));
        if (!run) {
          // Scattered matches: pulse each one where it stands.
          const first = hits[0];
          first.scrollIntoView({ behavior: "smooth", block: "center" });
          for (const h of hits) h.classList.remove("pointery-pulse");
          // restart animation
          void document.body.offsetWidth;
          for (const h of hits) h.classList.add("pointery-pulse");
          window.setTimeout(() => {
            for (const h of hits) h.classList.remove("pointery-pulse");
          }, ms);
          return;
        }
        // run: target stays the container - one ring around the whole group.
      } else if (hits[0]) target = hits[0];
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
  // Per-page override: exact path wins, `"/demo/*"` matches anything under it (longest first).
  const here = props.route ?? (typeof window !== "undefined" ? window.location.pathname : undefined);
  let over: PointeryRouteOverride = {};
  if (here && props.routes) {
    if (props.routes[here]) over = props.routes[here];
    else for (const k of Object.keys(props.routes).sort((a, b) => b.length - a.length))
      if (k.endsWith("/*") && here.startsWith(k.slice(0, -1))) { over = props.routes[k]; break; }
  }
  const base = { ...props, ...over };
  const cfg = {
    ...DEFAULTS, ...base,
    theme: { ...DEFAULTS.theme, ...props.theme, ...over.theme },
    labels: { ...DEFAULTS.labels, ...props.labels, ...over.labels },
    timing: { ...DEFAULTS.timing, ...props.timing, ...over.timing },
    closed: { ...props.closed, ...over.closed },
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

  // Single string dep: adding future theme keys changes the key, never the deps size (HMR-safe).
  const themeKey = JSON.stringify([cfg.theme.primary, cfg.theme.accent, cfg.theme.background, cfg.theme.text, cfg.theme.border, cfg.theme.radius, cfg.theme.fontFamily, cfg.zIndex, cfg.paletteWidth, cfg.overlayBlur, cfg.cssVars]);
  // apply theme vars (+ white-label passthrough)
  useEffect(() => {
    const root = document.documentElement;
    if (cfg.theme.primary) root.style.setProperty("--pointery-primary", cfg.theme.primary);
    if (cfg.theme.accent) root.style.setProperty("--pointery-accent", cfg.theme.accent);
    if (cfg.theme.background) root.style.setProperty("--color-surface", cfg.theme.background);
    if (cfg.theme.text) root.style.setProperty("--color-text-primary", cfg.theme.text);
    if (cfg.theme.border) root.style.setProperty("--color-border", cfg.theme.border);
    if (cfg.theme.radius != null) root.style.setProperty("--pointery-radius", `${cfg.theme.radius}px`);
    if (cfg.theme.fontFamily) root.style.setProperty("--pointery-font", cfg.theme.fontFamily);
    if (cfg.zIndex != null) root.style.setProperty("--pointery-z", String(cfg.zIndex));
    if (cfg.paletteWidth != null) root.style.setProperty("--pointery-width", `${cfg.paletteWidth}px`);
    if (cfg.overlayBlur != null) root.style.setProperty("--pointery-overlay-blur", `${cfg.overlayBlur}px`);
    if (cfg.cssVars) for (const [k, v] of Object.entries(cfg.cssVars)) root.style.setProperty(k.startsWith("--") ? k : `--pointery-${k}`, v);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- themeKey covers every value read above
  }, [themeKey]);

  // Several rows matched the filter - toast which one is shown.
  useEffect(() => {
    const onAmbiguous = (e: Event) => {
      const title = (e as CustomEvent<string>).detail;
      if (title) say(fmt(cfg.labels.ambiguous!, { title }));
    };
    window.addEventListener("pointery:ambiguous", onAmbiguous);
    return () => window.removeEventListener("pointery:ambiguous", onAmbiguous);
  }, [say, cfg.labels.ambiguous]);

  // Anchor isn't in the DOM - say so instead of failing silently.
  useEffect(() => {
    const onMissing = () => { say(cfg.labels.missing!); };
    window.addEventListener("pointery:missing", onMissing);
    return () => window.removeEventListener("pointery:missing", onMissing);
  }, [say, cfg.labels.missing]);

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
    if (!queryText) { say(cfg.labels.emptyQuery!); return; }
    close();
    // Palette is gone, so pending state lives in the toast slot - every
    // outcome below replaces it (answer, hint, done, empty, unreachable).
    say(cfg.labels.asking!);
    // A hanging ask strands the user - time out instead of spinning forever.
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), cfg.timing.askMs);
    try {
      const r = await fetch(cfg.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: queryText, page: window.location.pathname }), signal: ctrl.signal });
      const data = (await r.json().catch(() => null)) as PointeryResult | null;
      if (!data) { say(cfg.labels.badResponse!); return; }
      // One toast per ask: the first message wins, the rest stay silent.
      let announced = false;
      if (data.answer) { say(data.answer); announced = true; }
      // Degenerate walkthroughs (no steps) would render a broken card - drop them so the miss path handles it.
      const rawWalkthrough = data.plan ?? data.guide;
      const walkthrough = rawWalkthrough && Array.isArray(rawWalkthrough.steps) && rawWalkthrough.steps.length > 0 ? rawWalkthrough : undefined;
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
      // Allowlist is enforced up front - blocked actions never execute.
      // Full action sentence: the row record reads inside the label ("Mark deal Acme as Won"), then the anchor ("on Pipeline table").
      const subjectOf = () => {
        const label = data.actionLabel ?? data.hint ?? data.action ?? "";
        const record = (data.filter ?? "").trim();
        const named = record
          ? (/\bdeal\b/i.test(label) ? label.replace(/\bdeal\b/i, (m) => `${m} ${record}`) : `${label} (${record})`)
          : label;
        return named + (data.actionTarget ? ` on ${data.actionTarget}` : "");
      };
      // Not allowlisted: tell the user, navigate if there's a destination - otherwise stop right here.
      if (data.action && !cfg.allowActions.includes(data.action)) {
        say(fmt(cfg.labels.blocked!, { action: subjectOf() }));
        if (data.go || data.spot) goSpot(data.go, data.spot, undefined, data.filter);
        return;
      }
      if (data.action) {
        const subject = subjectOf();
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
      say(ctrl.signal.aborted ? cfg.labels.timeout! : fmt(cfg.labels.unreachable!, { endpoint: cfg.endpoint }));
    } finally {
      window.clearTimeout(timer);
    }
  }, [cfg.allowActions, cfg.labels, cfg.endpoint, cfg.timing.askMs, goSpot, runAction, say, close]);

  // Closed state: `closed` wins, legacy `fab` fills in (false hides, string = glyph).
  const closed = cfg.closed ?? {};
  const legacyGlyph = typeof cfg.fab === "string" ? cfg.fab : undefined;
  const shut = cfg.closed === undefined && cfg.fab === false;
  const icon = closed.icon ?? legacyGlyph ?? "?";
  const label = closed.label ?? "Ask";
  const prettyTrigger = cfg.trigger
    .split("+").map((p) => p.trim()).filter(Boolean)
    .map((p) =>
      p === "shift" ? "⇧" : p === "ctrl" || p === "control" ? "Ctrl" :
      p === "cmd" || p === "meta" || p === "command" ? "⌘" :
      p === "alt" || p === "opt" || p === "option" ? "Alt" : p.toUpperCase()
    ).join(" ");
  const hint = closed.hint ?? prettyTrigger;
  const showHint = closed.showHint ?? true;
  // Image icons (buyer logo): absolute/remote/data URLs render as <img>, else text glyph.
  const isImg = /^(https?:\/\/|data:|blob:|\/)/.test(icon);
  const iconNode = isImg
    // eslint-disable-next-line @next/next/no-img-element -- kit stays Next-independent; buyer logos are tiny local files, not LCP candidates
    ? <img src={icon} alt="" aria-hidden className="pointery-closed-img" />
    : <span aria-hidden>{icon}</span>;
  const openPalette = () => { setSel(0); setOpen(true); };
  const hintChip = showHint && hint
    ? <kbd className="pointery-closed-kbd">{hint}</kbd>
    : null;

  if (!open && !guide && !toast && !pendingAction) {
    if (shut) return null;
    const common = {
      onClick: openPalette,
      "aria-label": cfg.labels.fabLabel,
      title: `${cfg.labels.fabLabel} (${cfg.trigger})`,
    };
    switch (closed.variant ?? "fab") {
      case "pill":
        return <button {...common} className="pointery-closed-pill">{iconNode}<span>{label}</span>{hintChip}</button>;
      case "tab":
        return <button {...common} className="pointery-closed-tab">{iconNode}<span>{label}</span>{hintChip}</button>;
      case "helper":
        return (
          <button {...common} className="pointery-closed-helper">
            <span className="pointery-closed-avatar">{iconNode}<span className="pointery-closed-dot" /></span>
            <span>{label}</span><span className="pointery-closed-online">● online</span>
          </button>
        );
      case "ghost":
        return <button {...common} className="pointery-closed-ghost">Press {hint ? <kbd className="pointery-closed-kbd">{hint}</kbd> : "the shortcut"} to ask</button>;
      default:
        return <button {...common} className="pointery-fab">{iconNode}</button>;
    }
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
