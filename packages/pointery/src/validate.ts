import type { PointeryContext } from "./types.js";

/**
 * Check a `pointery.context.json` for the mistakes agents commonly make:
 * missing fields, duplicate ids, flow steps pointing at ids that don't exist,
 * live per-user data baked into a ship-time index of stable anchors.
 * Returns human-readable errors (empty = valid). Used by `npx pointery init --check`.
 */
export function validateContext(ctx: PointeryContext): string[] {
  const errors: string[] = [];
  if (!ctx || typeof ctx !== "object") return ["context must be an object"];
  const entries = ctx.entries ?? [];
  const flows = ctx.flows ?? [];
  const actions = ctx.actions ?? [];
  // Size caps from the map-maker prompt: the map is a ship-time index, not docs.
  if (entries.length > 40) errors.push(`too many entries (${entries.length}) - keep max ~40`);
  if (flows.length > 10) errors.push(`too many flows (${flows.length}) - keep max ~10`);
  // `for` is one stable purpose clause, never a question or phrasing.
  // shortcut: verb-starts ("Ask health") are legit purposes, so only flag questions/phrasings.
  const looksInstruction = (s: string) => s.includes("?") || /where is|what is|how (do|to|do i)/i.test(s);

  // Live values ($1,234, record names) go stale per user - the map holds stable anchors only.
  const looksLive = (s: string) => /\$\s*\d/.test(s);

  const ids = new Set<string>();
  entries.forEach((e, i) => {
    if (!e.id) errors.push(`entries[${i}]: missing id`);
    else if (ids.has(e.id)) errors.push(`entries[${i}]: duplicate id "${e.id}"`);
    else ids.add(e.id);
    if (!e.page) errors.push(`entries[${i}] (${e.id || "?"}): missing page`);
    if (!e.label) errors.push(`entries[${i}] (${e.id || "?"}): missing label`);
    if (e.label && looksLive(e.label)) errors.push(`entries[${i}] (${e.id || "?"}): label looks like live data - keep stable anchors only`);
    if (e.for && looksLive(e.for)) errors.push(`entries[${i}] (${e.id || "?"}): for looks like live data - keep stable anchors only`);
    if (e.for && e.for.length > 140) errors.push(`entries[${i}] (${e.id || "?"}): for is ${e.for.length} chars - keep one short clause`);
    if (e.for && looksInstruction(e.for)) errors.push(`entries[${i}] (${e.id || "?"}): for looks like an instruction/question - keep a purpose clause ("Downloads the pipeline as CSV")`);
    for (const a of e.aliases ?? []) if (a.includes("?")) errors.push(`entries[${i}] (${e.id || "?"}): alias "${a}" looks like a phrasing - aliases are synonyms only ("csv")`);
  });

  const pages = new Set(entries.map((e) => e.page));
  const actionNames = new Set<string>();
  actions.forEach((a, i) => {
    if (!a.name) errors.push(`actions[${i}]: missing name`);
    else if (actionNames.has(a.name)) errors.push(`actions[${i}]: duplicate name "${a.name}"`);
    else actionNames.add(a.name);
    if (a.at && !ids.has(a.at)) errors.push(`actions[${i}] (${a.name || "?"}): at "${a.at}" matches no entry`);
  });

  (ctx.pins ?? []).forEach((p, i) => {
    if (!p.match) errors.push(`pins[${i}]: missing match`);
    if (!p.spot && !p.go && !p.action && !p.guide) errors.push(`pins[${i}] (${p.match || "?"}): needs one of spot/go/action/guide`);
    if (p.spot && !ids.has(p.spot)) errors.push(`pins[${i}] (${p.match || "?"}): spot "${p.spot}" matches no entry`);
    if (p.action && !actionNames.has(p.action)) errors.push(`pins[${i}] (${p.match || "?"}): action "${p.action}" matches no action`);
    if (p.guide && !flows.some((f) => f.id === p.guide)) errors.push(`pins[${i}] (${p.match || "?"}): guide "${p.guide}" matches no flow`);
    if (p.go && ![...pages].includes(p.go)) errors.push(`pins[${i}] (${p.match || "?"}): go "${p.go}" matches no entry page`);
  });

  flows.forEach((f, i) => {
    if (!f.id) errors.push(`flows[${i}]: missing id`);
    if (!f.title) errors.push(`flows[${i}] (${f.id || "?"}): missing title`);
    if (!f.steps?.length) errors.push(`flows[${i}] (${f.id || "?"}): no steps`);
    f.steps?.forEach((step, j) => {
      if (!ids.has(step)) errors.push(`flows[${i}].steps[${j}]: "${step}" matches no entry`);
    });
  });

  return errors;
}

/** Allowed top-level keys of `pointery.config.json` (`$schema` is ignored). Mirrors schema.json. */
const CONFIG_KEYS = new Set([
  "$schema", "trigger", "theme", "cssVars", "zIndex", "paletteWidth", "overlayBlur",
  "closed", "fab", "hiddenRoutes", "timing", "position", "animation", "suggestions",
  "allowActions", "labels", "endpoint", "routes", "brain",
]);

/**
 * Check a `pointery.config.json` for unknown keys, wrong types and bad enums
 * (e.g. `animation: "slid"`). Returns human-readable errors (empty = valid).
 * Used by `npx pointery config --validate`, `init --check` and the admin PUT route.
 */
export function validateConfig(cfg: unknown): string[] {
  const errors: string[] = [];
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return ["config must be a JSON object"];
  const c = cfg as Record<string, unknown>;
  for (const k of Object.keys(c)) if (!CONFIG_KEYS.has(k)) errors.push(`unknown key "${k}" - see schema.json`);
  if (c.position !== undefined && !["top", "center", "bottom"].includes(c.position as string))
    errors.push(`position must be one of top|center|bottom (got ${JSON.stringify(c.position)})`);
  if (c.animation !== undefined && !["fade", "slide", "scale", "none"].includes(c.animation as string))
    errors.push(`animation must be one of fade|slide|scale|none (got ${JSON.stringify(c.animation)})`);
  const closed = c.closed;
  const checkClosed = (o: unknown, where: string) => {
    if (o === undefined) return;
    if (!o || typeof o !== "object" || Array.isArray(o)) { errors.push(`${where} must be an object`); return; }
    const oo = o as Record<string, unknown>;
    for (const k of Object.keys(oo)) if (!["variant", "icon", "label", "hint", "showHint"].includes(k)) errors.push(`${where}: unknown key "${k}"`);
    if (oo.variant !== undefined && !["fab", "pill", "tab", "helper", "ghost"].includes(oo.variant as string))
      errors.push(`${where}.variant must be one of fab|pill|tab|helper|ghost (got ${JSON.stringify(oo.variant)})`);
    for (const k of ["icon", "label", "hint"]) {
      if (oo[k] !== undefined && typeof oo[k] !== "string") errors.push(`${where}.${k} must be a string (got ${JSON.stringify(oo[k])})`);
    }
    if (oo.showHint !== undefined && typeof oo.showHint !== "boolean") errors.push(`${where}.showHint must be a boolean (got ${JSON.stringify(oo.showHint)})`);
  };
  checkClosed(closed, "closed");
  // shortcut: numbers that arrive as strings ("14px") silently break CSS vars - flag them.
  for (const k of ["zIndex", "paletteWidth", "overlayBlur"]) {
    const v = (c[k] as unknown);
    if (v !== undefined && typeof v !== "number") errors.push(`${k} must be a number (got ${JSON.stringify(v)})`);
  }
  const numObj = (key: string, fields: string[]) => {
    const v = c[key];
    if (v === undefined) return;
    if (!v || typeof v !== "object" || Array.isArray(v)) { errors.push(`${key} must be an object`); return; }
    for (const f of fields) {
      const n = (v as Record<string, unknown>)[f];
      if (n !== undefined && typeof n !== "number") errors.push(`${key}.${f} must be a number (got ${JSON.stringify(n)})`);
    }
  };
  numObj("timing", ["toastMs", "pulseMs", "closeMs", "focusMs", "navigateMs", "navigateIdleMs", "askMs"]);
  // Per-page overrides: same enums as top level, unknown keys rejected.
  if (c.routes !== undefined) {
    const r = c.routes;
    if (!r || typeof r !== "object" || Array.isArray(r)) errors.push("routes must be an object keyed by path");
    else for (const [rk, rv] of Object.entries(r as Record<string, unknown>)) {
      if (!rv || typeof rv !== "object" || Array.isArray(rv)) { errors.push(`routes["${rk}"] must be an object`); continue; }
      const o = rv as Record<string, unknown>;
      for (const k of Object.keys(o)) if (!["trigger", "theme", "cssVars", "zIndex", "paletteWidth", "overlayBlur", "closed", "fab", "timing", "position", "animation", "suggestions", "allowActions", "labels", "endpoint"].includes(k)) errors.push(`routes["${rk}"]: unknown key "${k}"`);
      if (o.position !== undefined && !["top", "center", "bottom"].includes(o.position as string))
        errors.push(`routes["${rk}"].position must be one of top|center|bottom (got ${JSON.stringify(o.position)})`);
      if (o.animation !== undefined && !["fade", "slide", "scale", "none"].includes(o.animation as string))
        errors.push(`routes["${rk}"].animation must be one of fade|slide|scale|none (got ${JSON.stringify(o.animation)})`);
      checkClosed(o.closed, `routes["${rk}"].closed`);
    }
  }
  const brain = c.brain;
  if (brain !== undefined) {
    if (!brain || typeof brain !== "object" || Array.isArray(brain)) errors.push("brain must be an object");
    else {
      const b = brain as Record<string, unknown>;
      for (const k of Object.keys(b)) if (!["retrieve", "limits", "cache", "llm"].includes(k)) errors.push(`brain: unknown key "${k}"`);
      numObj("brain.retrieve", []);
      const sub = (sk: string, fields: string[]) => {
        const v = b[sk];
        if (v === undefined) return;
        if (!v || typeof v !== "object" || Array.isArray(v)) { errors.push(`brain.${sk} must be an object`); return; }
        for (const f of fields) {
          const n = (v as Record<string, unknown>)[f];
          if (n !== undefined && typeof n !== "number") errors.push(`brain.${sk}.${f} must be a number (got ${JSON.stringify(n)})`);
        }
      };
      sub("retrieve", ["entries", "flows", "actions"]);
      sub("limits", ["queryMax", "planMax"]);
      sub("cache", ["ttlMs", "max"]);
      sub("llm", ["temperature", "maxTokens"]);
    }
  }
  return errors;
}
