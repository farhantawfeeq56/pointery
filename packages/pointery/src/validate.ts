import type { PointeryContext } from "./types.js";

/**
 * Check a `pointery.context.json` for the mistakes agents commonly make:
 * missing fields, duplicate keys, guide steps pointing at ids that don't exist,
 * steps navigating away from their target's page, live per-user data baked
 * into a ship-time index. Returns human-readable errors (empty = valid).
 * Used by `npx pointery init --check`.
 */
export function validateContext(ctx: PointeryContext): string[] {
  const errors: string[] = [];
  if (!ctx || typeof ctx !== "object") return ["context must be an object"];
  const targets = ctx.targets ?? [];
  const guides = ctx.guides ?? [];
  const actions = ctx.actions ?? [];

  const keys = new Set<string>();
  const pageOf = new Map<string, string>();
  // Live values ($1,234, record names) go stale per user — the map holds stable anchors only.
  const looksLive = (s: string) => /\$\s*\d/.test(s);
  targets.forEach((t, i) => {
    if (!t.key) errors.push(`targets[${i}]: missing key`);
    else if (keys.has(t.key)) errors.push(`targets[${i}]: duplicate key "${t.key}"`);
    else keys.add(t.key);
    if (!t.page) errors.push(`targets[${i}] (${t.key || "?"}): missing page`);
    if (!t.hint) errors.push(`targets[${i}] (${t.key || "?"}): missing hint`);
    if (!t.keywords?.length) errors.push(`targets[${i}] (${t.key || "?"}): no keywords`);
    if (t.hint && looksLive(t.hint)) errors.push(`targets[${i}] (${t.key || "?"}): hint looks like live data — keep stable anchors only`);
    if (t.page) pageOf.set(t.key, t.page);
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
      else if (s.spot && s.go && pageOf.get(s.spot) !== s.go) errors.push(`guides[${i}].steps[${j}]: go "${s.go}" differs from target "${s.spot}" page "${pageOf.get(s.spot)}"`);
    });
  });

  (ctx.answers ?? []).forEach((a, i) => {
    if (!a.keywords?.length) errors.push(`answers[${i}]: no keywords`);
    if (!a.answer) errors.push(`answers[${i}]: missing answer`);
    if (a.answer && looksLive(a.answer)) errors.push(`answers[${i}]: answer looks like live data — answers hold static copy only`);
    if (a.spot && !keys.has(a.spot)) errors.push(`answers[${i}]: spot "${a.spot}" matches no target`);
  });

  return errors;
}
