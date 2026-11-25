import type { PointeryContext } from "./types.js";

/**
 * Check a `pointery.context.json` for the mistakes agents commonly make:
 * missing fields, duplicate keys, guide steps pointing at ids that don't exist.
 * Returns human-readable errors (empty = valid). Used by `npx pointery init --check`.
 */
export function validateContext(ctx: PointeryContext): string[] {
  const errors: string[] = [];
  if (!ctx || typeof ctx !== "object") return ["context must be an object"];
  const targets = ctx.targets ?? [];
  const guides = ctx.guides ?? [];
  const actions = ctx.actions ?? [];

  const keys = new Set<string>();
  targets.forEach((t, i) => {
    if (!t.key) errors.push(`targets[${i}]: missing key`);
    else if (keys.has(t.key)) errors.push(`targets[${i}]: duplicate key "${t.key}"`);
    else keys.add(t.key);
    if (!t.page) errors.push(`targets[${i}] (${t.key || "?"}): missing page`);
    if (!t.hint) errors.push(`targets[${i}] (${t.key || "?"}): missing hint`);
    if (!t.keywords?.length) errors.push(`targets[${i}] (${t.key || "?"}): no keywords`);
  });

  const actionNames = new Set<string>();
  actions.forEach((a, i) => {
    if (!a.name) errors.push(`actions[${i}]: missing name`);
    else if (actionNames.has(a.name)) errors.push(`actions[${i}]: duplicate name "${a.name}"`);
    else actionNames.add(a.name);
  });

  guides.forEach((g, i) => {
    if (!g.id) errors.push(`guides[${i}]: missing id`);
    if (!g.steps?.length) errors.push(`guides[${i}] (${g.id || "?"}): no steps`);
    g.steps?.forEach((s, j) => {
      if (!s.text) errors.push(`guides[${i}].steps[${j}]: missing text`);
      if (s.spot && !keys.has(s.spot)) errors.push(`guides[${i}].steps[${j}]: spot "${s.spot}" matches no target`);
    });
  });

  return errors;
}
