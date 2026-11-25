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
>
> Then show me the 10-line wiring diff: mount \`<Pointery/>\` once in
> \`layout.tsx\`, ensure \`/api/ask\` calls \`createAskHandler(context)\` (or my
> LLM with the context), done.

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
