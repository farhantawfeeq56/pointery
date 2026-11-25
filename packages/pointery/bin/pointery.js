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
  version: 1,
  targets: [
    {
      key: "export-button",
      page: "/dashboard",
      hint: "Export — downloads the report as CSV",
      keywords: ["export", "csv", "download", "where is export"],
    },
    {
      key: "pointery-settings-shortcut",
      page: "/pointery",
      hint: "Shortcut — keyboard trigger for the palette",
      keywords: ["shortcut", "keyboard", "hotkey", "trigger", "shift a", "cmd k"],
    },
    {
      key: "pointery-settings-brand",
      page: "/pointery",
      hint: "Brand — primary color and corner radius",
      keywords: ["brand", "color", "theme", "radius", "primary", "appearance"],
    },
    {
      key: "pointery-settings-behavior",
      page: "/pointery",
      hint: "Behavior — position, suggestions, actions",
      keywords: ["behavior", "position", "suggestions", "actions", "settings"],
    },
    {
      key: "pointery-settings-save",
      page: "/pointery",
      hint: "Save — writes pointery.config.json to disk",
      keywords: ["save", "save settings", "persist", "write config"],
    },
  ],
  guides: [
    {
      id: "export-report",
      title: "Export your report",
      keywords: ["export", "csv", "download", "report"],
      steps: [
        { text: "Open the Dashboard", go: "/dashboard", spot: "export-button" },
        { text: "Click “Export” (top right)", go: "/dashboard", spot: "export-button" },
      ],
    },
  ],
  answers: [],
  actions: [
    { name: "export-report", label: "Export report CSV", confirm: false, keywords: ["export", "download csv"] },
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json().catch(() => null))
      .then((d) => {
        if (d?.config) setCfg({ ...DEFAULTS, ...d.config, theme: { ...DEFAULTS.theme, ...d.config.theme } });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "where is export?" }),
    })
      .then((r) => r.json())
      .then((d) => setAskOk(Boolean(d.spot || d.go || d.action || d.guide || d.answer)))
      .catch(() => setAskOk(false));
  }, []);

  const broadcast = useCallback((next: Config) => {
    document.documentElement.style.setProperty("--pointery-primary", next.theme.primary);
    document.documentElement.style.setProperty("--pointery-radius", \`\${next.theme.radius}px\`);
    window.dispatchEvent(new CustomEvent("pointery:config", { detail: next }));
  }, []);

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

  if (!loaded) return <div>Loading Pointery settings…</div>;

  return (
    <div>
      <p>Pointery · Settings</p>
      <h1>Make it yours</h1>
      <p>
        Shortcuts, brand, behavior — auto-saves to <code>pointery.config.json</code> and updates the palette live.
      </p>
      <span data-pointery="pointery-settings-save">
        {saveState === "saved" ? "Saved ✓" : saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Auto-save on"}
      </span>
      <span>
        /api/ask {askOk == null ? "…" : askOk ? "reachable ✓" : "unreachable"}
      </span>

      <section data-pointery="pointery-settings-shortcut">
        <h2>Keyboard shortcut</h2>
        <p>Primary trigger. ⌘/Ctrl+K always works as a secondary.</p>
        {(["shift+a", "cmd+k"] as const).map((v) => (
          <button key={v} onClick={() => setCfg({ ...cfg, trigger: v })}>
            {v === "shift+a" ? "Shift + A" : "⌘/Ctrl + K"}
          </button>
        ))}
      </section>

      <section data-pointery="pointery-settings-brand">
        <h2>Brand</h2>
        <label>
          Primary color
          <input type="color" value={cfg.theme.primary} onChange={(e) => setCfg({ ...cfg, theme: { ...cfg.theme, primary: e.target.value } })} />
          <code>{cfg.theme.primary}</code>
        </label>
        <label>
          Corner radius — {cfg.theme.radius}px
          <input type="range" min={4} max={24} value={cfg.theme.radius} onChange={(e) => setCfg({ ...cfg, theme: { ...cfg.theme, radius: Number(e.target.value) } })} />
        </label>
      </section>

      <section data-pointery="pointery-settings-behavior">
        <h2>Behavior</h2>
        <label>
          Palette position
          <select value={cfg.position} onChange={(e) => setCfg({ ...cfg, position: e.target.value as Config["position"] })}>
            <option value="top">Top</option>
            <option value="center">Center</option>
            <option value="bottom">Bottom</option>
          </select>
        </label>
        <label>
          Suggestions (one per line)
          <textarea
            value={cfg.suggestions.join("\\n")}
            onChange={(e) => setCfg({ ...cfg, suggestions: e.target.value.split("\\n").map((s) => s.trim()).filter(Boolean) })}
            rows={3}
          />
        </label>
        <label>
          Allowed actions (comma-separated)
          <input
            value={cfg.allowActions.join(", ")}
            onChange={(e) => setCfg({ ...cfg, allowActions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          />
        </label>
      </section>

      <button onClick={saveNow}>{saveState === "saved" ? "Saved ✓" : "Save now"}</button>
    </div>
  );
}
`;

// One-shot map-maker prompt. Same content ships as POINTERY_PROMPT.md
// so `init` alone gives the buyer everything: package + prompt.
const STARTER_PROMPT = `# POINTERY_PROMPT.md — the map-maker (ships with \`npx pointery init\`, per stack)

Paste this into your coding agent (Cursor / Claude / Copilot). It scans your
app and fills \`pointery.context.json\` — the context file your LLM reads on
every ask (\`/api/ask\` forwards \`{ query, context }\` to your own model, or
the bundled keyword resolver when no LLM is set). Re-run whenever your UI changes.

---

**Prompt:**

> My app uses Pointery (in-app ask-anything: palette → /api/ask → pulse /
> navigate / guide / action). The file \`pointery.context.json\` is the context
> my LLM gets with every query — keep it accurate and small. Do this:
>
> 1. Scan \`app/**\` (routes, components). Find every user-facing control or
>    value a user might ask for: nav items, buttons, key numbers, tables,
>    search inputs.
> 2. Add a stable \`data-pointery="kebab-id"\` to each. Only real selectors that
>    exist in the rendered DOM — never invent ids. Keep ids stable across
>    refactors.
> 3. Update \`pointery.context.json\` to match:
>    \`{ targets: [{ key, page, hint, keywords[] }], guides: [{ id, title,
>    keywords[], steps: [{ text, go, spot }] }], answers: [{ keywords[],
>    answer, spot?, go? }], actions: [{ name, label, confirm, keywords[] }] }\`
>    - \`hint\`: one line a user would understand ("Export — downloads CSV").
>    - \`keywords\`: every phrasing a user might type ("export", "csv",
>      "download report", "where is export").
>    - \`confirm: true\` for anything destructive (delete, charge, send, close).
>    - \`steps[].go\` = route, \`steps[].spot\` = an id from step 2 on that route.
> 4. Keep it small: max ~40 targets, ~10 guides, only allowlisted actions.
>    Delete stale keys for removed UI.
> 5. Run \`npx pointery init --check\` and fix whatever it reports (guide step
>    pointing at a missing target).
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
>    plus a Save button, applies theme vars live, and dispatches a
>    \`pointery:config\` CustomEvent with the new config so the mounted
>    \`<Pointery/>\` (whose client wrapper listens for it) updates without
>    reload. Tag its controls with \`data-pointery\` ids and keep the matching
>    \`pointery-settings-*\` targets on page \`/pointery\` in sync; re-run step 5.
>
> Then show me the wiring diff: mount \`<Pointery/>\` once in \`layout.tsx\`
> (via a client wrapper that loads \`pointery.config.json\` and listens for
> \`pointery:config\`), ensure \`/api/ask\` calls \`createAskHandler(context)\`
> (or my LLM with the context), and confirm \`/pointery\` saves to disk, done.

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
- \`pointery.context.json\` is the LLM context for in-app ask-anything (\`/api/ask\` forwards \`{ query, context }\` to our own model). Keep it small and current: max ~40 targets, ~10 guides, allowlisted actions only.
- Whenever you add, move, rename, or remove a user-facing control, value, or route: update its \`data-pointery="kebab-id"\` in code AND its entry in \`pointery.context.json\` (hint + keywords; \`confirm: true\` for destructive actions). Keep ids stable; never invent selectors — only ids present in the rendered DOM.
- After any UI change, run \`npx pointery init --check\` (fails when a guide step points at a missing target) and fix what it reports.
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
    const keys = new Set((ctx.targets || []).map((t) => t.key));
    (ctx.guides || []).forEach((g, i) =>
      (g.steps || []).forEach((s) => {
        if (s.spot && !keys.has(s.spot)) problems.push(`guides[${i}]: spot "${s.spot}" matches no target`);
      })
    );
    console.log(problems.length ? "\ncheck failed:\n- " + problems.join("\n- ") : "\ncheck ok");
    process.exit(problems.length ? 1 : 0);
  }
} else {
  console.log("Usage: npx pointery init [--force] [--check]");
  process.exit(cmd ? 1 : 0);
}
