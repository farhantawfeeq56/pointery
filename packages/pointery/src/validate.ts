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

  const actionNames = new Set<string>();
  actions.forEach((a, i) => {
    if (!a.name) errors.push(`actions[${i}]: missing name`);
    else if (actionNames.has(a.name)) errors.push(`actions[${i}]: duplicate name "${a.name}"`);
    else actionNames.add(a.name);
    if (a.at && !ids.has(a.at)) errors.push(`actions[${i}] (${a.name || "?"}): at "${a.at}" matches no entry`);
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
