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
  theme: { primary: "#6d28d9", radius: 14 },
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
  const [ctx, setCtx] = useState<PointeryContext | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
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
          className={\`rounded-full px-3 py-1 text-xs font-medium \${saveState === "saved" ? "bg-green-100 text-green-800" : saveState === "saving" ? "bg-amber-100 text-amber-800" : saveState === "error" ? "bg-red-100 text-red-800" : "bg-zinc-100 text-zinc-500"}\`}
        >
          {saveState === "saved" ? "Saved ✓" : saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Auto-save on"}
        </span>
      </div>

      <div data-pointery="pointery-settings-status" className="flex flex-wrap gap-2 text-xs">
        <span className={\`rounded-full px-3 py-1 font-medium \${askOk ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"}\`}>
          /api/ask {askOk == null ? "…" : askOk ? "reachable ✓" : "unreachable"}
        </span>
        <span className={\`rounded-full px-3 py-1 font-medium \${llm?.configured ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"}\`}>
          {llm == null ? "brain …" : llm.configured ? \`LLM → \${llm.host || "env"} ✓\` : "keyword resolver (no key)"}
        </span>
        {counts && <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-900">{counts}</span>}
        <span className={\`rounded-full px-3 py-1 font-medium \${errors.length === 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}\`}>
          context {errors.length === 0 ? "valid ✓" : \`\${errors.length} error\${errors.length > 1 ? "s" : ""}\`}
        </span>
      </div>
      {llm && !llm.configured && (
        <p className="text-xs text-zinc-500">
          No LLM key — paste this prompt&apos;s step 6 into your coding agent and it walks you through \`.env.local\` setup. The key stays in env; this page never handles it.
        </p>
      )}
      {errors.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-red-700">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <section data-pointery="pointery-settings-shortcut" className="rounded-2xl border bg-white p-5">
        <h2 className="text-sm font-semibold">Keyboard shortcut</h2>
        <p className="mt-0.5 text-xs text-zinc-500">Primary trigger. ⌘/Ctrl+K always works as a secondary.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["shift+a", "cmd+k"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setCfg({ ...cfg, trigger: v })}
              className={\`rounded-xl border px-4 py-3 text-left text-sm transition \${cfg.trigger === v ? "border-violet-600 bg-violet-50 ring-1 ring-violet-600" : "hover:border-zinc-400"}\`}
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

      <div className="flex items-center gap-3">
        <button onClick={saveNow} className="w-fit rounded-full bg-violet-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-600">
          {saveState === "saved" ? "Saved ✓" : "Save now"}
        </button>
        <p className="text-xs text-zinc-500">Edits auto-save ~1s after you stop typing — no reload needed.</p>
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
                  <tr key={t.id}><td className="py-1 pr-3">{t.id}</td><td className="py-1 pr-3">{t.page}</td><td className="py-1 font-sans">{t.label}{t.for ? \` — \${t.for}\` : ""}</td></tr>
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
`;

// One-shot map-maker prompt. Same content ships as POINTERY_PROMPT.md
// so `init` alone gives the buyer everything: package + prompt.
const STARTER_PROMPT = `# POINTERY_PROMPT.md — the map-maker (ships with \`npx pointery init\`, per stack)

Paste this into your coding agent (Cursor / Claude / Copilot). It scans your
app and fills \`pointery.context.json\` — the ship-time index of stable UI anchors
your LLM ranks on every ask (\`/api/ask\` forwards \`{ query, candidates, page }\`, the
top-ranked slice, to your own model, or the bundled keyword resolver when no LLM
is set). Re-run whenever your UI changes.

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
>    actions: [{ name, label, confirm, at, aliases? }] }\`
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
> 6. Brain (my key, my bill): if I want the LLM instead of the keyword
>    resolver, walk me through it — add \`POINTERY_LLM_URL\` (my model
>    endpoint) and \`POINTERY_LLM_KEY\` to \`.env.local\`, restart dev, and
>    verify with “where is export?”. Never print or commit the key.
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
> \`createAskHandler(context)\` (or my LLM with the context), and confirm
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
- \`pointery.context.json\` is the index of stable UI anchors (\`/api/ask\` forwards \`{ query, candidates, page }\` to our own model). Keep it small and current: max ~40 entries, ~10 flows, allowlisted actions only.
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
// export const POST = createAskHandler(context);`;

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
    console.log(problems.length ? "\ncheck failed:\n- " + problems.join("\n- ") : "\ncheck ok");
    process.exit(problems.length ? 1 : 0);
  }
} else {
  console.log("Usage: npx pointery init [--force] [--check]");
  process.exit(cmd ? 1 : 0);
}
