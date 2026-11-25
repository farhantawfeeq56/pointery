"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  theme: { primary: "#6d28d9", radius: 14 },
  position: "top",
  suggestions: [],
  allowActions: [],
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function PointerySettingsPage() {
  const [cfg, setCfg] = useState<Config>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [askOk, setAskOk] = useState<boolean | null>(null);
  const [counts, setCounts] = useState<string | null>(null);
  const [llm, setLlm] = useState<{ configured: boolean; host: string } | null>(null);
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
        const c = d?.context as PointeryContext | undefined;
        if (c) setCounts(`${c.targets?.length ?? 0} targets · ${c.guides?.length ?? 0} guides · ${c.answers?.length ?? 0} answers · ${c.actions?.length ?? 0} actions`);
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

  if (!loaded) return <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 text-sm text-zinc-500">Loading Pointery settings…</div>;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Pointery · Settings</p>
          <h1 className="text-2xl font-semibold tracking-tight">Make it yours</h1>
          <p className="text-sm text-zinc-500">
            Shortcuts, brand, behavior — auto-saves to <code className="font-mono">pointery.config.json</code> and updates the palette live.
          </p>
        </div>
        <span
          data-pointery="pointery-settings-save"
          className={`rounded-full px-3 py-1 text-xs font-medium ${saveState === "saved" ? "bg-green-100 text-green-800" : saveState === "saving" ? "bg-amber-100 text-amber-800" : saveState === "error" ? "bg-red-100 text-red-800" : "bg-zinc-100 text-zinc-500"}`}
        >
          {saveState === "saved" ? "Saved ✓" : saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Auto-save on"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full px-3 py-1 font-medium ${askOk ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"}`}>
          /api/ask {askOk == null ? "…" : askOk ? "reachable ✓" : "unreachable"}
        </span>
        <span className={`rounded-full px-3 py-1 font-medium ${llm?.configured ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"}`}>
          {llm == null ? "brain …" : llm.configured ? `LLM → ${llm.host || "env"} ✓` : "keyword resolver (no key)"}
        </span>
        {counts && <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-900">{counts}</span>}
      </div>

      <section data-pointery="pointery-settings-shortcut" className="rounded-2xl border bg-white p-5">
        <h2 className="text-sm font-semibold">Keyboard shortcut</h2>
        <p className="mt-0.5 text-xs text-zinc-500">Primary trigger. ⌘/Ctrl+K always works as a secondary.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["shift+a", "cmd+k"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setCfg({ ...cfg, trigger: v })}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition ${cfg.trigger === v ? "border-violet-600 bg-violet-50 ring-1 ring-violet-600" : "hover:border-zinc-400"}`}
            >
              <span className="font-mono font-semibold">{v === "shift+a" ? "Shift + A" : "⌘/Ctrl + K"}</span>
              <span className="block text-xs text-zinc-500">{v === "shift+a" ? "Default — plus ⌘K" : "Minimal — ⌘K only"}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">Try it now — press <kbd className="rounded border bg-zinc-50 px-1.5 py-0.5 font-mono">?</kbd> or your shortcut anywhere on this page.</p>
      </section>

      <section data-pointery="pointery-settings-brand" className="rounded-2xl border bg-white p-5">
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
        <div className="mt-4 rounded-xl border bg-zinc-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Live preview</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: cfg.theme.primary, borderRadius: cfg.theme.radius }}>
              Ask Pointery
            </span>
            <span className="rounded-full border px-3 py-1 text-xs" style={{ borderRadius: cfg.theme.radius }}>Shift+A toggles · Esc closes</span>
          </div>
        </div>
      </section>

      <section data-pointery="pointery-settings-behavior" className="rounded-2xl border bg-white p-5">
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

      <div className="flex items-center gap-3">
        <button onClick={saveNow} className="w-fit rounded-full bg-violet-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-600">
          {saveState === "saved" ? "Saved ✓" : "Save now"}
        </button>
        <p className="text-xs text-zinc-500">Edits auto-save ~1s after you stop typing — no reload needed.</p>
      </div>
    </div>
  );
}
