"use client";

import { useEffect, useState } from "react";

const DEFAULTS = { primary: "#6d28d9", radius: 14, trigger: "shift+a", position: "top", allowActions: true, suggestions: true };

function loadCfg() {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("pointery.config") ?? "{}") };
  } catch { return DEFAULTS; }
}

export default function StudioPage() {
  const [cfg, setCfg] = useState(loadCfg);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--pointery-primary", cfg.primary);
    document.documentElement.style.setProperty("--pointery-radius", `${cfg.radius}px`);
    localStorage.setItem("pointery.config", JSON.stringify(cfg));
  }, [cfg]);

  const snippet = `<Pointery\n  trigger="${cfg.trigger}"\n  theme={{ primary: "${cfg.primary}", radius: ${cfg.radius} }}\n  position="${cfg.position}"${cfg.allowActions ? "" : "\n  allowActions={[]"}"}${cfg.suggestions ? "" : "\n  suggestions={[]"}"}\n/>`;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Pointery Studio</p>
        <h1 className="text-2xl font-semibold tracking-tight">Theme it in seconds. No dashboard.</h1>
        <p className="text-sm text-zinc-500">Pickers write <code className="font-mono">pointery.config.json</code> locally. Paste the snippet in <code className="font-mono">layout.tsx</code>. Press Shift+A to preview live.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="rounded-2xl border bg-white p-4 text-sm">
          <span className="font-medium">Primary color</span>
          <span className="mt-2 flex items-center gap-3">
            <input type="color" value={cfg.primary} onChange={(e) => setCfg({ ...cfg, primary: e.target.value })} className="h-10 w-14 cursor-pointer rounded" />
            <code className="font-mono text-xs">{cfg.primary}</code>
          </span>
        </label>
        <label className="rounded-2xl border bg-white p-4 text-sm">
          <span className="font-medium">Corner radius — {cfg.radius}px</span>
          <input type="range" min={4} max={24} value={cfg.radius} onChange={(e) => setCfg({ ...cfg, radius: Number(e.target.value) })} className="mt-3 w-full" />
        </label>
        <label className="rounded-2xl border bg-white p-4 text-sm">
          <span className="font-medium">Shortcut</span>
          <select value={cfg.trigger} onChange={(e) => setCfg({ ...cfg, trigger: e.target.value })} className="mt-2 w-full rounded-lg border px-3 py-2">
            <option value="shift+a">Shift+A</option>
            <option value="cmd+k">Cmd/Ctrl+K</option>
          </select>
        </label>
        <label className="rounded-2xl border bg-white p-4 text-sm">
          <span className="font-medium">Palette position</span>
          <select value={cfg.position} onChange={(e) => setCfg({ ...cfg, position: e.target.value })} className="mt-2 w-full rounded-lg border px-3 py-2">
            <option value="top">Top</option>
            <option value="center">Center</option>
            <option value="bottom">Bottom</option>
          </select>
        </label>
        <label className="flex items-center justify-between rounded-2xl border bg-white p-4 text-sm">
          <span className="font-medium">Allow actions</span>
          <input type="checkbox" checked={cfg.allowActions} onChange={(e) => setCfg({ ...cfg, allowActions: e.target.checked })} className="h-4 w-4 accent-violet-700" />
        </label>
        <label className="flex items-center justify-between rounded-2xl border bg-white p-4 text-sm">
          <span className="font-medium">Show suggestions</span>
          <input type="checkbox" checked={cfg.suggestions} onChange={(e) => setCfg({ ...cfg, suggestions: e.target.checked })} className="h-4 w-4 accent-violet-700" />
        </label>
      </div>
      <div className="rounded-2xl bg-zinc-950 p-5 text-sm text-zinc-100">
        <pre className="overflow-x-auto font-mono text-[13px] leading-6">{snippet}</pre>
        <button
          onClick={() => { navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="mt-3 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-900"
        >
          {copied ? "Copied ✓" : "Copy snippet"}
        </button>
      </div>
    </div>
  );
}
