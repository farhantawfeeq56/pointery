#!/usr/bin/env node
// `npx pointery init` - drop starter files into the consumer's app.
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
  ],
  flows: [
    { id: "export-report", title: "Export your report", aliases: ["export"], steps: ["export-button"] },
  ],
  // NOTE: keep in sync with POINTERY_PROMPT.md step 5 + AGENTS_BLOCK below (no sync script).
  actions: [
    { name: "export-report", label: "Export report CSV", confirm: false, at: "export-button" },
  ],
};

const STARTER_CONFIG = {
  "$schema": "./node_modules/pointery/schema.json",
  trigger: "shift+a",
  theme: { primary: "#00A878", radius: 14 },
  position: "top",
  animation: "slide",
  suggestions: ["Where is export?"],
  allowActions: ["export-report"],
  labels: {
    placeholder: 'Ask "where is export?" or "how do I invite?"',
    empty: "No match - try “export”. ",
    confirmTitle: "Run this action?",
  },
  endpoint: "/api/ask",
  closed: { variant: "fab", icon: "?", label: "Ask" },
  hiddenRoutes: ["/"],
  // Per-page overrides: exact path wins, "/demo/*" matches anything under it.
  // e.g. "/demo/pipeline": { position: "bottom", suggestions: ["Show me the pipeline table"] }
  routes: {},
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

// schema.json is truth: editors get autocomplete via the "$schema" key above,
// agents read node_modules/pointery/schema.json for every key + allowed values
// (position: top|center|bottom, animation: fade|slide|scale|none). `config
// --validate` enforces the same rules without dependencies.
function validateConfigJson(c) {
  const errs = [];
  if (!c || typeof c !== "object" || Array.isArray(c)) return ["config must be a JSON object"];
  const known = new Set(["$schema", "trigger", "theme", "cssVars", "zIndex", "paletteWidth", "overlayBlur", "closed", "fab", "hiddenRoutes", "timing", "position", "animation", "suggestions", "allowActions", "labels", "endpoint", "routes", "brain"]);
  for (const k of Object.keys(c)) if (!known.has(k)) errs.push(`unknown key "${k}" - see schema.json`);
  if (c.position !== undefined && !["top", "center", "bottom"].includes(c.position)) errs.push(`position must be one of top|center|bottom (got ${JSON.stringify(c.position)})`);
  if (c.animation !== undefined && !["fade", "slide", "scale", "none"].includes(c.animation)) errs.push(`animation must be one of fade|slide|scale|none (got ${JSON.stringify(c.animation)})`);
  if (c.closed !== undefined) {
    const o = c.closed;
    if (!o || typeof o !== "object" || Array.isArray(o)) errs.push("closed must be an object");
    else {
      for (const k of Object.keys(o)) if (!["variant", "icon", "label", "hint", "showHint"].includes(k)) errs.push(`closed: unknown key "${k}"`);
      if (o.variant !== undefined && !["fab", "pill", "tab", "helper", "ghost"].includes(o.variant)) errs.push(`closed.variant must be one of fab|pill|tab|helper|ghost (got ${JSON.stringify(o.variant)})`);
    }
  }
  for (const k of ["zIndex", "paletteWidth", "overlayBlur"]) {
    if (c[k] !== undefined && typeof c[k] !== "number") errs.push(`${k} must be a number (got ${JSON.stringify(c[k])})`);
  }
  if (c.routes !== undefined) {
    if (!c.routes || typeof c.routes !== "object" || Array.isArray(c.routes)) errs.push("routes must be an object keyed by path");
    else for (const [rk, rv] of Object.entries(c.routes)) {
      if (!rv || typeof rv !== "object" || Array.isArray(rv)) { errs.push(`routes["${rk}"] must be an object`); continue; }
      if (rv.position !== undefined && !["top", "center", "bottom"].includes(rv.position)) errs.push(`routes["${rk}"].position must be one of top|center|bottom`);
      if (rv.animation !== undefined && !["fade", "slide", "scale", "none"].includes(rv.animation)) errs.push(`routes["${rk}"].animation must be one of fade|slide|scale|none`);
    }
  }
  return errs;
}

function readConfig(cwd) {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, "pointery.config.json"), "utf8"));
  } catch (e) {
    console.log(`cannot read pointery.config.json: ${e}`);
    process.exit(1);
  }
}

// One-shot map-maker prompt. Same content ships as POINTERY_PROMPT.md
// so `init` alone gives the buyer everything: package + prompt.
const STARTER_PROMPT = `# POINTERY_PROMPT.md - the map-maker (ships with \`npx pointery init\`, per stack)

Paste this into your coding agent (Cursor / Claude / Copilot). It scans your
app and fills \`pointery.context.json\` - the ship-time index of stable UI anchors
your LLM ranks on every ask (\`/api/ask\` sends the top-ranked slice as system
context in an OpenAI-compatible \`{ model, messages }\` call to your own model - the LLM is required, there is no
keyless mode). Re-run whenever your UI changes.

---

**Prompt:**

> My app uses Pointery (in-app ask-anything: palette → /api/ask → pulse /
> navigate / guide / action). The file \`pointery.context.json\` is the context
> my LLM gets with every query - keep it accurate and small. Do this:
>
> 1. Scan \`app/**\` (routes, components). Find every user-facing control a user
>    might ask for: nav items, buttons, tables, search inputs. Index stable
>    anchors only - never per-record ids (no \`deal-acme\`), never live values
>    (no \`$8,000\`, counts, totals). For lists, index the container
>    (\`pipeline-table\`), not the rows; the client finds the row text at runtime.
>    Mark the container with rows:true so the model can answer instance queries
>    ("where is the Acme deal") with filter ("Acme") alongside that spot -
>    the client pulses the matching row, else the container.
> 2. Add a stable \`data-pointery="kebab-id"\` to each. Only real selectors that
>    exist in the rendered DOM - never invent ids. Keep ids stable across
>    refactors.
> 3. Update \`pointery.context.json\` to match - identity + purpose + place,
>    no sentences, no live values:
>    \`{ version: 2, entries: [{ id, page, label, for, type, aliases?, rows? }],
>    flows: [{ id, title, steps: [entryId...], aliases? }],
>    actions: [{ name, label, confirm, at, aliases? }],
>    pins?: [{ match, aliases?, spot?, go?, action?, guide?, hint? }] }\`
>    - \`pins[]\` = curated fast-path (optional): exact-phrase wins checked
>      before generic scoring, served locally with no LLM. Strict match only
>      (no word-overlap). Use for golden demo paths; the rest still
>      resolves generically. Every \`spot\`/\`action\`/\`guide\` must reference a real
>      entry id / action name / flow id, and every \`go\` a real entry page.
>    - \`label\`: the element's own words ("Export"). \`for\`: stable purpose,
>      one clause ("Downloads the pipeline as CSV") - never an instruction.
>    - \`aliases\`: non-obvious synonyms only ("csv"). Matching derives from
>      label + for; never list phrasings ("where is export" doesn't belong here).
>    - \`flows[].steps\` = entry ids in walk order; wording is generated, not stored.
>    - \`actions[].at\` = the entry id it runs against.
>    - \`confirm: true\` for anything destructive (delete, charge, send, close).
>    - rows:true on containers whose children are runtime data (deal, contact,
>      chat rows). Only then may the model set filter alongside that spot -
>      the server drops it otherwise, and the keyword fallback never sets it.
> 4. Keep it small: max ~40 entries, ~10 flows, only allowlisted actions.
>    Delete stale ids for removed UI.
> 5. Run \`npx pointery init --check\` and fix whatever it reports (two-way:
>    code anchors with no map entry AND map entries with no rendered anchor,
>    plus guide steps pointing at missing targets, live \`$\` data, bloated maps
>    (max ~40 entries, ~10 flows), instruction-style \`for\` text,
>    or config errors (unknown keys, bad enums). \`node_modules/pointery/schema.json\` is truth
>    for \`pointery.config.json\`: position is top|center|bottom, animation is
>    fade|slide|scale|none. Run \`npx pointery config --validate\` after any config edit.
> 6. Brain (my key, my bill, required - one step): walk me through it - add \`POINTERY_LLM_URL\` (my model endpoint: OpenAI-compatible chat-completions URL, or native Anthropic \`…/v1/messages\` / Gemini \`…:generateContent\` - auto-detected), \`POINTERY_LLM_KEY\`, AND \`POINTERY_LLM_MODEL\` (exact model id as the provider spells it) to \`.env.local\` together, restart dev, and
>    verify with a real question built from THIS map (a flow title or entry label you just indexed - never the "export" placeholder if the app has no export). Without all three, \`/api/ask\` fails closed (503). OpenAI defaults the model to \`gpt-4o-mini\` when unset; every other provider needs it. Never print or commit the key.
> 7. First-run copy: set \`suggestions\` to 3-5 real questions for THIS app, built
>    from the entry labels and flow titles you just indexed (the palette
>    shows them as its default list) - never the "export" placeholder if
>    the app has no export - and rewrite the starter \`labels\` placeholder/empty
>    copy the same way; re-run step 5.
>
> Then show me the wiring diff: \`pointery.config.json\` is truth - mount \`<Pointery/>\` once in \`layout.tsx\`
> via a client wrapper (e.g. \`components/pointery-wrapper.tsx\`) that passes the config file as props and listens for
> \`pointery:config\`, gated off marketing pages (wrapper returns null on
> \`/\`, or mount only in the \`(app)\` group layout). Keep every key the starter sets
> (\`trigger, theme, position, animation, suggestions, allowActions, hiddenRoutes, closed, endpoint, timing, brain\`) flowing through - don't drop keys to match a shorter snippet. Sync the palette to my
> brand at init: lift my primary color and corner radius from my theme /
> tokens into \`pointery.config.json\` (props only override it where you explicitly pass them), so it looks native on day one. Ensure
> \`/api/ask\` calls \`createAskHandler(context, { llm: { url, key, model }, retrieve, limits, cache })\`
> with \`retrieve/limits/cache\` (plus \`llm.temperature/maxTokens\`) read from \`pointery.config.json\` \`brain\`
> (required - no keyless mode; never strip tuning to match a shorter snippet), and confirm \`npx pointery init --check\` is clean, done.

**Rules for the agent:** no fake selectors, \`confirm:true\` on destructive,
re-run on UI change. This file is versioned per stack (Next / Vue / HTML) -
update it without re-publishing npm.
`;

// Persistent rule for the buyer's AGENTS.md: every prod UI change keeps the
// context file in sync, so the LLM never answers from a stale map.
const AGENTS_START = "<!-- pointery:start -->";
const AGENTS_END = "<!-- pointery:end -->";
const AGENTS_BLOCK = `${AGENTS_START} - do not remove; \`npx pointery init --force\` refreshes this block.
## Pointery - keep pointery.context.json in sync
- \`pointery.context.json\` is the index of stable UI anchors for in-app ask-anything (\`/api/ask\` sends the top-ranked slice as system context in an OpenAI-compatible \`{ model, messages }\` call to our own model). Keep it small and current: max ~40 entries, ~10 flows, allowlisted actions only.
- Whenever you add, move, rename, or remove a user-facing control or route: update its \`data-pointery="kebab-id"\` in code AND its entry in \`pointery.context.json\` (label + purpose; \`confirm: true\` for destructive actions). Keep ids stable; never invent selectors - only ids present in the rendered DOM.
- After any UI change, run \`npx pointery init --check\` (two-way: fails on code anchors missing from the map AND map entries missing from rendered code, plus stale steps) and fix what it reports.
- \`node_modules/pointery/schema.json\` is truth for \`pointery.config.json\` (position: top|center|bottom, animation: fade|slide|scale|none). After any config edit, run \`npx pointery config --validate\`.
- When you add a new page where Pointery mounts: give it a \`routes\` entry in \`pointery.config.json\` so the palette follows the app's brand (primary/radius from theme tokens) and stays visible (position/animation that doesn't cover the page's key UI). Only tune per-page settings for pages you are adding - never restyle existing pages unprompted. Explicit user instructions always win over these defaults.
${AGENTS_END}`;

const SNIPPET = `import { Pointery } from "pointery";
import "pointery/styles.css";

// once in your root layout, next to {children} (via a client wrapper that
// passes pointery.config.json as props and listens for pointery:config):
<Pointery />
// API route (app/api/ask/route.ts):
// import { createAskHandler } from "pointery";
// import context from "@/pointery.context.json";
// import config from "@/pointery.config.json";
// export const POST = createAskHandler(context, { llm: { url: process.env.POINTERY_LLM_URL ?? "", key: process.env.POINTERY_LLM_KEY ?? "", model: process.env.POINTERY_LLM_MODEL ?? "", temperature: config.brain?.llm?.temperature, maxTokens: config.brain?.llm?.maxTokens }, retrieve: config.brain?.retrieve, limits: config.brain?.limits, cache: config.brain?.cache });`;

function write(name, data) {
  const p = path.join(cwd, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (fs.existsSync(p) && !force) {
    console.log(`skip  ${name} (exists - use --force to overwrite)`);
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

if (cmd === "config" && args[1] === "--validate") {
  const cfg = readConfig(cwd);
  const errs = validateConfigJson(cfg);
  console.log(errs.length ? "config invalid:\n- " + errs.join("\n- ") : "config ok");
  process.exit(errs.length ? 1 : 0);
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
    const ids = new Set((ctx.entries || []).map((t) => t.id));
    const looksLive = (s) => typeof s === "string" && /\$\s*\d/.test(s);
    (ctx.entries || []).forEach((t, i) => {
      if (!t.id) problems.push(`entries[${i}]: missing id`);
      if (!t.page) problems.push(`entries[${i}] (${t.id || "?"}): missing page`);
      if (!t.label) problems.push(`entries[${i}] (${t.id || "?"}): missing label`);
      if (t.label && looksLive(t.label)) problems.push(`entries[${i}] (${t.id}): label looks like live data - keep stable anchors only`);
      if (t.for && looksLive(t.for)) problems.push(`entries[${i}] (${t.id}): for looks like live data - keep stable anchors only`);
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
    if ((ctx.entries || []).length > 40) problems.push(`too many entries (${ctx.entries.length}) - keep max ~40`);
    if ((ctx.flows || []).length > 10) problems.push(`too many flows (${ctx.flows.length}) - keep max ~10`);
    const looksInstruction = (s) => s.includes("?") || /where is|what is|how (do|to|do i)/i.test(s);
    (ctx.entries || []).forEach((t, i) => {
      if (t.for && t.for.length > 140) problems.push(`entries[${i}] (${t.id}): for is ${t.for.length} chars - keep one short clause`);
      if (t.for && looksInstruction(t.for)) problems.push(`entries[${i}] (${t.id}): for looks like an instruction/question - keep a purpose clause`);
      for (const a of t.aliases ?? []) if (a.includes("?")) problems.push(`entries[${i}] (${t.id}): alias "${a}" looks like a phrasing - aliases are synonyms only`);
    });
    // Two-way drift: code ids without map entries (unaskable UI) + map entries
    // with no rendered anchor (dead targets). Heuristic: static data-pointery
    // literals plus key: "..." literals (covers data-pointery={n.key} tables).
    try {
      const appDir = path.join(cwd, "app");
      const codeIds = new Set();
      const walk = (d) => {
        for (const f of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, f.name);
          if (f.isDirectory()) { if (f.name !== "node_modules" && f.name !== ".next") walk(p); continue; }
          if (!/\.[jt]sx?$/.test(f.name)) continue;
          const src = fs.readFileSync(p, "utf8");
          for (const m of src.matchAll(/data-pointery\s*=\s*["']([^"']+)["']/g)) codeIds.add(m[1]);
          for (const m of src.matchAll(/key\s*:\s*["']([a-z0-9][a-z0-9-]*)["']/g)) codeIds.add(m[1]);
        }
      };
      if (fs.existsSync(appDir)) {
        walk(appDir);
        for (const id of codeIds) if (!ids.has(id)) problems.push(`code: data-pointery="${id}" has no entry in pointery.context.json`);
        for (const id of ids) if (!codeIds.has(id)) problems.push(`entries: "${id}" has no data-pointery in app/** - stale or conditional anchor`);
      }
    } catch { /* unreadable tree - static checks above still apply */ }
    for (const e of validateConfigJson(readConfig(cwd))) problems.push("config: " + e);
    console.log(problems.length ? "\ncheck failed:\n- " + problems.join("\n- ") : "\ncheck ok");
    process.exit(problems.length ? 1 : 0);
  }
} else {
  console.log("Usage: npx pointery init [--force] [--check] | npx pointery config --validate");
  process.exit(cmd ? 1 : 0);
}
