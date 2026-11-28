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

  // Live values ($1,234, record names) go stale per user — the map holds stable anchors only.
  const looksLive = (s: string) => /\$\s*\d/.test(s);

  const ids = new Set<string>();
  entries.forEach((e, i) => {
    if (!e.id) errors.push(`entries[${i}]: missing id`);
    else if (ids.has(e.id)) errors.push(`entries[${i}]: duplicate id "${e.id}"`);
    else ids.add(e.id);
    if (!e.page) errors.push(`entries[${i}] (${e.id || "?"}): missing page`);
    if (!e.label) errors.push(`entries[${i}] (${e.id || "?"}): missing label`);
    if (e.label && looksLive(e.label)) errors.push(`entries[${i}] (${e.id || "?"}): label looks like live data — keep stable anchors only`);
    if (e.for && looksLive(e.for)) errors.push(`entries[${i}] (${e.id || "?"}): for looks like live data — keep stable anchors only`);
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
  "fab", "hiddenRoutes", "timing", "position", "animation", "suggestions",
  "allowActions", "labels", "endpoint", "brain",
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
  for (const k of Object.keys(c)) if (!CONFIG_KEYS.has(k)) errors.push(`unknown key "${k}" — see schema.json`);
  if (c.position !== undefined && !["top", "center", "bottom"].includes(c.position as string))
    errors.push(`position must be one of top|center|bottom (got ${JSON.stringify(c.position)})`);
  if (c.animation !== undefined && !["fade", "slide", "scale", "none"].includes(c.animation as string))
    errors.push(`animation must be one of fade|slide|scale|none (got ${JSON.stringify(c.animation)})`);
  // shortcut: numbers that arrive as strings ("14px") silently break CSS vars — flag them.
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
  numObj("timing", ["toastMs", "pulseMs", "closeMs", "focusMs", "navigateMs", "navigateIdleMs"]);
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
