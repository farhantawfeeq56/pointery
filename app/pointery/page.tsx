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

const VARIANT_NAMES = ["Current", "Cards", "Rows", "Stacked", "Big touch", "Compact", "Appearance first", "Suggestions first", "Action bar", "Descriptive"] as const;

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
    <div ref={boxRef} className="relative h-full w-full">
      <button
        type="button"
        onClick={() => { if (!open) setDraft(value); setOpen((o) => !o); }}
        aria-expanded={open}
        aria-label="Pick primary color"
        className="py-press relative flex h-full w-full items-center gap-3 py-1 text-left"
      >
        <span className="h-8 w-8 shrink-0 rounded-lg border border-black/10 shadow-sm" style={{ background: value }} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-zinc-500">Primary color</span>
          <code className="block truncate font-mono text-sm font-medium">{value}</code>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-zinc-400 transition ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
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
            style={{ backgroundColor: `hsl(${Math.round(h)},100%,50%)` }}
          >
            <div className="absolute inset-0 rounded-lg" style={{ background: "linear-gradient(to right,#fff,transparent)" }} />
            <div className="absolute inset-0 rounded-lg" style={{ background: "linear-gradient(to top,#000,transparent)" }} />
            <span
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
              style={{ left: `${s}%`, top: `${100 - v}%`, background: current }}
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
              style={{ left: `${(h / 360) * 100}%`, background: `hsl(${Math.round(h)},100%,50%)` }}
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
    <div className="flex h-full w-full flex-col justify-center py-1">
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
        className="py-slider mt-1 flex h-8 w-full items-center"
        style={{ ["--pct" as string]: `${pct}%`, ["--fill" as string]: primary }}
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
  const [variant, setVariant] = useState(1);
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

  // vartest: keys 1-9 + 0(=10) switch visual variants. Skipped when typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (recording) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "1" && e.key <= "9") setVariant(Number(e.key));
      else if (e.key === "0") setVariant(10);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recording]);
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

  const posAlign = cfg.position === "center" ? "items-center" : cfg.position === "bottom" ? "items-end pb-8" : "items-start pt-8";

  const paletteCard = (dark = false, large = false) => (
    <div className={`py-sheet w-full ${large ? "max-w-[400px]" : "max-w-[360px]"} p-2 shadow-2xl ${dark ? "bg-zinc-900 text-zinc-100" : "bg-white"}`} style={{ borderRadius: cfg.theme.radius }} onClick={(e) => e.stopPropagation()}>
      <p className={`rounded-md border px-3 ${large ? "py-3 text-sm" : "py-2 text-xs"} ${dark ? "border-zinc-700 text-zinc-200" : "text-zinc-700"}`} style={{ borderRadius: Math.max(4, cfg.theme.radius - 4) }}>{cfg.labels?.placeholder || 'Ask "where is export?"…'}</p>
      <div className="flex flex-wrap gap-2 p-2">
        {(cfg.suggestions.filter(Boolean).length ? cfg.suggestions.filter(Boolean).slice(0, 3) : ["No suggestions yet — add some above"]).map((s, i) => (
          <span key={s + i} className={"rounded-full border px-2.5 py-1 text-xs " + (cfg.suggestions.filter(Boolean).length ? (dark ? "border-zinc-700 bg-zinc-800 text-zinc-300" : "py-inset") : "text-zinc-400")}>{s}</span>
        ))}
      </div>
      <p className={`px-1 pt-1 text-xs ${dark ? "text-zinc-500" : "text-zinc-400"}`}>{prettyShortcut(cfg.trigger)} toggles · ⌘K works too · Esc closes</p>
    </div>
  );

  const snippet = `<Pointery\n  trigger="${cfg.trigger}"\n  theme={{ primary: "${cfg.theme.primary}", radius: ${cfg.theme.radius} }}\n  position="${cfg.position}"\n/>`;

  // ---- vartest: shared control pieces (same state, new layouts in V2-V10) ----
  const secHead = (t: string, d?: string) => (
    <div className="mb-3">
      <h3 className="py-sec-title">{t}</h3>
      {d && <p className="py-sec-desc">{d}</p>}
    </div>
  );
  const recordBtn = (
    <button
      onClick={() => { setRecording((r) => !r); setRecordingPreview(null); }}
      aria-label={recording ? "Stop recording" : "Record new shortcut"}
      title={recording ? "Stop (Esc)" : "Record new shortcut"}
      className={recording ? "py-press grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500 text-white" : "py-press grid h-8 w-8 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-600 hover:border-zinc-400"}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
    </button>
  );
  const triggerInner = (
    <div>
      <p className="text-xs text-zinc-500">{recording ? "Recording — press keys…" : "Current shortcut"}</p>
      <div className="mt-1.5 flex h-10 items-center gap-3">
        <p className="max-w-48 truncate text-sm font-medium">{recording ? prettyShortcut(recordingPreview ?? "…") : prettyShortcut(cfg.trigger)}</p>
        {recordBtn}
      </div>
    </div>
  );
  const positionInner = (
    <div>
      <p className="text-xs text-zinc-500">Palette position</p>
      <div className="relative mt-1.5 flex h-10 items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1" role="radiogroup" aria-label="Palette position">
        <span aria-hidden className="py-thumb absolute inset-y-1 left-1 rounded-lg border border-zinc-200 bg-white shadow-sm" style={{ width: "calc((100% - 8px) / 3)", transform: cfg.position === "top" ? "translateX(0%)" : cfg.position === "center" ? "translateX(100%)" : "translateX(200%)" }} />
        {(["top", "center", "bottom"] as const).map((o) => (
          <button key={o} type="button" role="radio" aria-checked={cfg.position === o} onClick={() => setCfg({ ...cfg, position: o })}
            className={cfg.position === o ? "py-press relative z-10 flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-900" : "py-press relative z-10 flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800"}>
            {o[0].toUpperCase() + o.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
  const suggInner = (
    <div className="grid gap-2 sm:grid-cols-2">
      {(() => { const rows = [...cfg.suggestions]; while (rows.length < 3) rows.push(""); return rows; })().map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={s}
            onChange={(e) => { const v = e.target.value; setCfg((c) => { const next = [...c.suggestions]; while (next.length <= i) next.push(""); next[i] = v; return { ...c, suggestions: next }; }); }}
            placeholder={["Where is export?", "How do I invite a teammate?", "Try a third query…", "One more…"][i] ?? ("Suggestion " + (i + 1))}
            className="py-field h-10 w-full rounded-xl border px-3 text-sm"
          />
          {i < cfg.suggestions.length ? (
            <button onClick={() => setCfg((c) => ({ ...c, suggestions: c.suggestions.filter((_, j) => j !== i) }))} aria-label={"Remove suggestion " + (i + 1)}
              className="py-press h-8 w-8 shrink-0 rounded-full border border-zinc-200 text-sm text-zinc-500 hover:border-zinc-400">−</button>
          ) : <span className="h-8 w-8 shrink-0" />}
        </div>
      ))}
      {cfg.suggestions.length < 4 && (
        <button onClick={() => setCfg((c) => ({ ...c, suggestions: [...c.suggestions, ""].slice(0, 4) }))}
          className="py-press h-10 rounded-xl border border-dashed border-zinc-300 text-xs font-medium text-zinc-500 hover:border-zinc-500">+ Add suggestion</button>
      )}
    </div>
  );
  const saveInner = (
    <div className="flex items-center gap-3 py-2">
      <button onClick={saveNow} disabled={saveState === "saving"} className="py-save py-press w-fit rounded-full px-5 py-2 text-sm font-medium disabled:opacity-70">
        <span key={saveState} className="py-swap">{saveState === "saved" ? "Saved ✓" : saveState === "saving" ? "Saving…" : "Save now"}</span>
      </button>
      <p className="text-xs text-zinc-500">Edits auto-save ~1s after you stop typing — no reload needed.</p>
    </div>
  );
  const renderControls = () => {
    switch (variant) {
      case 2: return (
        <div className="py-enter grid min-w-0 gap-4 lg:order-1">
          <section data-pointery="pointery-settings-shortcut" className="py-card p-5">
            {secHead("Trigger", "Shortcut opens the palette · position sets where it lands")}
            <div className="grid gap-5 sm:grid-cols-2">{triggerInner}{positionInner}</div>
          </section>
          <section data-pointery="pointery-settings-brand" className="py-card p-5">
            {secHead("Appearance", "Matches your brand inside the palette")}
            <div className="grid gap-5 sm:grid-cols-2">
              <ColorPicker value={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, primary: v } })} />
              <RadiusSlider value={cfg.theme.radius} primary={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, radius: v } })} />
            </div>
          </section>
          <section data-pointery="pointery-settings-behavior" className="py-card p-5">
            {secHead("Suggestions", "Starter prompts shown in the palette")}
            {suggInner}
          </section>
          {saveInner}
        </div>
      );
      case 3: return (
        <div className="py-enter min-w-0 lg:order-1">
          <div className="py-card py-row-divide">
            <section data-pointery="pointery-settings-shortcut" className="grid gap-5 p-5 sm:grid-cols-2">
              <div>{secHead("Trigger", "Opens the palette")}{triggerInner}</div>
              <div>{secHead("Position", "Where it lands")}{positionInner}</div>
            </section>
            <section data-pointery="pointery-settings-brand" className="grid gap-5 p-5 sm:grid-cols-2">
              <div>{secHead("Primary color")}<ColorPicker value={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, primary: v } })} /></div>
              <div>{secHead("Corner radius")}<RadiusSlider value={cfg.theme.radius} primary={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, radius: v } })} /></div>
            </section>
            <section data-pointery="pointery-settings-behavior" className="p-5">
              {secHead("Suggestions", "Starter prompts")}{suggInner}
            </section>
          </div>
          <div className="mt-4">{saveInner}</div>
        </div>
      );
      case 4: return (
        <div className="py-enter mx-auto grid w-full max-w-xl min-w-0 gap-8 lg:order-1">
          <section data-pointery="pointery-settings-shortcut">
            {secHead("Trigger", "How the palette opens and where it lands")}
            <div className="grid gap-4">{triggerInner}{positionInner}</div>
          </section>
          <section data-pointery="pointery-settings-brand">
            {secHead("Appearance", "Your brand inside the palette")}
            <div className="grid gap-4"><ColorPicker value={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, primary: v } })} />
            <RadiusSlider value={cfg.theme.radius} primary={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, radius: v } })} /></div>
          </section>
          <section data-pointery="pointery-settings-behavior">
            {secHead("Suggestions", "Starter prompts")}{suggInner}
          </section>
          {saveInner}
        </div>
      );
      case 5: return (
        <div className="py-enter grid min-w-0 gap-4 lg:order-1">
          <section data-pointery="pointery-settings-shortcut" className="py-card p-6">
            {secHead("Trigger", "Big targets, hard to miss")}
            <div className="grid gap-4">
              <div className="flex h-14 items-center justify-between gap-3 rounded-2xl border border-zinc-200 px-4">
                <p className="truncate text-base font-medium">{recording ? prettyShortcut(recordingPreview ?? "…") : prettyShortcut(cfg.trigger)}</p>
                {recordBtn}
              </div>
              <div className="relative flex h-14 items-center gap-1 rounded-2xl border border-zinc-200 bg-zinc-50 p-1.5" role="radiogroup" aria-label="Palette position">
                <span aria-hidden className="py-thumb absolute inset-y-1.5 left-1.5 rounded-xl bg-white shadow" style={{ width: "calc((100% - 12px) / 3)", transform: cfg.position === "top" ? "translateX(0%)" : cfg.position === "center" ? "translateX(100%)" : "translateX(200%)" }} />
                {(["top", "center", "bottom"] as const).map((o) => (
                  <button key={o} type="button" role="radio" aria-checked={cfg.position === o} onClick={() => setCfg({ ...cfg, position: o })}
                    className="relative z-10 flex-1 rounded-xl py-2 text-sm font-medium text-zinc-700">{o[0].toUpperCase() + o.slice(1)}</button>
                ))}
              </div>
            </div>
          </section>
          <section data-pointery="pointery-settings-brand" className="py-card p-6">
            {secHead("Appearance")}
            <div className="grid gap-4 sm:grid-cols-2"><ColorPicker value={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, primary: v } })} />
            <RadiusSlider value={cfg.theme.radius} primary={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, radius: v } })} /></div>
          </section>
          <section data-pointery="pointery-settings-behavior" className="py-card p-6">
            {secHead("Suggestions")}{suggInner}
          </section>
          {saveInner}
        </div>
      );
      case 6: return (
        <div className="py-enter min-w-0 lg:order-1">
          <section data-pointery="pointery-settings-shortcut" className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-zinc-200 py-3">
            <div className="flex items-center gap-2"><span className="text-xs text-zinc-500">Shortcut</span><span className="text-xs font-medium">{recording ? prettyShortcut(recordingPreview ?? "…") : prettyShortcut(cfg.trigger)}</span>{recordBtn}</div>
            <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-0.5" role="radiogroup" aria-label="Palette position">
              {(["top", "center", "bottom"] as const).map((o) => (
                <button key={o} type="button" role="radio" aria-checked={cfg.position === o} onClick={() => setCfg({ ...cfg, position: o })}
                  className={cfg.position === o ? "rounded-md bg-white px-2.5 py-1 text-xs font-medium shadow-sm" : "px-2.5 py-1 text-xs text-zinc-500"}>{o}</button>
              ))}
            </div>
          </section>
          <section data-pointery="pointery-settings-brand" className="grid gap-3 border-b border-zinc-200 py-3 sm:grid-cols-2">
            <ColorPicker value={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, primary: v } })} />
            <RadiusSlider value={cfg.theme.radius} primary={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, radius: v } })} />
          </section>
          <section data-pointery="pointery-settings-behavior" className="py-3">
            <p className="mb-2 text-xs font-medium text-zinc-500">Suggestions</p>
            {suggInner}
          </section>
          {saveInner}
        </div>
      );
      case 7: return (
        <div className="py-enter grid min-w-0 gap-4 lg:order-1">
          <section data-pointery="pointery-settings-brand" className="py-card border-2 p-5" style={{ borderColor: cfg.theme.primary }}>
            {secHead("Appearance", "Start with the look — it drives the preview")}
            <div className="grid gap-5 sm:grid-cols-2"><ColorPicker value={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, primary: v } })} />
            <RadiusSlider value={cfg.theme.radius} primary={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, radius: v } })} /></div>
          </section>
          <section data-pointery="pointery-settings-shortcut" className="py-card p-5">
            {secHead("Trigger")}
            <div className="grid gap-5 sm:grid-cols-2">{triggerInner}{positionInner}</div>
          </section>
          <section data-pointery="pointery-settings-behavior" className="py-card p-5">
            {secHead("Suggestions")}{suggInner}
          </section>
          {saveInner}
        </div>
      );
      case 8: return (
        <div className="py-enter grid min-w-0 gap-4 lg:order-1">
          <section data-pointery="pointery-settings-behavior" className="py-card p-5">
            {secHead("Suggestions", "What people see first in the palette")}
            {suggInner}
          </section>
          <section data-pointery="pointery-settings-shortcut" className="py-card p-5">
            {secHead("Trigger")}
            <div className="grid gap-5 sm:grid-cols-2">{triggerInner}{positionInner}</div>
          </section>
          <section data-pointery="pointery-settings-brand" className="py-card p-5">
            {secHead("Appearance")}
            <div className="grid gap-5 sm:grid-cols-2"><ColorPicker value={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, primary: v } })} />
            <RadiusSlider value={cfg.theme.radius} primary={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, radius: v } })} /></div>
          </section>
          {saveInner}
        </div>
      );
      case 9: return (
        <div className="py-enter grid min-w-0 gap-4 lg:order-1">
          <div className="py-card flex flex-wrap items-center gap-3 p-4">
            <button onClick={saveNow} disabled={saveState === "saving"} className="py-save py-press rounded-full px-5 py-2 text-sm font-medium disabled:opacity-70">
              <span key={saveState} className="py-swap">{saveState === "saved" ? "Saved ✓" : saveState === "saving" ? "Saving…" : "Save now"}</span>
            </button>
            <span className="text-sm font-medium">{prettyShortcut(cfg.trigger)}</span>
            <span className="text-xs capitalize text-zinc-500">· {cfg.position}</span>
            <span className="ml-auto text-xs text-zinc-400">auto-saves as you type</span>
          </div>
          <section data-pointery="pointery-settings-shortcut" className="py-card p-5">
            {secHead("Trigger")}
            <div className="grid gap-5 sm:grid-cols-2">
              <div><div className="flex h-10 items-center gap-3"><p className="text-sm font-medium">{recording ? prettyShortcut(recordingPreview ?? "…") : prettyShortcut(cfg.trigger)}</p>{recordBtn}</div></div>
              {positionInner}
            </div>
          </section>
          <section data-pointery="pointery-settings-brand" className="py-card p-5">
            {secHead("Appearance")}
            <div className="grid gap-5 sm:grid-cols-2"><ColorPicker value={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, primary: v } })} />
            <RadiusSlider value={cfg.theme.radius} primary={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, radius: v } })} /></div>
          </section>
          <section data-pointery="pointery-settings-behavior" className="py-card p-5">
            {secHead("Suggestions")}{suggInner}
          </section>
        </div>
      );
      default: return (
        <div className="py-enter grid min-w-0 gap-6 lg:order-1">
          <section data-pointery="pointery-settings-shortcut" className="grid gap-6 border-b border-zinc-200 pb-6 sm:grid-cols-[220px_minmax(0,1fr)]">
            <div>{secHead("Keyboard shortcut", "The key combo that opens the palette anywhere.")}</div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>{triggerInner}</div>
              <div>{positionInner}</div>
            </div>
          </section>
          <section data-pointery="pointery-settings-brand" className="grid gap-6 border-b border-zinc-200 pb-6 sm:grid-cols-[220px_minmax(0,1fr)]">
            <div>{secHead("Brand", "Primary color and corner radius used across the palette.")}</div>
            <div className="grid gap-6 sm:grid-cols-2"><ColorPicker value={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, primary: v } })} />
            <RadiusSlider value={cfg.theme.radius} primary={cfg.theme.primary} onChange={(v) => setCfg({ ...cfg, theme: { ...cfg.theme, radius: v } })} /></div>
          </section>
          <section data-pointery="pointery-settings-behavior" className="grid gap-6 sm:grid-cols-[220px_minmax(0,1fr)]">
            <div>{secHead("Suggestions", "Up to four starter prompts, saved with the config.")}</div>
            <div>{suggInner}</div>
          </section>
          {saveInner}
        </div>
      );
    }
  };

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
        /* ---- vartest: controls-only variants (same colors, Figtree, preview untouched) ---- */
        .py-sec-title { font-size: 13px; font-weight: 600; letter-spacing: -0.01em; }
        .py-sec-desc { font-size: 12px; color: var(--color-text-secondary); margin-top: 2px; }
        .py-card { background: #fff; border: 1px solid var(--color-border); border-radius: 16px; box-shadow: var(--shadow-sm); }
        .py-row-divide > * + * { border-top: 1px solid var(--color-border); }
      `}</style>
    <div className={`pointery-settings variant-${variant} w-full flex-1`}>
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="py-enter">
          <p className="mb-1 inline-block rounded-full border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[11px] text-zinc-500">V{variant} · {VARIANT_NAMES[variant - 1]} · keys 1–0</p>
          <h1 className="text-2xl font-medium tracking-tight">Pointery Settings</h1>
          <p className="text-sm text-zinc-500">
            Auto saves to <code className="font-mono">pointery.config.json</code> and updates the palette live.
          </p>
        </div>
        <span
          data-pointery="pointery-settings-save"
          className={`rounded-full px-3 py-1 text-xs font-medium ${saveState === "saved" ? "py-ok" : saveState === "saving" ? "py-warn" : saveState === "error" ? "py-err" : "py-idle"}`}
        >
          <span key={saveState} className="py-swap">{saveState === "saved" ? "Saved ✓" : saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Auto-save on"}</span>
        </span>
      </div>

      <p className="py-enter text-xs font-medium uppercase tracking-wider text-zinc-400" style={{ animationDelay: "60ms" }}>01 - System status</p>
      <div data-pointery="pointery-settings-status" className="py-enter flex flex-wrap gap-2 text-xs" style={{ animationDelay: "110ms" }}>
        <span className={`rounded-full px-3 py-1 font-medium ${askOk ? "py-ok" : "py-idle"}`}>
          /api/ask {askOk == null ? "…" : askOk ? "reachable ✓" : "unreachable"}
        </span>
        <span className={`rounded-full px-3 py-1 font-medium ${llm?.configured ? "py-ok" : "py-err"}`}>
          {llm == null ? "brain …" : llm.configured ? `LLM → ${llm.host || "env"}${llm.model ? ` / ${llm.model}` : ""} ✓` : "LLM required — missing key/url/model"}
        </span>
        {counts && <span className="py-subtle rounded-full px-3 py-1 font-medium">{counts}</span>}
        <span className={`rounded-full px-3 py-1 font-medium ${errors.length === 0 ? "py-ok" : "py-err"}`}>
          context {errors.length === 0 ? "valid ✓" : `${errors.length} error${errors.length > 1 ? "s" : ""}`}
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
      <div className="py-enter grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_560px] lg:gap-12" style={{ animationDelay: "210ms" }}>
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
                  className={`py-press relative z-10 rounded-xl px-3 py-1 capitalize ${preview === s ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-800"}`}
                >
                  {s === "closed" ? "Palette closed" : "Palette open"}
                </button>
              ))}
            </div>
          </div>
          <div className="relative mt-4 min-h-[400px] overflow-hidden rounded-[14px] border border-zinc-200 bg-zinc-50 p-6">
            <div className="h-7 w-40 rounded-md bg-zinc-200" />
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="h-24 rounded-lg bg-zinc-200" />
              <div className="h-24 rounded-lg" style={{ background: "color-mix(in srgb, var(--c) 25%, #e4e4e7)", ["--c" as string]: cfg.theme.primary }} />
              <div className="h-24 rounded-lg bg-zinc-200" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-3 rounded bg-zinc-200" />
              <div className="h-3 w-5/6 rounded bg-zinc-200" />
              <div className="h-3 w-4/6 rounded bg-zinc-200" />
            </div>
            <span className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center text-base font-semibold text-white shadow-lg" style={{ background: cfg.theme.primary, borderRadius: 999 }} title="Ask Pointery">?</span>
            {preview === "open" && (
              <div key={cfg.position} className={`py-fade absolute inset-0 flex justify-center px-4 ${posAlign}`}>{paletteCard()}</div>
            )}
          </div>
        </section>

        {variant === 1 ? (
        <div className="min-w-0 lg:order-1">
          <section data-pointery="pointery-settings-shortcut" className="py-6 first:pt-0">
            <div className="grid items-stretch gap-4 sm:grid-cols-2">
            <div className="flex w-full flex-col py-1">
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
            <div className="flex w-full flex-col py-1">
                <p id="py-position-label" className="text-xs text-zinc-500">Palette position</p>
                <div className="relative mt-1 flex h-8 items-center gap-1 rounded-lg" role="radiogroup" aria-labelledby="py-position-label">
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
            <div className="grid items-stretch gap-4 sm:grid-cols-2">
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
        ) : renderControls()}
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
    {/* vartest floating toolbar — dev only, remove before mainpr */}
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-1 rounded-full border border-zinc-200 bg-white/95 p-1.5 shadow-xl backdrop-blur" role="toolbar" aria-label="Variant switcher">
      {VARIANT_NAMES.map((n, i) => (
        <button
          key={n}
          title={`${i + 1}: ${n}`}
          onClick={() => setVariant(i + 1)}
          className={`grid h-7 min-w-7 place-items-center rounded-full px-1.5 font-mono text-xs font-medium transition ${variant === i + 1 ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"}`}
        >
          {i + 1 === 10 ? "0" : i + 1}
        </button>
      ))}
    </div>
    </div>
    </>
  );
}
