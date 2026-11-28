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

const ENV_SNIPPET = "POINTERY_LLM_URL=https://api.openai.com/v1/chat/completions\\nPOINTERY_LLM_KEY=sk-...\\nPOINTERY_LLM_MODEL=gpt-4o-mini";

const normalizeHex = (v: string) => {
  const t = v.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(t) ? ("#" + t.toUpperCase()) : null;
};

const hexToHsv = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const raw = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (raw * 60 + 360) % 360, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
};

const hsvToHex = (h: number, s: number, v: number) => {
  s /= 100;
  v /= 100;
  const k = (n: number) => (n + h / 60) % 6;
  const f = (n: number) => v - v * s * Math.max(0, Math.min(k(n), 4 - k(n), 1));
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return ("#" + to(f(5)) + to(f(3)) + to(f(1))).toUpperCase();
};

const HUE_BAR = "linear-gradient(to right,hsl(0,100%,50%),hsl(60,100%,50%),hsl(120,100%,50%),hsl(180,100%,50%),hsl(240,100%,50%),hsl(300,100%,50%),hsl(360,100%,50%))";

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const boxRef = useRef<HTMLDivElement>(null);
  const current = normalizeHex(value) ?? "#00A878";
  const { h, s, v } = hexToHsv(current);
  // Fully custom picker: shade square + hue bar + hex field. No native <input type="color" /> anywhere.
  const pick = (hex: string) => {
    onChange(hex);
    setDraft(hex);
  };
  const shadeFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const ns = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const nv = Math.min(100, Math.max(0, 100 - ((e.clientY - r.top) / r.height) * 100));
    pick(hsvToHex(h, ns, nv));
  };
  const hueFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const nh = Math.min(360, Math.max(0, ((e.clientX - r.left) / r.width) * 360));
    pick(hsvToHex(nh, s, v));
  };
  const grab = (e: React.PointerEvent<HTMLDivElement>, fn: (e: React.PointerEvent<HTMLDivElement>) => void) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    fn(e);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>, fn: (e: React.PointerEvent<HTMLDivElement>) => void) => {
    if (e.buttons) fn(e);
  };
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);
  const commit = (raw: string) => {
    const hex = normalizeHex(raw);
    if (hex) pick(hex);
    else setDraft(value);
  };
  return (
    <div ref={boxRef} className="relative w-56 max-w-full">
      <button
        type="button"
        onClick={() => { if (!open) setDraft(value); setOpen((o) => !o); }}
        aria-expanded={open}
        aria-label="Pick primary color"
        className="py-press relative flex h-full w-full items-center gap-2 rounded-[14px] border border-zinc-200 px-2.5 py-1.5 text-left hover:border-zinc-400"
      >
        <span className="h-8 w-8 shrink-0 rounded-lg border border-black/10 shadow-sm" style={{ background: value }} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-zinc-500">Primary color</span>
          <code className="block truncate font-mono text-sm font-medium">{value}</code>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={\`shrink-0 text-zinc-400 transition \${open ? "rotate-180" : ""}\`}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="py-pop absolute z-20 mt-2 w-60 rounded-[14px] border border-zinc-200 bg-white p-3 shadow-lg">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Shade"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(v)}
            aria-valuetext={current}
            onPointerDown={(e) => grab(e, shadeFromPointer)}
            onPointerMove={(e) => move(e, shadeFromPointer)}
            onKeyDown={(e) => {
              const step = 4;
              if (e.key === "ArrowLeft") pick(hsvToHex(h, Math.max(0, s - step), v));
              else if (e.key === "ArrowRight") pick(hsvToHex(h, Math.min(100, s + step), v));
              else if (e.key === "ArrowUp") pick(hsvToHex(h, s, Math.min(100, v + step)));
              else if (e.key === "ArrowDown") pick(hsvToHex(h, s, Math.max(0, v - step)));
              else return;
              e.preventDefault();
            }}
            className="relative h-36 w-full cursor-crosshair touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
            style={{ backgroundColor: \`hsl(\${Math.round(h)},100%,50%)\` }}
          >
            <div className="absolute inset-0 rounded-lg" style={{ background: "linear-gradient(to right,#fff,transparent)" }} />
            <div className="absolute inset-0 rounded-lg" style={{ background: "linear-gradient(to top,#000,transparent)" }} />
            <span
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
              style={{ left: \`\${s}%\`, top: \`\${100 - v}%\`, background: current }}
            />
          </div>
          <div
            role="slider"
            tabIndex={0}
            aria-label="Hue"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(h)}
            onPointerDown={(e) => grab(e, hueFromPointer)}
            onPointerMove={(e) => move(e, hueFromPointer)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") pick(hsvToHex((h + 355) % 360, s, v));
              else if (e.key === "ArrowRight") pick(hsvToHex((h + 5) % 360, s, v));
              else return;
              e.preventDefault();
            }}
            className="relative mt-2 h-2.5 w-full cursor-pointer touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
            style={{ background: HUE_BAR }}
          >
            <span
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
              style={{ left: \`\${(h / 360) * 100}%\`, background: \`hsl(\${Math.round(h)},100%,50%)\` }}
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="flex flex-1 items-center rounded-lg border border-zinc-200 px-2 py-1 font-mono text-xs focus-within:border-zinc-900">
              <span className="text-zinc-400">#</span>
              <input
                value={draft.replace(/^#/, "")}
                onChange={(e) => setDraft("#" + e.target.value)}
                onBlur={() => commit(draft)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit(draft);
                }}
                maxLength={6}
                spellCheck={false}
                aria-label="Hex color code"
                className="w-full bg-transparent uppercase outline-none"
              />
            </span>
            <span className="h-8 w-8 shrink-0 rounded-lg border border-black/10" style={{ background: normalizeHex(draft) ?? value }} />
          </div>
        </div>
      )}
    </div>
  );
}

function RadiusSlider({ value, primary, onChange }: { value: number; primary: string; onChange: (v: number) => void }) {
  const pct = ((value - 4) / (24 - 4)) * 100;
  return (
    <div className="w-56 max-w-full rounded-[14px] border border-zinc-200 px-2.5 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">Corner radius</p>
        <span className="py-inset rounded-full px-2.5 py-0.5 font-mono text-xs font-medium text-zinc-700">{value}px</span>
      </div>
      <input
        type="range"
        min={4}
        max={24}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Corner radius"
        className="py-slider mt-3 w-full"
        style={{ ["--pct" as string]: \`\${pct}%\`, ["--fill" as string]: primary }}
      />
    </div>
  );
}

export default function PointerySettingsPage() {
  const [cfg, setCfg] = useState<Config>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [recording, setRecording] = useState(false);
  const [recordingPreview, setRecordingPreview] = useState<string | null>(null);
  const [askOk, setAskOk] = useState<boolean | null>(null);
  const [ctx, setCtx] = useState<PointeryContext | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [llm, setLlm] = useState<{ configured: boolean; host: string; model: string } | null>(null);
  const [preview, setPreview] = useState<"closed" | "open">("open");
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Custom shortcut recorder: display updates live; next full combo (not bare modifiers) becomes the trigger.
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { setRecording(false); setRecordingPreview(null); return; }
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push(e.metaKey ? "cmd" : "ctrl");
      if (e.altKey) parts.push("alt");
      if (e.shiftKey) parts.push("shift");
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        setRecordingPreview(parts.length ? parts.join("+") + "+…" : "…");
        return; // wait for the full combo
      }
      parts.push(e.key.toLowerCase() === " " ? "space" : e.key.toLowerCase());
      setCfg((c) => ({ ...c, trigger: parts.join("+") }));
      setRecording(false);
      setRecordingPreview(null);
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
        .py-ok, .py-warn, .py-err, .py-idle, .py-subtle { background: var(--color-background-secondary); color: var(--color-text-secondary); border: 1px solid var(--color-border); }
        .py-ok::before, .py-warn::before, .py-err::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 999px; margin-right: 6px; vertical-align: 1px; }
        .py-ok::before { background: var(--color-success); }
        .py-warn::before { background: var(--color-warning); }
        .py-err::before { background: var(--color-error); }
        .py-inset { background: var(--color-background-secondary); color: var(--color-text-secondary); border-color: var(--color-border); }
        .py-code { background: var(--color-background-secondary); border: 1px solid var(--color-border); color: var(--color-text-primary); }
        .py-save { background: var(--color-action-primary); color: #fff; }
        .py-save:hover { background: var(--color-action-primary-hover); }
        input.py-slider { -webkit-appearance: none; appearance: none; height: 8px; border-radius: 999px; outline: none;
          background: linear-gradient(to right, var(--fill, #00A878) 0%, var(--fill, #00A878) var(--pct, 50%), var(--color-border) var(--pct, 50%), var(--color-border) 100%); }
        input.py-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; height: 20px; width: 20px; border-radius: 999px;
          background: #fff; border: 2px solid var(--fill, #00A878); box-shadow: var(--shadow-md); cursor: pointer; }
        input.py-slider::-moz-range-thumb { height: 20px; width: 20px; border-radius: 999px;
          background: #fff; border: 2px solid var(--fill, #00A878); box-shadow: var(--shadow-md); cursor: pointer; }
        input.py-slider::-moz-range-track { height: 8px; border-radius: 999px; background: var(--color-border); }
        input.py-slider::-moz-range-progress { height: 8px; border-radius: 999px; background: var(--fill, #00A878); }
        input.py-slider:focus-visible::-webkit-slider-thumb { outline: 2px solid var(--color-border-focus); outline-offset: 2px; }
        /* ---- interior.dev motion system: ease, press, crossfade, pop, sheet ---- */
        .pointery-settings { --py-ease: cubic-bezier(0.23, 1, 0.32, 1); }
        .py-press { transition: transform 150ms var(--py-ease), background-color 150ms var(--py-ease), border-color 150ms var(--py-ease), box-shadow 150ms var(--py-ease), color 150ms var(--py-ease); touch-action: manipulation; }
        .py-press:active { transform: translateY(1px) scale(0.98); }
        .py-field { transition: border-color 150ms var(--py-ease), box-shadow 150ms var(--py-ease); }
        .py-field:focus-within, .py-field:focus-visible { border-color: var(--color-border-focus); box-shadow: 0 1px 2px rgba(11,5,0,0.08), 0 0 0 3px color-mix(in srgb, var(--color-border-focus) 18%, transparent); outline: none; }
        @keyframes py-enter { from { opacity: 0; transform: translateY(8px); filter: blur(4px); } to { opacity: 1; transform: none; filter: blur(0); } }
        .py-enter { animation: py-enter 480ms var(--py-ease) both; }
        @keyframes py-swap-in { from { opacity: 0; transform: translateY(3px); filter: blur(3px); } to { opacity: 1; transform: none; filter: blur(0); } }
        .py-swap { display: inline-block; animation: py-swap-in 220ms var(--py-ease); }
        @keyframes py-pop-in { from { opacity: 0; transform: scale(0.96) translateY(-4px); filter: blur(3px); } to { opacity: 1; transform: none; filter: blur(0); } }
        .py-pop { animation: py-pop-in 180ms var(--py-ease); transform-origin: top center; }
        @keyframes py-sheet-in { from { opacity: 0; transform: translateY(8px) scale(0.98); filter: blur(3px); } to { opacity: 1; transform: none; filter: blur(0); } }
        .py-sheet { animation: py-sheet-in 240ms var(--py-ease); }
        @keyframes py-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .py-fade { animation: py-fade-in 180ms var(--py-ease); }
        .py-thumb { transition: transform 220ms var(--py-ease); }
        .py-stack { display: grid; }
        .py-stack > * { grid-area: 1 / 1; }
        @keyframes py-spin { to { transform: rotate(360deg); } }
        .py-spin { animation: py-spin 0.85s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .py-enter, .py-swap, .py-pop, .py-sheet, .py-fade { animation-duration: 0ms; }
          .py-press:active { transform: none; }
          .py-thumb { transition: none; }
        }
      \`}</style>
    <div className="pointery-settings w-full flex-1">
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="py-enter">
          <h1 className="text-2xl font-medium tracking-tight">Pointery Settings</h1>
          <p className="text-sm text-zinc-500">
            Auto saves to <code className="font-mono">pointery.config.json</code> and updates the palette live.
          </p>
        </div>
        <span
          data-pointery="pointery-settings-save"
          className={\`rounded-full px-3 py-1 text-xs font-medium \${saveState === "saved" ? "py-ok" : saveState === "saving" ? "py-warn" : saveState === "error" ? "py-err" : "py-idle"}\`}
        >
          <span key={saveState} className="py-swap">{saveState === "saved" ? "Saved ✓" : saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Auto-save on"}</span>
        </span>
      </div>

      <p className="py-enter text-xs font-medium uppercase tracking-wider text-zinc-400" style={{ animationDelay: "60ms" }}>01 - System status</p>
      <div data-pointery="pointery-settings-status" className="py-enter flex flex-wrap gap-2 text-xs" style={{ animationDelay: "110ms" }}>
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
          <div data-pointery="pointery-settings-brain" className="text-xs">
              <p className="font-medium" style={{ color: "var(--color-error)" }}>Brain setup needed</p>
              <p className="mt-1 text-zinc-500">Add all three to <code className="font-mono">.env.local</code> together, then restart. Without all three, /api/ask fails closed (503).</p>
              <pre className="py-code mt-2 overflow-x-auto rounded-lg p-3 font-mono text-xs leading-5">{ENV_SNIPPET}</pre>
            </div>
      )}
      {errors.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-red-700">
          {errors.slice(0, 3).map((e) => (
            <li key={e}>{e}</li>
          ))}
          {errors.length > 3 && <li>+{errors.length - 3} more</li>}
        </ul>
      )}
      <div className="py-enter border-t border-zinc-200 pt-6" style={{ animationDelay: "160ms" }}>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">02 - Customize and preview</p>
      </div>
      <div className="py-enter grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12" style={{ animationDelay: "210ms" }}>
        <section data-pointery="pointery-settings-preview" className="self-start lg:order-2 lg:sticky lg:top-6">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="py-inset relative flex rounded-2xl p-1 text-sm font-medium" role="tablist" aria-label="Preview state">
              <span aria-hidden className="py-thumb absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-xl border border-zinc-200 bg-white shadow-sm" style={{ transform: preview === "open" ? "translateX(100%)" : "translateX(0)" }} />
              {(["closed", "open"] as const).map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={preview === s}
                  onClick={() => setPreview(s)}
                  className={\`py-press relative z-10 rounded-xl px-3 py-1 capitalize \${preview === s ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-800"}\`}
                >
                  {s === "closed" ? "Palette closed" : "Palette open"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-[14px] border">
            <div className="py-inset flex items-center gap-2 border-b px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
              <span className="ml-2 flex-1 truncate rounded-md bg-white px-3 py-1 font-mono text-xs text-zinc-500">yourapp.com/pipeline</span>
            </div>
            <div className="relative">
              <div className="grid min-h-[280px] grid-cols-[110px_1fr]">
                <div className="border-r bg-white p-3">
                  <p className="flex items-center gap-2 text-xs font-semibold"><span className="h-4 w-4 rounded" style={{ background: cfg.theme.primary }} />Acme</p>
                  <div className="mt-3 space-y-2 text-xs">
                    <p className="rounded px-2 py-1 text-zinc-400">Dashboard</p>
                    <p className="rounded px-2 py-1 font-medium" style={{ background: "color-mix(in srgb, var(--c) 12%, transparent)", ["--c" as string]: cfg.theme.primary }}><span style={{ color: cfg.theme.primary }}>● </span>Pipeline</p>
                    <p className="rounded px-2 py-1 text-zinc-400">Contacts</p>
                    <p className="rounded px-2 py-1 text-zinc-400">Settings</p>
                  </div>
                </div>
                <div className="py-inset p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Pipeline</p>
                    <div className="flex gap-2">
                      <span className="rounded-full border bg-white px-2.5 py-1 text-xs font-medium text-zinc-500">Export</span>
                      <span className="px-2.5 py-1 text-xs font-medium text-white" style={{ background: cfg.theme.primary, borderRadius: cfg.theme.radius }}>+ Add deal</span>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {["Acme Corp · $8,000 · Negotiation", "Globex · $12,400 · Proposal"].map((r) => (
                      <p key={r} className="rounded-lg border bg-white px-3 py-2 text-xs text-zinc-600">{r}</p>
                    ))}
                  </div>
                </div>
              </div>
              <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center text-base font-semibold text-white shadow-lg" style={{ background: cfg.theme.primary, borderRadius: 999 }} title="Ask Pointery">?</span>
              {preview === "open" && (
                <div key={cfg.position} className={\`py-fade absolute inset-0 flex justify-center bg-black/25 px-4 \${cfg.position === "center" ? "items-center" : cfg.position === "bottom" ? "items-end pb-6" : "items-start pt-6"}\`}>
                  <div className="py-sheet w-full max-w-[360px] bg-white p-2 shadow-2xl" style={{ borderRadius: cfg.theme.radius }} onClick={(e) => e.stopPropagation()}>
                    <p className="rounded-md border px-3 py-2 text-xs text-zinc-700" style={{ borderRadius: Math.max(4, cfg.theme.radius - 4) }}>{cfg.labels?.placeholder || 'Ask "where is export?"…'}</p>
                    <div className="flex flex-wrap gap-2 p-2">
                      {(cfg.suggestions.filter(Boolean).length ? cfg.suggestions.filter(Boolean).slice(0, 3) : ["No suggestions yet — add some above"]).map((s, i) => (
                        <span key={s + i} className={"rounded-full border px-2.5 py-1 text-xs " + (cfg.suggestions.filter(Boolean).length ? "py-inset" : "text-zinc-400")}>{s}</span>
                      ))}
                    </div>
                    <p className="px-1 pt-1 text-xs text-zinc-400">{prettyShortcut(cfg.trigger)} toggles · ⌘K works too · Esc closes</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="min-w-0 lg:order-1">
          <section data-pointery="pointery-settings-shortcut" className="py-6 first:pt-0">
            <div className="flex flex-wrap gap-4">
            <div className="w-fit min-w-60 rounded-[14px] border border-zinc-200 px-2.5 py-1.5">
              <p className="text-xs text-zinc-500">{recording ? "Recording — press keys…" : "Current shortcut"}</p>
              <div className="mt-1 flex h-8 items-center gap-3">
              <p className="max-w-48 truncate font-mono text-sm font-medium">{recording ? prettyShortcut(recordingPreview ?? "…") : prettyShortcut(cfg.trigger)}</p>
              <button
                onClick={() => { setRecording((r) => !r); setRecordingPreview(null); }}
                aria-label={recording ? "Stop recording" : "Record new shortcut"}
                title={recording ? "Stop (Esc)" : "Record new shortcut"}
                className={recording ? "py-press grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500 text-white" : "py-press grid h-8 w-8 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-600 hover:border-zinc-400"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
              </button>
              </div>
            </div>
            <div className="w-56 max-w-full rounded-[14px] border border-zinc-200 px-2.5 py-1.5">
                <p id="py-position-label" className="text-xs text-zinc-500">Palette position</p>
                <div className="relative mt-1.5 flex h-9 items-center gap-1 rounded-lg" role="radiogroup" aria-labelledby="py-position-label">
                  <span aria-hidden className="py-thumb absolute inset-y-0 left-0 rounded-lg border border-zinc-200 bg-white shadow-sm" style={{ width: "calc(100% / 3)", transform: cfg.position === "top" ? "translateX(0%)" : cfg.position === "center" ? "translateX(100%)" : "translateX(200%)" }} />
                  {(["top", "center", "bottom"] as const).map((o) => (
                    <button
                      key={o}
                      type="button"
                      role="radio"
                      aria-checked={cfg.position === o}
                      onClick={() => setCfg({ ...cfg, position: o })}
                      className={cfg.position === o ? "py-press relative z-10 flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-900" : "py-press relative z-10 flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800"}
                    >
                      {o[0].toUpperCase() + o.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section data-pointery="pointery-settings-brand" className="py-6">
            <div className="flex flex-wrap gap-4">
              <ColorPicker value={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, primary: v } })} />
              <RadiusSlider value={cfg.theme.radius} primary={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, radius: v } })} />
            </div>
          </section>

                    <section data-pointery="pointery-settings-behavior" className="py-6">
            <div className="text-sm">
              <span className="font-medium">Suggestions</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(() => { const rows = [...cfg.suggestions]; while (rows.length < 3) rows.push(""); return rows; })().map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={s}
                      onChange={(e) => { const v = e.target.value; setCfg((c) => { const next = [...c.suggestions]; while (next.length <= i) next.push(""); next[i] = v; return { ...c, suggestions: next }; }); }}
                      placeholder={["Where is export?", "How do I invite a teammate?", "Try a third query…", "One more…"][i] ?? ("Suggestion " + (i + 1))}
                      className="py-field w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs"
                    />
                    {i < cfg.suggestions.length && (
                      <button
                        onClick={() => setCfg((c) => ({ ...c, suggestions: c.suggestions.filter((_, j) => j !== i) }))}
                        aria-label={"Remove suggestion " + (i + 1)}
                        className="py-press shrink-0 rounded-full border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-500 hover:border-zinc-400"
                      >
                        −
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {cfg.suggestions.length < 4 && (
                <div className="mt-2">
                  <button
                    onClick={() => setCfg((c) => ({ ...c, suggestions: [...c.suggestions, ""].slice(0, 4) }))}
                    className="py-press rounded-full border border-dashed border-zinc-300 px-2.5 py-0.5 text-xs font-medium text-zinc-500 hover:border-zinc-500"
                  >
                    + Add suggestion
                  </button>
                </div>
              )}
            </div>
          </section>

          <div className="flex items-center gap-3 py-6">
            <button onClick={saveNow} disabled={saveState === "saving"} className="py-save py-press w-fit rounded-full px-5 py-2 text-sm font-medium disabled:opacity-70">
              <span className="py-stack items-center text-center">
                <span className={saveState === "saving" ? "invisible" : ""}>
                  <span key={saveState} className="py-swap">{saveState === "saved" ? "Saved ✓" : "Save now"}</span>
                </span>
                {saveState === "saving" && (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="py-spin h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" /><path d="M10.5 6A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    Saving…
                  </span>
                )}
              </span>
            </button>
            <p className="text-xs text-zinc-500">Edits auto-save ~1s after you stop typing — no reload needed.</p>
          </div>
        </div>
      </div>

      {ctx && (
        <div data-pointery="pointery-settings-context" className="border-t border-zinc-200 pt-8 text-sm">
          <h2 className="text-sm font-medium">Context <span className="font-normal text-zinc-500">(read-only — edit <code className="font-mono">pointery.context.json</code>)</span></h2>
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

      <div data-pointery="pointery-settings-snippet" className="py-enter rounded-[14px] border border-zinc-200 bg-white p-5 text-sm text-zinc-800" style={{ animationDelay: "260ms" }}>
        <pre className="overflow-x-auto font-mono text-sm leading-6 text-zinc-800">{snippet}</pre>
        <button
          onClick={() => { navigator.clipboard.writeText(snippet); setCopied(true); if (copyTimer.current) clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 2000); }}
          className="py-press mt-3 rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white"
        >
          <span className="py-stack items-center text-center">
            <span className={copied ? "invisible" : ""}>Copy snippet</span>
            {copied && <span className="py-swap">Copied ✓</span>}
          </span>
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
