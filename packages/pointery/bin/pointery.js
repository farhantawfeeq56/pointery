#!/usr/bin/env node
// `npx pointery init` — drop starter files into the consumer's app.
// Zero dependencies. Never overwrites without --force.
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const cmd = args[0];
const force = args.includes("--force");
const check = args.includes("--check");
const cwd = process.cwd();

const STARTER_CONTEXT = {
  version: 2,
  entries: [
    { id: "export-button", page: "/dashboard", label: "Export", for: "Downloads the report as CSV", type: "button", aliases: ["csv"] },
    { id: "pointery-settings-status", page: "/pointery", label: "Status", for: "Ask health, brain and context validity", type: "section" },
    { id: "pointery-settings-shortcut", page: "/pointery", label: "Shortcut", for: "Keyboard trigger for the palette", type: "section" },
    { id: "pointery-settings-brand", page: "/pointery", label: "Brand", for: "Primary color and corner radius", type: "section" },
    { id: "pointery-settings-behavior", page: "/pointery", label: "Behavior", for: "Position, suggestions and actions", type: "section" },
    { id: "pointery-settings-preview", page: "/pointery", label: "Preview", for: "Palette open and closed states in a sample page", type: "section" },
    { id: "pointery-settings-save", page: "/pointery", label: "Save", for: "Writes pointery.config.json to disk", type: "button" },
    { id: "pointery-settings-context", page: "/pointery", label: "Context", for: "Entries, flows and actions from disk", type: "section" },
    { id: "pointery-settings-snippet", page: "/pointery", label: "Snippet", for: "The Pointery mount code to copy", type: "section" },
  ],
  flows: [
    { id: "export-report", title: "Export your report", aliases: ["export"], steps: ["export-button"] },
  ],
  actions: [
    { name: "export-report", label: "Export report CSV", confirm: false, at: "export-button" },
  ],
};

const STARTER_CONFIG = {
  trigger: "shift+a",
  theme: { primary: "#00A878", radius: 14 },
  position: "top",
  suggestions: ["Where is export?"],
  allowActions: ["export-report"],
};

// Minimal GET+PUT for pointery.config.json (disk is truth). The /pointery
// settings page reads via GET and auto-saves via PUT.
const STARTER_ADMIN_CONFIG_ROUTE = `import { promises as fs } from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "pointery.config.json");

export async function GET() {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return Response.json({ config: JSON.parse(raw) });
  } catch (e) {
    return Response.json({ error: \`Cannot read pointery.config.json: \${e}\` }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  // Local Studio only: refuse disk writes in production unconditionally.
  // Edit the file directly and redeploy — no env-flag bypass, no login of our own.
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Refusing to write pointery.config.json in production. Edit the file directly and redeploy." }, { status: 403 });
  }
  let config: unknown;
  try {
    const body = await req.json();
    config = (body as { config?: unknown }).config ?? body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return Response.json({ error: "Config must be a JSON object" }, { status: 400 });
  }
  await fs.writeFile(FILE, JSON.stringify(config, null, 2) + "\\n", "utf8");
  return Response.json({ ok: true });
}
`;

// Starter SaaS settings page. Same contract as the harness /pointery page:
// loads config via GET, auto-saves via PUT (debounced) + Save button,
// applies theme vars live, dispatches pointery:config so the mounted
// <Pointery/> (wrapper listens) updates without reload. Degrades gracefully
// when /api/admin/context or /api/admin/llm are absent.
const STARTER_SETTINGS_PAGE = `"use client";

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

  // Live: apply theme vars + notify the mounted <Pointery/> instantly.
  const broadcast = useCallback((next: Config) => {
    document.documentElement.style.setProperty("--pointery-primary", next.theme.primary);
    document.documentElement.style.setProperty("--pointery-radius", \`\${next.theme.radius}px\`);
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

  const counts = ctx ? \`\${ctx.entries?.length ?? 0} entries · \${ctx.flows?.length ?? 0} flows · \${ctx.actions?.length ?? 0} actions\` : null;

  const snippet = \`<Pointery\\n  trigger="\${cfg.trigger}"\\n  theme={{ primary: "\${cfg.theme.primary}", radius: \${cfg.theme.radius} }}\\n  position="\${cfg.position}"\\n/>\`;

  if (!loaded) return <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 text-sm text-zinc-500">Loading Pointery settings…</div>;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- Figtree is intentionally scoped to /pointery; this ships inside the init starter page */}
      <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{\`
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
        .py-ok { background: var(--color-success-subtle); color: var(--color-primary-active); }
        .py-warn { background: var(--color-warning); color: var(--color-warning-text); }
        .py-err { background: var(--color-error); color: #fff; }
        .py-idle { background: var(--color-background-secondary); color: var(--color-text-secondary); border: 1px solid var(--color-border); }
        .py-inset { background: var(--color-background-secondary); color: var(--color-text-secondary); border-color: var(--color-border); }
        .py-subtle { background: var(--color-success-subtle); color: var(--color-text-primary); }
        .py-save { background: var(--color-action-primary); color: #fff; }
        .py-save:hover { background: var(--color-action-primary-hover); }
      \`}</style>
    <div className="pointery-settings w-full flex-1">
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-brand)" }}>Pointery · Settings</p>
          <h1 className="text-2xl font-semibold tracking-tight">Make it yours</h1>
          <p className="text-sm text-zinc-500">
            Shortcuts, brand, behavior — auto-saves to <code className="font-mono">pointery.config.json</code> and updates the palette live.
          </p>
        </div>
        <span
          data-pointery="pointery-settings-save"
          className={\`rounded-full px-3 py-1 text-xs font-medium \${saveState === "saved" ? "py-ok" : saveState === "saving" ? "py-warn" : saveState === "error" ? "py-err" : "py-idle"}\`}
        >
          {saveState === "saved" ? "Saved ✓" : saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Auto-save on"}
        </span>
      </div>

      <div data-pointery="pointery-settings-status" className="flex flex-wrap gap-2 text-xs">
        <span className={\`rounded-full px-3 py-1 font-medium \${askOk ? "py-ok" : "py-idle"}\`}>
          /api/ask {askOk == null ? "…" : askOk ? "reachable ✓" : "unreachable"}
        </span>
        <span className={\`rounded-full px-3 py-1 font-medium \${llm?.configured ? "py-ok" : "py-err"}\`}>
          {llm == null ? "brain …" : llm.configured ? \`LLM → \${llm.host || "env"}\${llm.model ? \` / \${llm.model}\` : ""} ✓\` : "LLM required — missing key/url/model"}
        </span>
        {counts && <span className="py-subtle rounded-full px-3 py-1 font-medium">{counts}</span>}
        <span className={\`rounded-full px-3 py-1 font-medium \${errors.length === 0 ? "py-ok" : "py-err"}\`}>
          context {errors.length === 0 ? "valid ✓" : \`\${errors.length} error\${errors.length > 1 ? "s" : ""}\`}
        </span>
      </div>
      {llm && !llm.configured && (
        <div className="border-l-2 border-red-400 pl-4 text-xs text-red-800">
          <p className="font-semibold">Brain setup — one step, one restart (key stays in env, this page never handles it).</p>
          <p className="mt-1">Add all three to <code className="font-mono">.env.local</code> together — copy the exact model id from your provider dashboard:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-3 font-mono text-[11px] leading-5 text-zinc-800">POINTERY_LLM_URL=https://api.openai.com/v1/chat/completions{"\\n"}POINTERY_LLM_KEY=sk-...{"\\n"}POINTERY_LLM_MODEL=gpt-4o-mini</pre>
          <p className="mt-1 text-red-700">OpenRouter/Ollama work too — same 3 lines, different URL + model. Without all three, /api/ask fails closed (503).</p>
        </div>
      )}
      {errors.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-red-700">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
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
                  className={\`rounded-full px-4 py-1.5 capitalize transition \${preview === s ? "bg-zinc-900 text-white shadow" : "text-zinc-500 hover:text-zinc-800"}\`}
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
                <div className={\`absolute inset-0 flex justify-center bg-black/25 px-4 \${cfg.position === "center" ? "items-center" : cfg.position === "bottom" ? "items-end pb-6" : "items-start pt-6"}\`}>
                  <div className="w-full max-w-[360px] bg-white p-2 shadow-2xl" style={{ borderRadius: cfg.theme.radius }} onClick={(e) => e.stopPropagation()}>
                    <p className="rounded-md border px-3 py-2 text-xs text-zinc-700" style={{ borderRadius: Math.max(4, cfg.theme.radius - 4) }}>{cfg.labels?.placeholder || 'Ask "where is export?"…'}</p>
                    <div className="flex flex-wrap gap-1.5 px-1 pb-1 pt-2">
                      {(cfg.suggestions.length ? cfg.suggestions.slice(0, 3) : ["No suggestions yet — add some above"]).map((s) => (
                        <span key={s} className={\`rounded-full border px-2.5 py-1 text-[10px] \${cfg.suggestions.length ? "py-inset" : "text-zinc-400"}\`}>{s}</span>
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
                  className={\`rounded-xl border px-4 py-3 text-left text-sm transition \${cfg.trigger === v ? "" : "hover:border-zinc-400"}\`}
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
                className={\`rounded-full px-4 py-2 text-sm font-semibold transition \${recording ? "bg-amber-500 text-white" : "bg-zinc-900 text-white hover:bg-zinc-700"}\`}
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
                value={cfg.suggestions.join("\\n")}
                onChange={(e) => setCfg({ ...cfg, suggestions: e.target.value.split("\\n").map((s) => s.trim()).filter(Boolean) })}
                rows={3}
                placeholder={"Where is export?\\nHow do I invite a teammate?"}
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
                  <tr key={t.id}><td className="py-1 pr-3">{t.id}</td><td className="py-1 pr-3">{t.page}</td><td className="py-1">{t.label}{t.for ? \` — \${t.for}\` : ""}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-mono text-xs text-zinc-500">
            flows: {(ctx.flows ?? []).map((g) => \`\${g.id} (\${g.steps.length})\`).join(", ") || "—"} · actions:{" "}
            {(ctx.actions ?? []).map((a) => \`\${a.name}\${a.confirm ? " ⚠" : ""}\`).join(", ") || "—"}
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
    </div>
    </div>
    </>
  );
}
`;

// One-shot map-maker prompt. Same content ships as POINTERY_PROMPT.md
// so `init` alone gives the buyer everything: package + prompt.
const STARTER_PROMPT = `# POINTERY_PROMPT.md — the map-maker (ships with \`npx pointery init\`, per stack)

Paste this into your coding agent (Cursor / Claude / Copilot). It scans your
app and fills \`pointery.context.json\` — the ship-time index of stable UI anchors
your LLM ranks on every ask (\`/api/ask\` sends the top-ranked slice as system
context in an OpenAI-compatible \`{ model, messages }\` call to your own model — the LLM is required, there is no
keyless mode). Re-run whenever your UI changes.

---

**Prompt:**

> My app uses Pointery (in-app ask-anything: palette → /api/ask → pulse /
> navigate / guide / action). The file \`pointery.context.json\` is the context
> my LLM gets with every query — keep it accurate and small. Do this:
>
> 1. Scan \`app/**\` (routes, components). Find every user-facing control a user
>    might ask for: nav items, buttons, tables, search inputs. Index stable
>    anchors only — never per-record ids (no \`deal-acme\`), never live values
>    (no \`$8,000\`, counts, totals). For lists, index the container
>    (\`pipeline-table\`), not the rows; the client finds the row text at runtime.
>    Mark the container with rows:true so the model can answer instance queries
>    ("where is the Acme deal") with filter ("Acme") alongside that spot —
>    the client pulses the matching row, else the container.
> 2. Add a stable \`data-pointery="kebab-id"\` to each. Only real selectors that
>    exist in the rendered DOM — never invent ids. Keep ids stable across
>    refactors.
> 3. Update \`pointery.context.json\` to match — identity + purpose + place,
>    no sentences, no live values:
>    \`{ version: 2, entries: [{ id, page, label, for, type, aliases?, rows? }],
>    flows: [{ id, title, steps: [entryId...], aliases? }],
>    actions: [{ name, label, confirm, at, aliases? }],
>    pins?: [{ match, aliases?, spot?, go?, action?, guide?, hint? }] }\`
>    - \`pins[]\` = curated fast-path (optional): exact-phrase wins checked
>      before generic scoring, served locally with no LLM. Strict match only
>      (no word-overlap). Use for golden demo paths; the rest still
>      resolves generically.
>    - \`label\`: the element's own words ("Export"). \`for\`: stable purpose,
>      one clause ("Downloads the pipeline as CSV") — never an instruction.
>    - \`aliases\`: non-obvious synonyms only ("csv"). Matching derives from
>      label + for; never list phrasings ("where is export" doesn't belong here).
>    - \`flows[].steps\` = entry ids in walk order; wording is generated, not stored.
>    - \`actions[].at\` = the entry id it runs against.
>    - \`confirm: true\` for anything destructive (delete, charge, send, close).
>    - rows:true on containers whose children are runtime data (deal, contact,
>      chat rows). Only then may the model set filter alongside that spot —
>      the server drops it otherwise, and the keyword fallback never sets it.
> 4. Keep it small: max ~40 entries, ~10 flows, only allowlisted actions.
>    Delete stale ids for removed UI.
> 5. Run \`npx pointery init --check\` and fix whatever it reports (guide step
>    pointing at a missing target or wrong page, live \`$\` data baked into the map).
> 6. Brain (my key, my bill, required — one step): walk me through it — add \`POINTERY_LLM_URL\` (my model endpoint: OpenAI-compatible chat-completions URL, or native Anthropic \`…/v1/messages\` / Gemini \`…:generateContent\` — auto-detected), \`POINTERY_LLM_KEY\`, AND \`POINTERY_LLM_MODEL\` (exact model id as the provider spells it) to \`.env.local\` together, restart dev, and
>    verify with “where is export?”. Without all three, \`/api/ask\` fails closed (503). OpenAI defaults the model to \`gpt-4o-mini\` when unset; every other provider needs it. Never print or commit the key.
> 7. Settings page (\`/pointery\`): \`init\` already dropped a starter
>    (Next: \`app/pointery/page.tsx\` + \`app/api/admin/config/route.ts\`;
>    other stacks: build the equivalent). SaaS-style controls for shortcut
>    (trigger), brand (primary color + radius with live preview), and
>    behavior (position, suggestions, allowActions, palette copy). It loads
>    \`pointery.config.json\` via GET, auto-saves edits via PUT (debounced)
>    plus a Save button (PUT is dev-only and refuses in production — edit the
>    file directly and redeploy), applies theme vars live, and dispatches a
>    \`pointery:config\` CustomEvent with the new config so the mounted
>    \`<Pointery/>\` (whose client wrapper listens for it) updates without
>    reload. Personalize it on first run from the files you just wrote:
>    status probe and example suggestions must use real queries from the
>    context (a flow title, an entry label — never the "export"
>    placeholder if the app has no export), and defaults (trigger, theme,
>    position, allowActions) must mirror \`pointery.config.json\`. Tag its
>    controls with \`data-pointery\` ids and keep the matching
>    \`pointery-settings-*\` entries on page \`/pointery\` in sync; re-run step 5.
>
> Then show me the wiring diff: mount \`<Pointery/>\` once in \`layout.tsx\`
> (via a client wrapper that loads \`pointery.config.json\` and listens for
> \`pointery:config\`), gated off marketing pages (wrapper returns null on
> \`/\`, or mount only in the \`(app)\` group layout), ensure \`/api/ask\` calls
> \`createAskHandler(context, { llm: { url, key, model } })\` (required — no keyless mode), and confirm
> \`/pointery\` saves to disk, done.

**Rules for the agent:** no fake selectors, \`confirm:true\` on destructive,
re-run on UI change. This file is versioned per stack (Next / Vue / HTML) —
update it without re-publishing npm.
`;

// Persistent rule for the buyer's AGENTS.md: every prod UI change keeps the
// context file in sync, so the LLM never answers from a stale map.
const AGENTS_START = "<!-- pointery:start -->";
const AGENTS_END = "<!-- pointery:end -->";
const AGENTS_BLOCK = `${AGENTS_START} — do not remove; \`npx pointery init --force\` refreshes this block.
## Pointery — keep pointery.context.json in sync
- \`pointery.context.json\` is the index of stable UI anchors (\`/api/ask\` sends the top-ranked slice as system context in an OpenAI-compatible \`{ model, messages }\` call to our own model). Keep it small and current: max ~40 entries, ~10 flows, allowlisted actions only.
- Whenever you add, move, rename, or remove a user-facing control or route: update its \`data-pointery="kebab-id"\` in code AND its entry in \`pointery.context.json\` (label + purpose; \`confirm: true\` for destructive actions). Keep ids stable; never invent selectors — only ids present in the rendered DOM.
- After any UI change, run \`npx pointery init --check\` (fails when a flow step points at a missing entry) and fix what it reports.
${AGENTS_END}`;

const SNIPPET = `import { Pointery } from "pointery";
import "pointery/styles.css";

// once in your root layout, next to {children}:
<Pointery />
// API route (app/api/ask/route.ts):
// import { createAskHandler } from "pointery";
// import context from "@/pointery.context.json";
// export const POST = createAskHandler(context, { llm: { url: process.env.POINTERY_LLM_URL ?? "", key: process.env.POINTERY_LLM_KEY ?? "", model: process.env.POINTERY_LLM_MODEL ?? "" } });`;

function write(name, data) {
  const p = path.join(cwd, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (fs.existsSync(p) && !force) {
    console.log(`skip  ${name} (exists — use --force to overwrite)`);
    return;
  }
  fs.writeFileSync(p, typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n");
  console.log(`wrote ${name}`);
}

// Idempotent AGENTS.md upsert: create, append, or refresh only our block.
function upsertAgents() {
  const p = path.join(cwd, "AGENTS.md");
  const existing = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  if (existing.includes(AGENTS_START) && existing.includes(AGENTS_END)) {
    if (!force) {
      console.log("skip  AGENTS.md (pointery block present)");
      return;
    }
    const next = existing.replace(
      new RegExp(`${AGENTS_START}[\\s\\S]*?${AGENTS_END}`),
      () => AGENTS_BLOCK
    );
    fs.writeFileSync(p, next.endsWith("\n") ? next : next + "\n");
    console.log("wrote AGENTS.md (pointery block refreshed)");
    return;
  }
  const sep = existing === "" ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
  fs.writeFileSync(p, existing + sep + AGENTS_BLOCK + "\n");
  console.log(existing === "" ? "wrote AGENTS.md" : "wrote AGENTS.md (pointery block appended)");
}

if (cmd === "init") {
  write("pointery.context.json", STARTER_CONTEXT);
  write("pointery.config.json", STARTER_CONFIG);
  write("POINTERY_PROMPT.md", STARTER_PROMPT);
  // Starter /pointery settings page (Next App Router only — other stacks: see prompt step 7).
  if (fs.existsSync(path.join(cwd, "app"))) {
    write("app/pointery/page.tsx", STARTER_SETTINGS_PAGE);
    write("app/api/admin/config/route.ts", STARTER_ADMIN_CONFIG_ROUTE);
  } else {
    console.log("skip  app/pointery/page.tsx (no app/ dir — non-Next stack; see prompt step 7)");
  }
  upsertAgents();
  console.log("\nNext: paste POINTERY_PROMPT.md into your coding agent to map your UI,");
  console.log("then mount <Pointery/> once in layout.tsx:\n\n" + SNIPPET);

  if (check) {
    const ctx = JSON.parse(fs.readFileSync(path.join(cwd, "pointery.context.json"), "utf8"));
    const problems = [];
    const ids = new Set((ctx.entries || []).map((t) => t.id));
    const looksLive = (s) => typeof s === "string" && /\$\s*\d/.test(s);
    (ctx.entries || []).forEach((t, i) => {
      if (!t.id) problems.push(`entries[${i}]: missing id`);
      if (!t.page) problems.push(`entries[${i}] (${t.id || "?"}): missing page`);
      if (!t.label) problems.push(`entries[${i}] (${t.id || "?"}): missing label`);
      if (t.label && looksLive(t.label)) problems.push(`entries[${i}] (${t.id}): label looks like live data — keep stable anchors only`);
      if (t.for && looksLive(t.for)) problems.push(`entries[${i}] (${t.id}): for looks like live data — keep stable anchors only`);
    });
    (ctx.flows || []).forEach((g, i) =>
      (g.steps || []).forEach((s) => {
        if (!ids.has(s)) problems.push(`flows[${i}]: step "${s}" matches no entry`);
      })
    );
    (ctx.actions || []).forEach((a, i) => {
      if (a.at && !ids.has(a.at)) problems.push(`actions[${i}] (${a.name || "?"}): at "${a.at}" matches no entry`);
    });
    const _pages = new Set((ctx.entries || []).map((t) => t.page));
    const _flows = new Set((ctx.flows || []).map((g) => g.id));
    const _acts = new Set((ctx.actions || []).map((a) => a.name));
    (ctx.pins || []).forEach((p, i) => {
      if (!p.match) problems.push(`pins[${i}]: missing match`);
      if (!p.spot && !p.go && !p.action && !p.guide) problems.push(`pins[${i}] (${p.match || "?"}): needs one of spot/go/action/guide`);
      if (p.spot && !ids.has(p.spot)) problems.push(`pins[${i}] (${p.match || "?"}): spot "${p.spot}" matches no entry`);
      if (p.action && !_acts.has(p.action)) problems.push(`pins[${i}] (${p.match || "?"}): action "${p.action}" matches no action`);
      if (p.guide && !_flows.has(p.guide)) problems.push(`pins[${i}] (${p.match || "?"}): guide "${p.guide}" matches no flow`);
      if (p.go && ![..._pages].includes(p.go)) problems.push(`pins[${i}] (${p.match || "?"}): go "${p.go}" matches no entry page`);
    });
    console.log(problems.length ? "\ncheck failed:\n- " + problems.join("\n- ") : "\ncheck ok");
    process.exit(problems.length ? 1 : 0);
  }
} else {
  console.log("Usage: npx pointery init [--force] [--check]");
  process.exit(cmd ? 1 : 0);
}
