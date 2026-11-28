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
    { id: "pointery-settings-context", page: "/pointery", label: "Context", for: "Entries, flows and actions from disk", type: "section" },
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
  animation: "slide",
  suggestions: ["Where is export?"],
  allowActions: ["export-report"],
  labels: {
    placeholder: 'Ask "where is export?" or "how do I invite?"',
    empty: "No match — try “export”. ",
    confirmTitle: "Run this action?",
  },
  endpoint: "/api/ask",
  fab: true,
  hiddenRoutes: ["/"],
  timing: { toastMs: 4200, pulseMs: 2600, closeMs: 160, focusMs: 30, navigateMs: 450, navigateIdleMs: 50 },
  zIndex: 60,
  paletteWidth: 560,
  overlayBlur: 2,
  brain: {
    retrieve: { entries: 8, flows: 3, actions: 3 },
    limits: { queryMax: 200, planMax: 4 },
    cache: { ttlMs: 300000, max: 200 },
    llm: { temperature: 0, maxTokens: 300 },
  },
};

// Minimal GET+PUT for pointery.config.json (disk is truth). The /pointery
// settings page reads via GET; PUT remains for direct edits (dev-only, refuses in production).
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

// Starter settings page. Same contract as the harness /pointery page:
// read-only status + context table + mount snippet, config via GET.
// Degrades gracefully when /api/admin/context or /api/admin/llm are absent.
const STARTER_SETTINGS_PAGE = `"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import type { PointeryContext } from "pointery";

const ENV_SNIPPET = "POINTERY_LLM_URL=https://api.openai.com/v1/chat/completions\\nPOINTERY_LLM_KEY=sk-...\\nPOINTERY_LLM_MODEL=gpt-4o-mini";

export default function PointerySettingsPage() {
  const [askOk, setAskOk] = useState<boolean | null>(null);
  const [ctx, setCtx] = useState<PointeryContext | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [llm, setLlm] = useState<{ configured: boolean; host: string; model: string } | null>(null);

  // Disk is truth: load pointery.config.json + context summary on mount.
  useEffect(() => {
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

  // Dev-only: writes to disk with no login, so it never renders in production.
  if (process.env.NODE_ENV === "production") notFound();

  const counts = ctx ? \`\${ctx.entries?.length ?? 0} entries · \${ctx.flows?.length ?? 0} flows · \${ctx.actions?.length ?? 0} actions\` : null;

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
        .py-ok, .py-warn, .py-err, .py-idle, .py-subtle { background: var(--color-background-secondary); color: var(--color-text-secondary); border: 1px solid var(--color-border); }
        .py-ok::before, .py-warn::before, .py-err::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 999px; margin-right: 6px; vertical-align: 1px; }
        .py-ok::before { background: var(--color-success); }
        .py-warn::before { background: var(--color-warning); }
        .py-err::before { background: var(--color-error); }
        .py-code { background: var(--color-background-secondary); border: 1px solid var(--color-border); color: var(--color-text-primary); }
        /* motion: ease + enter only */
        .pointery-settings { --py-ease: cubic-bezier(0.23, 1, 0.32, 1); }
        @keyframes py-enter { from { opacity: 0; transform: translateY(8px); filter: blur(4px); } to { opacity: 1; transform: none; filter: blur(0); } }
        .py-enter { animation: py-enter 480ms var(--py-ease) both; }
        @media (prefers-reduced-motion: reduce) {
          .py-enter { animation-duration: 0ms; }
        }
      \`}</style>
    <div className="pointery-settings w-full flex-1">
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Pointery status</h1>
          <p className="text-sm text-zinc-500">
            Customize with <code className="font-mono">{"<Pointery/>"}</code> props in your layout — this page shows system status.
          </p>
        </div>
      </div>

      <p className="py-enter text-xs font-medium uppercase tracking-wider text-zinc-400" style={{ animationDelay: "60ms" }}>System status</p>
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
>    other stacks: build the equivalent). It is read-only by design:
>    customization lives in the \`<Pointery/>\` props in code, so the page
>    shows system status (ask health, brain, context validity) and the
>    context table. It loads
>    \`pointery.config.json\` via GET only (PUT stays dev-only and refuses
>    in production — edit the file directly and redeploy). Personalize it
>    on first run from the files you just wrote:
>    status probe must use real queries from the
>    context (a flow title, an entry label — never the "export"
>    placeholder if the app has no export), and defaults (trigger, theme,
>    position, suggestions, allowActions) must mirror \`pointery.config.json\`.
>    Set \`suggestions\` to 3–5 real first-run questions for THIS app, built
>    from the entry labels and flow titles you just indexed (the palette
>    shows them as its default list) — never the "export" placeholder if
>    the app has no export. Tag its
>    sections with \`data-pointery\` ids and keep the matching
>    \`pointery-settings-*\` entries on page \`/pointery\` in sync; re-run step 5.
>
> Then show me the wiring diff: mount \`<Pointery/>\` once in \`layout.tsx\`
> (via a client wrapper that loads \`pointery.config.json\` and listens for
> \`pointery:config\`), gated off marketing pages (wrapper returns null on
> \`/\`, or mount only in the \`(app)\` group layout). Sync the palette to my
> brand at init: lift my primary color and corner radius from my theme /
> tokens into \`pointery.config.json\` and the \`<Pointery/>\` props (trigger,
> theme, position, suggestions), so it looks native on day one — everything
> stays user-configurable afterwards via props or the config file. Ensure
> \`/api/ask\` calls \`createAskHandler(context, { llm: { url, key, model } })\`
> (required — no keyless mode), and confirm \`/pointery\` shows status ok, done.

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
