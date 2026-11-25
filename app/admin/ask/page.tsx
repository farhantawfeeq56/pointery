"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function StudioPage() {
  const [cfg, setCfg] = useState<Config>(DEFAULTS);
  const [ctx, setCtx] = useState<PointeryContext | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [askOk, setAskOk] = useState<boolean | null>(null);
  const [llm, setLlm] = useState<{ configured: boolean; host: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Disk is truth: initial state comes from the files via the admin API.
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/config").then((r) => r.json().catch(() => null)),
      fetch("/api/admin/context").then((r) => r.json().catch(() => null)),
    ]).then(([c, t]) => {
      if (c?.config) setCfg({ ...DEFAULTS, ...c.config, theme: { ...DEFAULTS.theme, ...c.config.theme } });
      if (t?.context) setCtx(t.context);
      if (t?.errors) setErrors(t.errors);
      setLoaded(true);
    });
    // Read-only LLM status: env is truth, key never leaves the server.
    fetch("/api/admin/llm")
      .then((r) => r.json().catch(() => null))
      .then((d) => d && setLlm(d))
      .catch(() => {});
    // Liveness probe: can /api/ask answer the canonical query?
    fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "where is export?" }),
    })
      .then((r) => r.json())
      .then((d) => setAskOk(Boolean(d.spot || d.go || d.action || d.guide || d.answer)))
      .catch(() => setAskOk(false));
  }, []);

  // Live preview: apply theme vars while editing (saved to disk on Save).
  useEffect(() => {
    document.documentElement.style.setProperty("--pointery-primary", cfg.theme.primary);
    document.documentElement.style.setProperty("--pointery-radius", `${cfg.theme.radius}px`);
  }, [cfg.theme]);

  const save = useCallback(async () => {
    const r = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ config: cfg }),
    });
    setSaved(r.ok);
    setTimeout(() => setSaved(false), 2000);
  }, [cfg]);

  const snippet = `<Pointery\n  trigger="${cfg.trigger}"\n  theme={{ primary: "${cfg.theme.primary}", radius: ${cfg.theme.radius} }}\n  position="${cfg.position}"\n/>`;

  if (!loaded) return <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 text-sm text-zinc-500">Loading Studio from disk…</div>;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Pointery Studio</p>
        <h1 className="text-2xl font-semibold tracking-tight">One page. Disk is truth.</h1>
        <p className="text-sm text-zinc-500">
          Edits save to <code className="font-mono">pointery.config.json</code> on disk — what you see here is what visitors get.
        </p>
      </div>

      <div data-pointery="studio-status" className="rounded-2xl border bg-white p-4 text-sm">
        <span className="font-medium">Status</span>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-3 py-1 font-medium ${askOk ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"}`}>
            /api/ask {askOk == null ? "…" : askOk ? "reachable ✓" : "unreachable"}
          </span>
          <span className={`rounded-full px-3 py-1 font-medium ${llm?.configured ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"}`}>
            {llm == null ? "brain …" : llm.configured ? `LLM → ${llm.host || "env"} ✓` : "keyword resolver (no key)"}
          </span>
          <span className={`rounded-full px-3 py-1 font-medium ${errors.length === 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            context {errors.length === 0 ? "valid ✓" : `${errors.length} error${errors.length > 1 ? "s" : ""}`}
          </span>
          {ctx && (
            <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-900">
              {ctx.targets?.length ?? 0} targets · {ctx.guides?.length ?? 0} guides · {ctx.answers?.length ?? 0} answers · {ctx.actions?.length ?? 0} actions
            </span>
          )}
        </div>
        {llm && !llm.configured && (
          <p className="mt-2 text-xs text-zinc-500">
            No LLM key — paste this prompt&apos;s step 6 into your coding agent and it walks you through `.env.local` setup. The key stays in env; Studio never handles it.
          </p>
        )}
        {errors.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-xs text-red-700">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>

      <div data-pointery="studio-appearance" className="grid gap-4 sm:grid-cols-2">
        <label className="rounded-2xl border bg-white p-4 text-sm">
          <span className="font-medium">Primary color</span>
          <span className="mt-2 flex items-center gap-3">
            <input type="color" value={cfg.theme.primary} onChange={(e) => setCfg({ ...cfg, theme: { ...cfg.theme, primary: e.target.value } })} className="h-10 w-14 cursor-pointer rounded" />
            <code className="font-mono text-xs">{cfg.theme.primary}</code>
          </span>
        </label>
        <label className="rounded-2xl border bg-white p-4 text-sm">
          <span className="font-medium">Corner radius — {cfg.theme.radius}px</span>
          <input type="range" min={4} max={24} value={cfg.theme.radius} onChange={(e) => setCfg({ ...cfg, theme: { ...cfg.theme, radius: Number(e.target.value) } })} className="mt-3 w-full" />
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
          <select value={cfg.position} onChange={(e) => setCfg({ ...cfg, position: e.target.value as Config["position"] })} className="mt-2 w-full rounded-lg border px-3 py-2">
            <option value="top">Top</option>
            <option value="center">Center</option>
            <option value="bottom">Bottom</option>
          </select>
        </label>
        <label className="rounded-2xl border bg-white p-4 text-sm sm:col-span-2">
          <span className="font-medium">Suggestions (one per line)</span>
          <textarea
            value={cfg.suggestions.join("\n")}
            onChange={(e) => setCfg({ ...cfg, suggestions: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            rows={3}
            className="mt-2 w-full rounded-lg border px-3 py-2 font-mono text-xs"
          />
        </label>
        <label className="rounded-2xl border bg-white p-4 text-sm sm:col-span-2">
          <span className="font-medium">Allowed actions (comma-separated names from the context)</span>
          <input
            value={cfg.allowActions.join(", ")}
            onChange={(e) => setCfg({ ...cfg, allowActions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            className="mt-2 w-full rounded-lg border px-3 py-2 font-mono text-xs"
          />
        </label>
      </div>

      <button
        data-pointery="studio-save"
        onClick={save}
        className="w-fit rounded-full bg-violet-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-600"
      >
        {saved ? "Saved ✓" : "Save to disk"}
      </button>

      {ctx && (
        <div data-pointery="studio-content" className="rounded-2xl border bg-white p-4 text-sm">
          <span className="font-medium">Context (read-only this pass — edit <code className="font-mono">pointery.context.json</code>, row editing next)</span>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left uppercase tracking-wider text-zinc-400">
                <tr><th className="py-1 pr-3">key</th><th className="py-1 pr-3">page</th><th className="py-1">hint</th></tr>
              </thead>
              <tbody className="divide-y font-mono">
                {ctx.targets.map((t) => (
                  <tr key={t.key}><td className="py-1 pr-3">{t.key}</td><td className="py-1 pr-3">{t.page}</td><td className="py-1 font-sans">{t.hint}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-mono text-xs text-zinc-500">
            guides: {ctx.guides.map((g) => `${g.id} (${g.steps.length})`).join(", ") || "—"} · actions:{" "}
            {ctx.actions.map((a) => `${a.name}${a.confirm ? " ⚠" : ""}`).join(", ") || "—"}
          </p>
        </div>
      )}

      <div data-pointery="studio-snippet" className="rounded-2xl bg-zinc-950 p-5 text-sm text-zinc-100">
        <pre className="overflow-x-auto font-mono text-[13px] leading-6">{snippet}</pre>
        <button
          onClick={() => { navigator.clipboard.writeText(snippet); }}
          className="mt-3 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-900"
        >
          Copy snippet
        </button>
      </div>
    </div>
  );
}
