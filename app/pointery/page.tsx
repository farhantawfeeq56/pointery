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

  const snippet = `<Pointery\n  trigger="${cfg.trigger}"\n  theme={{ primary: "${cfg.theme.primary}", radius: ${cfg.theme.radius} }}\n  position="${cfg.position}"\n/>`;

  if (!loaded) return <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 text-sm text-zinc-500">Loading Pointery settings…</div>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
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

      <div data-pointery="pointery-settings-status" className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full px-3 py-1 font-medium ${askOk ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"}`}>
          /api/ask {askOk == null ? "…" : askOk ? "reachable ✓" : "unreachable"}
        </span>
        <span className={`rounded-full px-3 py-1 font-medium ${llm?.configured ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {llm == null ? "brain …" : llm.configured ? `LLM → ${llm.host || "env"}${llm.model ? ` / ${llm.model}` : ""} ✓` : "LLM required — missing key/url/model"}
        </span>
        {counts && <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-900">{counts}</span>}
        <span className={`rounded-full px-3 py-1 font-medium ${errors.length === 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          context {errors.length === 0 ? "valid ✓" : `${errors.length} error${errors.length > 1 ? "s" : ""}`}
        </span>
      </div>
      {llm && !llm.configured && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <p className="font-semibold">Brain setup — one step, one restart (key stays in env, this page never handles it).</p>
          <p className="mt-1">Add all three to <code className="font-mono">.env.local</code> together — copy the exact model id from your provider dashboard:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] leading-5 text-zinc-100">POINTERY_LLM_URL=https://api.openai.com/v1/chat/completions{"\n"}POINTERY_LLM_KEY=sk-...{"\n"}POINTERY_LLM_MODEL=gpt-4o-mini</pre>
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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section data-pointery="pointery-settings-preview" className="rounded-2xl border bg-white p-5 self-start lg:order-2 lg:sticky lg:top-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Preview</h2>
              <p className="mt-0.5 text-xs text-zinc-500">How the palette looks in your app. Updates as you edit.</p>
            </div>
            <div className="flex rounded-full bg-zinc-100 p-1 text-xs font-semibold" role="tablist" aria-label="Preview state">
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
            <div className="flex items-center gap-2 border-b bg-zinc-50 px-4 py-2.5">
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
                <div className="bg-zinc-50/60 p-4">
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
                        <span key={s} className={`rounded-full border px-2.5 py-1 text-[10px] ${cfg.suggestions.length ? "bg-zinc-50 text-zinc-600" : "text-zinc-400"}`}>{s}</span>
                      ))}
                    </div>
                    <p className="px-1 pt-1 text-[10px] text-zinc-400">{prettyShortcut(cfg.trigger)} toggles · ⌘K works too · Esc closes</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-6 lg:order-1">
          <section data-pointery="pointery-settings-shortcut" className="rounded-2xl border bg-white p-5">
            <h2 className="text-sm font-semibold">Keyboard shortcut</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Recommended presets, or record your own. ⌘/Ctrl+K always works as a secondary.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(["shift+a", "cmd+k"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setCfg({ ...cfg, trigger: v })}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition ${cfg.trigger === v ? "border-violet-600 bg-violet-50 ring-1 ring-violet-600" : "hover:border-zinc-400"}`}
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
                Current: <kbd className="rounded border bg-zinc-50 px-1.5 py-0.5 font-mono font-semibold text-zinc-800">{prettyShortcut(cfg.trigger)}</kbd>
                {cfg.trigger !== "shift+a" && cfg.trigger !== "cmd+k" && <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-800">custom</span>}
              </span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">Try it now — press your shortcut anywhere on this page.</p>
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
      </div>

      {ctx && (
        <div data-pointery="pointery-settings-context" className="rounded-2xl border bg-white p-5 text-sm">
          <h2 className="text-sm font-semibold">Context <span className="font-normal text-zinc-500">(read-only — edit <code className="font-mono">pointery.context.json</code>)</span></h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left uppercase tracking-wider text-zinc-400">
                <tr><th className="py-1 pr-3">id</th><th className="py-1 pr-3">page</th><th className="py-1">label — for</th></tr>
              </thead>
              <tbody className="divide-y font-mono">
                {(ctx.entries ?? []).map((t) => (
                  <tr key={t.id}><td className="py-1 pr-3">{t.id}</td><td className="py-1 pr-3">{t.page}</td><td className="py-1 font-sans">{t.label}{t.for ? ` — ${t.for}` : ""}</td></tr>
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

      <div data-pointery="pointery-settings-snippet" className="rounded-2xl bg-zinc-950 p-5 text-sm text-zinc-100">
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
