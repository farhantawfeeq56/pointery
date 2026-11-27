"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { notFound } from "next/navigation";
import type { PointeryContext } from "pointery";

type Config = {
  trigger: string;
  theme: { primary: string; radius: number };
  position: "top" | "center" | "bottom";
  suggestions: string[];
  allowActions: string[];
  labels?: { placeholder?: string; empty?: string; confirmTitle?: string };
};

const DEFAULTS: Config = {
  trigger: "shift+a",
  theme: { primary: "#00A878", radius: 14 },
  position: "top",
  suggestions: [],
  allowActions: [],
};

type SaveState = "idle" | "saving" | "saved" | "error";

const ENV_SNIPPET = "POINTERY_LLM_URL=https://api.openai.com/v1/chat/completions\nPOINTERY_LLM_KEY=sk-...\nPOINTERY_LLM_MODEL=gpt-4o-mini";

export default function PointerySettingsPage() {
  const [cfg, setCfg] = useState<Config>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [recording, setRecording] = useState(false);
  const [askOk, setAskOk] = useState<boolean | null>(null);
  const [ctx, setCtx] = useState<PointeryContext | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [llm, setLlm] = useState<{ configured: boolean; host: string; model: string } | null>(null);
  const [preview, setPreview] = useState<"closed" | "open">("open");
  // shortcut: temporary error-state preview aid (vartest) — remove before `npm run pointery:sync-page`, so it never ships in STARTER_SETTINGS_PAGE.
  const [vSave, setVSave] = useState(false);
  const [vAsk, setVAsk] = useState(false);
  const [vLlm, setVLlm] = useState(false);
  const [vCtx, setVCtx] = useState<0 | 1 | 5>(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);

  // Disk is truth: load pointery.config.json + context summary on mount.
  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json().catch(() => null))
      .then((d) => {
        if (d?.config) setCfg({ ...DEFAULTS, ...d.config, theme: { ...DEFAULTS.theme, ...d.config.theme } });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    fetch("/api/admin/context")
      .then((r) => r.json().catch(() => null))
      .then((d) => {
        if (d?.context) setCtx(d.context);
        if (d?.errors) setErrors(d.errors);
      })
      .catch(() => {});
    fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "where is export?" }),
    })
      .then((r) => r.json())
      .then((d) => setAskOk(Boolean(d.spot || d.go || d.action || d.guide || d.answer)))
      .catch(() => setAskOk(false));
    fetch("/api/admin/llm")
      .then((r) => r.json().catch(() => null))
      .then((d) => d && setLlm(d))
      .catch(() => {});
  }, []);

  const prettyShortcut = (t: string) =>
    t.split("+").map((p) => (p === "cmd" ? "⌘" : p === "ctrl" ? "Ctrl" : p === "alt" ? "Alt" : p === "shift" ? "Shift" : p.length === 1 ? p.toUpperCase() : p)).join(" + ");

  // Custom shortcut recorder: next full combo (not bare modifiers) becomes the trigger.
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { setRecording(false); return; }
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return; // wait for the full combo
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push(e.metaKey ? "cmd" : "ctrl");
      if (e.altKey) parts.push("alt");
      if (e.shiftKey) parts.push("shift");
      parts.push(e.key.toLowerCase() === " " ? "space" : e.key.toLowerCase());
      setCfg((c) => ({ ...c, trigger: parts.join("+") }));
      setRecording(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording]);

  // Vartest keys: 1/2/3 toggle save/ask/llm, 4 cycles context 0→1→3→0, 0 resets. Ignored while typing.
  useEffect(() => {
    const onV = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key === "0") { setVSave(false); setVAsk(false); setVLlm(false); setVCtx(0); }
      else if (e.key === "1") setVSave((v) => !v);
      else if (e.key === "2") setVAsk((v) => !v);
      else if (e.key === "3") setVLlm((v) => !v);
      else if (e.key === "4") setVCtx((c) => (c === 0 ? 1 : c === 1 ? 5 : 0));
    };
    window.addEventListener("keydown", onV);
    return () => window.removeEventListener("keydown", onV);
  }, []);

  // Live: apply theme vars + notify the mounted <Pointery/> instantly.
  const broadcast = useCallback((next: Config) => {
    document.documentElement.style.setProperty("--pointery-primary", next.theme.primary);
    document.documentElement.style.setProperty("--pointery-radius", `${next.theme.radius}px`);
    window.dispatchEvent(new CustomEvent("pointery:config", { detail: next }));
  }, []);

  // Auto-save to disk (debounced) on every edit after initial load.
  useEffect(() => {
    if (!loaded || firstRun.current) {
      if (loaded) firstRun.current = false;
      return;
    }
    broadcast(cfg);
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/admin/config", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ config: cfg }),
        });
        setSaveState(r.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [cfg, loaded, broadcast]);

  const saveNow = useCallback(async () => {
    setSaveState("saving");
    try {
      const r = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: cfg }),
      });
      setSaveState(r.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }, [cfg]);

  // Dev-only: writes to disk with no login, so it never renders in production.
  if (process.env.NODE_ENV === "production") notFound();

  const counts = ctx ? `${ctx.entries?.length ?? 0} entries · ${ctx.flows?.length ?? 0} flows · ${ctx.actions?.length ?? 0} actions` : null;

  // Effective (preview-overridden) error states. Clean by default; a live failure only shows when its vartest toggle forces it.
  const effSave: SaveState = vSave ? "error" : saveState === "error" ? "idle" : saveState;
  const effAsk: boolean | null = vAsk ? false : askOk === false ? true : askOk;
  const effLlm = vLlm
    ? { configured: false as boolean, host: "", model: "" }
    : llm && !llm.configured
      ? { configured: true as boolean, host: llm.host || "env", model: llm.model }
      : llm;
  const SAMPLE_CTX_ERRORS = [
    'flows[0] (invite-teammate): steps[2] "nav-teaam" matches no entry',
    'entries[4] (export-button): for looks like live data — keep stable anchors only',
    'actions[1] (invite-teammate): at "nav-teaam" matches no entry',
    'pins[0] (where is export): spot "export-buton" matches no entry',
    'flows[2] (close-deal): no steps',
  ];
  const effErrors: string[] = vCtx === 0 ? [] : vCtx === 1 ? SAMPLE_CTX_ERRORS.slice(0, 1) : SAMPLE_CTX_ERRORS;

  const snippet = `<Pointery\n  trigger="${cfg.trigger}"\n  theme={{ primary: "${cfg.theme.primary}", radius: ${cfg.theme.radius} }}\n  position="${cfg.position}"\n/>`;

  if (!loaded) return <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 text-sm text-zinc-500">Loading Pointery settings…</div>;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- Figtree is intentionally scoped to /pointery; this ships inside the init starter page */}
      <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        :root {
          --color-primary: #00A878;
          --color-primary-hover: #008F65;
          --color-primary-active: #007653;
          --color-primary-subtle: #D8F1A0;
          --color-accent: #FE5E41;
          --color-accent-hover: #E94D32;
          --color-background: #FFFFFF;
          --color-background-secondary: #F8FAF5;
          --color-surface: #FFFFFF;
          --color-surface-secondary: #D8F1A0;
          --color-surface-tertiary: #F3C178;
          --color-surface-inverse: #0B0500;
          --color-text-primary: #0B0500;
          --color-text-secondary: #716D67;
          --color-text-tertiary: #9B9892;
          --color-text-inverse: #FFFFFF;
          --color-text-brand: #00A878;
          --color-text-accent: #FE5E41;
          --color-border: #E8EAE5;
          --color-border-strong: #C9CEC4;
          --color-border-brand: #00A878;
          --color-border-focus: #00A878;
          --color-action-primary: #00A878;
          --color-action-primary-hover: #008F65;
          --color-action-secondary: #D8F1A0;
          --color-action-accent: #FE5E41;
          --color-action-disabled: #E8EAE5;
          --color-success: #00A878;
          --color-success-subtle: #D8F1A0;
          --color-warning: #F3C178;
          --color-warning-text: #0B0500;
          --color-error: #FE5E41;
          --color-error-subtle: #FFF0EC;
          --color-info: #00A878;
          --color-info-subtle: #E8F7F1;
          --shadow-sm: 0 1px 2px rgba(11, 5, 0, 0.05);
          --shadow-md: 0 4px 12px rgba(11, 5, 0, 0.08);
          --shadow-lg: 0 12px 32px rgba(11, 5, 0, 0.12);
        }
        .pointery-settings { font-family: "Figtree", ui-sans-serif, system-ui, sans-serif; background: var(--color-background); color: var(--color-text-primary); }
        .pointery-settings input:not(.font-mono), .pointery-settings select, .pointery-settings textarea:not(.font-mono), .pointery-settings button:not(.font-mono) { font-family: inherit; }
        .py-ok, .py-warn, .py-err, .py-idle, .py-subtle { background: var(--color-background-secondary); color: var(--color-text-secondary); border: 1px solid var(--color-border); }
        .py-ok::before, .py-warn::before, .py-err::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 999px; margin-right: 6px; vertical-align: 1px; }
        .py-ok::before { background: var(--color-success); }
        .py-warn::before { background: var(--color-warning); }
        .py-err::before { background: var(--color-error); }
        .py-inset { background: var(--color-background-secondary); color: var(--color-text-secondary); border-color: var(--color-border); }
        .py-code { background: var(--color-background-secondary); border: 1px solid var(--color-border); color: var(--color-text-primary); }
        .py-save { background: var(--color-action-primary); color: #fff; }
        .py-save:hover { background: var(--color-action-primary-hover); }
      `}</style>
    <div className="pointery-settings w-full flex-1">
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pointery Settings</h1>
          <p className="text-sm text-zinc-500">
            Auto saves to <code className="font-mono">pointery.config.json</code> and updates the palette live.
          </p>
        </div>
        <span
          data-pointery="pointery-settings-save"
          className={`rounded-full px-3 py-1 text-xs font-medium ${effSave === "saved" ? "py-ok" : effSave === "saving" ? "py-warn" : effSave === "error" ? "py-err" : "py-idle"}`}
        >
          {effSave === "saved" ? "Saved ✓" : effSave === "saving" ? "Saving…" : effSave === "error" ? "Save failed" : "Auto-save on"}
        </span>
      </div>

      <div data-pointery="pointery-settings-status" className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full px-3 py-1 font-medium ${effAsk ? "py-ok" : "py-idle"}`}>
          /api/ask {effAsk == null ? "…" : effAsk ? "reachable ✓" : "unreachable"}
        </span>
        <span className={`rounded-full px-3 py-1 font-medium ${effLlm?.configured ? "py-ok" : "py-err"}`}>
          {effLlm == null ? "brain …" : effLlm.configured ? `LLM → ${effLlm.host || "env"}${effLlm.model ? ` / ${effLlm.model}` : ""} ✓` : "LLM required — missing key/url/model"}
        </span>
        {counts && <span className="py-subtle rounded-full px-3 py-1 font-medium">{counts}</span>}
        <span className={`rounded-full px-3 py-1 font-medium ${effErrors.length === 0 ? "py-ok" : "py-err"}`}>
          context {effErrors.length === 0 ? "valid ✓" : `${effErrors.length} error${effErrors.length > 1 ? "s" : ""}`}
        </span>
      </div>
      {effLlm && !effLlm.configured && (
          <div data-pointery="pointery-settings-brain" className="text-xs">
              <p className="font-semibold" style={{ color: "var(--color-error)" }}>Brain setup needed</p>
              <p className="mt-1 text-zinc-500">Add all three to <code className="font-mono">.env.local</code> together, then restart. Without all three, /api/ask fails closed (503).</p>
              <pre className="py-code mt-2 overflow-x-auto rounded-lg p-3 font-mono text-[11px] leading-5">{ENV_SNIPPET}</pre>
            </div>
      )}
      {effErrors.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-red-700">
          {effErrors.slice(0, 3).map((e) => (
            <li key={e}>{e}</li>
          ))}
          {effErrors.length > 3 && <li>+{effErrors.length - 3} more</li>}
        </ul>
      )}

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
        <section data-pointery="pointery-settings-preview" className="self-start lg:order-2 lg:sticky lg:top-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Preview</h2>
              <p className="mt-0.5 text-xs text-zinc-500">How the palette looks in your app. Updates as you edit.</p>
            </div>
            <div className="py-inset flex rounded-full p-1 text-xs font-semibold" role="tablist" aria-label="Preview state">
              {(["closed", "open"] as const).map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={preview === s}
                  onClick={() => setPreview(s)}
                  className={`rounded-full px-4 py-1.5 capitalize transition ${preview === s ? "bg-zinc-900 text-white shadow" : "text-zinc-500 hover:text-zinc-800"}`}
                >
                  {s === "closed" ? "Palette closed" : "Palette open"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border">
            <div className="py-inset flex items-center gap-2 border-b px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
              <span className="ml-2 flex-1 truncate rounded-md bg-white px-3 py-1 font-mono text-[11px] text-zinc-500">yourapp.com/pipeline</span>
            </div>
            <div className="relative">
              <div className="grid min-h-[280px] grid-cols-[110px_1fr]">
                <div className="border-r bg-white p-3">
                  <p className="flex items-center gap-1.5 text-xs font-bold"><span className="h-4 w-4 rounded" style={{ background: cfg.theme.primary }} />Acme</p>
                  <div className="mt-3 space-y-1 text-[11px]">
                    <p className="rounded px-2 py-1 text-zinc-400">Dashboard</p>
                    <p className="rounded px-2 py-1 font-semibold" style={{ background: "color-mix(in srgb, var(--c) 12%, transparent)", ["--c" as string]: cfg.theme.primary }}><span style={{ color: cfg.theme.primary }}>● </span>Pipeline</p>
                    <p className="rounded px-2 py-1 text-zinc-400">Contacts</p>
                    <p className="rounded px-2 py-1 text-zinc-400">Settings</p>
                  </div>
                </div>
                <div className="py-inset p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">Pipeline</p>
                    <div className="flex gap-1.5">
                      <span className="rounded-full border bg-white px-2.5 py-1 text-[10px] font-medium text-zinc-500">Export</span>
                      <span className="px-2.5 py-1 text-[10px] font-semibold text-white" style={{ background: cfg.theme.primary, borderRadius: cfg.theme.radius }}>+ Add deal</span>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {["Acme Corp · $8,000 · Negotiation", "Globex · $12,400 · Proposal"].map((r) => (
                      <p key={r} className="rounded-lg border bg-white px-3 py-2 text-[11px] text-zinc-600">{r}</p>
                    ))}
                  </div>
                </div>
              </div>
              <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center text-base font-bold text-white shadow-lg" style={{ background: cfg.theme.primary, borderRadius: 999 }} title="Ask Pointery">?</span>
              {preview === "open" && (
                <div className={`absolute inset-0 flex justify-center bg-black/25 px-4 ${cfg.position === "center" ? "items-center" : cfg.position === "bottom" ? "items-end pb-6" : "items-start pt-6"}`}>
                  <div className="w-full max-w-[360px] bg-white p-2 shadow-2xl" style={{ borderRadius: cfg.theme.radius }} onClick={(e) => e.stopPropagation()}>
                    <p className="rounded-md border px-3 py-2 text-xs text-zinc-700" style={{ borderRadius: Math.max(4, cfg.theme.radius - 4) }}>{cfg.labels?.placeholder || 'Ask "where is export?"…'}</p>
                    <div className="flex flex-wrap gap-1.5 px-1 pb-1 pt-2">
                      {(cfg.suggestions.length ? cfg.suggestions.slice(0, 3) : ["No suggestions yet — add some above"]).map((s) => (
                        <span key={s} className={`rounded-full border px-2.5 py-1 text-[10px] ${cfg.suggestions.length ? "py-inset" : "text-zinc-400"}`}>{s}</span>
                      ))}
                    </div>
                    <p className="px-1 pt-1 text-[10px] text-zinc-400">{prettyShortcut(cfg.trigger)} toggles · ⌘K works too · Esc closes</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="min-w-0 divide-y divide-zinc-200 lg:order-1">
          <section data-pointery="pointery-settings-shortcut" className="py-8 first:pt-0">
            <h2 className="text-sm font-semibold">Keyboard shortcut</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Recommended presets, or record your own. ⌘/Ctrl+K always works as a secondary.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(["shift+a", "cmd+k"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setCfg({ ...cfg, trigger: v })}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition ${cfg.trigger === v ? "" : "hover:border-zinc-400"}`}
                  style={cfg.trigger === v ? { borderColor: "var(--color-border-brand)", background: "var(--color-primary-subtle)" } : undefined}
                >
                  <span className="font-mono font-semibold">{v === "shift+a" ? "Shift + A" : "⌘/Ctrl + K"}</span>
                  <span className="block text-xs text-zinc-500">{v === "shift+a" ? "Recommended default" : "Recommended minimal"}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setRecording((r) => !r)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${recording ? "bg-amber-500 text-white" : "bg-zinc-900 text-white hover:bg-zinc-700"}`}
              >
                {recording ? "Press keys… (Esc to cancel)" : "Record your own…"}
              </button>
              <span className="text-xs text-zinc-500">
                Current: <kbd className="py-inset rounded px-1.5 py-0.5 font-mono font-semibold">{prettyShortcut(cfg.trigger)}</kbd>
                {cfg.trigger !== "shift+a" && cfg.trigger !== "cmd+k" && <span className="py-subtle ml-1 rounded-full px-2 py-0.5 font-medium">custom</span>}
              </span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">Try it now — press your shortcut anywhere on this page.</p>
          </section>

          <section data-pointery="pointery-settings-brand" className="py-8">
            <h2 className="text-sm font-semibold">Brand</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Primary color + corner radius. Preview updates live.</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="font-medium">Primary color</span>
                <span className="mt-2 flex items-center gap-3">
                  <input type="color" value={cfg.theme.primary} onChange={(e) => setCfg({ ...cfg, theme: { ...cfg.theme, primary: e.target.value } })} className="h-10 w-14 cursor-pointer rounded" />
                  <code className="font-mono text-xs">{cfg.theme.primary}</code>
                </span>
              </label>
              <label className="text-sm">
                <span className="font-medium">Corner radius — {cfg.theme.radius}px</span>
                <input type="range" min={4} max={24} value={cfg.theme.radius} onChange={(e) => setCfg({ ...cfg, theme: { ...cfg.theme, radius: Number(e.target.value) } })} className="mt-3 w-full" />
              </label>
            </div>
          </section>

          <section data-pointery="pointery-settings-behavior" className="py-8">
            <h2 className="text-sm font-semibold">Behavior</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Position, suggestions, allowlisted actions, palette copy.</p>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Palette position</span>
              <select value={cfg.position} onChange={(e) => setCfg({ ...cfg, position: e.target.value as Config["position"] })} className="mt-2 w-full rounded-lg border px-3 py-2">
                <option value="top">Top</option>
                <option value="center">Center</option>
                <option value="bottom">Bottom</option>
              </select>
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Suggestions (one per line)</span>
              <textarea
                value={cfg.suggestions.join("\n")}
                onChange={(e) => setCfg({ ...cfg, suggestions: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                rows={3}
                placeholder={"Where is export?\nHow do I invite a teammate?"}
                className="mt-2 w-full rounded-lg border px-3 py-2 font-mono text-xs"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Allowed actions (comma-separated names from the context)</span>
              <input
                value={cfg.allowActions.join(", ")}
                onChange={(e) => setCfg({ ...cfg, allowActions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                placeholder="export-pipeline, invite-teammate"
                className="mt-2 w-full rounded-lg border px-3 py-2 font-mono text-xs"
              />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="font-medium">Placeholder</span>
                <input value={cfg.labels?.placeholder ?? ""} onChange={(e) => setCfg({ ...cfg, labels: { ...cfg.labels, placeholder: e.target.value } })} placeholder='Ask "where is export?"…' className="mt-2 w-full rounded-lg border px-3 py-2 text-xs" />
              </label>
              <label className="text-sm">
                <span className="font-medium">Empty state</span>
                <input value={cfg.labels?.empty ?? ""} onChange={(e) => setCfg({ ...cfg, labels: { ...cfg.labels, empty: e.target.value } })} placeholder="No match — try…" className="mt-2 w-full rounded-lg border px-3 py-2 text-xs" />
              </label>
              <label className="text-sm">
                <span className="font-medium">Confirm title</span>
                <input value={cfg.labels?.confirmTitle ?? ""} onChange={(e) => setCfg({ ...cfg, labels: { ...cfg.labels, confirmTitle: e.target.value } })} placeholder="Run this action?" className="mt-2 w-full rounded-lg border px-3 py-2 text-xs" />
              </label>
            </div>
          </section>

          <div className="flex items-center gap-3 py-8">
            <button onClick={saveNow} className="py-save w-fit rounded-full px-6 py-2.5 text-sm font-semibold">
              {saveState === "saved" ? "Saved ✓" : "Save now"}
            </button>
            <p className="text-xs text-zinc-500">Edits auto-save ~1s after you stop typing — no reload needed.</p>
          </div>
        </div>
      </div>

      {ctx && (
        <div data-pointery="pointery-settings-context" className="border-t border-zinc-200 pt-8 text-sm">
          <h2 className="text-sm font-semibold">Context <span className="font-normal text-zinc-500">(read-only — edit <code className="font-mono">pointery.context.json</code>)</span></h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left uppercase tracking-wider text-zinc-400">
                <tr><th className="py-1 pr-3">id</th><th className="py-1 pr-3">page</th><th className="py-1">label — for</th></tr>
              </thead>
              <tbody className="divide-y font-mono">
                {(ctx.entries ?? []).map((t) => (
                  <tr key={t.id}><td className="py-1 pr-3">{t.id}</td><td className="py-1 pr-3">{t.page}</td><td className="py-1">{t.label}{t.for ? ` — ${t.for}` : ""}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-mono text-xs text-zinc-500">
            flows: {(ctx.flows ?? []).map((g) => `${g.id} (${g.steps.length})`).join(", ") || "—"} · actions:{" "}
            {(ctx.actions ?? []).map((a) => `${a.name}${a.confirm ? " ⚠" : ""}`).join(", ") || "—"}
          </p>
        </div>
      )}

      <div data-pointery="pointery-settings-snippet" className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-800">
        <pre className="overflow-x-auto font-mono text-[13px] leading-6 text-zinc-800">{snippet}</pre>
        <button
          onClick={() => { navigator.clipboard.writeText(snippet); }}
          className="mt-3 rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white"
        >
          Copy snippet
        </button>
      </div>

      {/* vartest toolbar: temporary, dev-only preview of error states. Remove before sync. */}
      <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-white shadow-xl">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">errors preview · keys 0–4</p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={vSave} onChange={() => setVSave((v) => !v)} className="h-3.5 w-3.5 accent-red-500" /> Save fail <span className="text-zinc-500">[1]</span>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={vAsk} onChange={() => setVAsk((v) => !v)} className="h-3.5 w-3.5 accent-red-500" /> Ask down <span className="text-zinc-500">[2]</span>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={vLlm} onChange={() => setVLlm((v) => !v)} className="h-3.5 w-3.5 accent-red-500" /> LLM missing <span className="text-zinc-500">[3]</span>
          </label>
          <span className="flex items-center gap-1" role="group" aria-label="Context errors">
            <span className="text-zinc-400">ctx</span>
            {([0, 1, 5] as const).map((n) => (
              <button
                key={n}
                onClick={() => setVCtx(n)}
                className={`rounded-full px-2.5 py-0.5 font-semibold ${vCtx === n ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}
              >
                {n}
              </button>
            ))}
            <span className="text-zinc-500">[4]</span>
          </span>
          <button onClick={() => { setVSave(false); setVAsk(false); setVLlm(false); setVCtx(0); }} className="rounded-full bg-zinc-700 px-2.5 py-0.5 font-semibold hover:bg-zinc-600">reset [0]</button>
        </div>
      </div>
    </div>
    </div>
    </>
  );
}
