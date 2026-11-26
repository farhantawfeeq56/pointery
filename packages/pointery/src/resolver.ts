import type { PointeryContext, PointeryResult } from "./types.js";

type Target = PointeryContext["targets"][number];
type Guide = PointeryContext["guides"][number];
type Action = PointeryContext["actions"][number];

const norm = (s: string) => s.toLowerCase().trim();

/** Minimum target score to count as a match — filters single-word overlap noise. */
const MIN_TARGET_SCORE = 3;

const score = (q: string, keywords: string[]) => {
  const query = norm(q);
  let best = 0;
  for (const k of keywords) {
    const key = norm(k);
    if (!key) continue;
    if (query === key) return 100 + key.length;
    if (query.includes(key) || key.includes(query)) best = Math.max(best, 10 + key.length);
  }
  // word overlap fallback
  const words = query.split(/\s+/);
  for (const k of keywords) {
    const key = norm(k);
    const hit = words.filter((w) => w.length > 2 && key.includes(w)).length;
    if (hit > 0) best = Math.max(best, hit);
  }
  return best;
};

const targetScore = (q: string, t: Target, page?: string) => {
  const s = score(q, [t.key.replace(/-/g, " "), t.hint, ...t.keywords]);
  // Same-page boost: when the user is already there, prefer nearby anchors.
  return s > 0 && page && t.page === page ? s + 2 : s;
};
const guideScore = (q: string, g: Guide) =>
  score(q, [g.title, g.id.replace(/-/g, " "), ...g.keywords]);
const actionScore = (q: string, a: Action) =>
  score(q, [a.name.replace(/-/g, " "), a.label ?? "", ...a.keywords]);

export type RetrieveOptions = {
  targets?: number;
  guides?: number;
  actions?: number;
  /** Current route — same-page targets rank slightly higher. */
  page?: string;
};

/**
 * Rank the map for a query and return only the top candidates.
 * The LLM gets this slice — never the whole file (Fix 4).
 */
export function retrieveCandidates(
  query: string,
  context: PointeryContext,
  opts: RetrieveOptions = {},
) {
  const q = norm(query);
  const { targets: nT = 8, guides: nG = 3, actions: nA = 3, page } = opts;
  if (!q) return { targets: [], guides: [], actions: [] } as Pick<PointeryContext, "targets" | "guides" | "actions">;

  const rankTargets = (context.targets ?? [])
    .map((t) => ({ t, s: targetScore(q, t, page) }))
    .filter((r) => r.s >= MIN_TARGET_SCORE)
    .sort((a, b) => b.s - a.s)
    .slice(0, nT)
    .map((r) => r.t);
  const rankGuides = (context.guides ?? [])
    .map((g) => ({ g, s: guideScore(q, g) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, nG)
    .map((r) => r.g);
  const rankActions = (context.actions ?? [])
    .map((a) => ({ a, s: actionScore(q, a) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, nA)
    .map((r) => r.a);
  return { targets: rankTargets, guides: rankGuides, actions: rankActions };
}

export function resolveQuery(query: string, context: PointeryContext, page?: string): PointeryResult {
  const targets = context.targets ?? [];
  const guides = context.guides ?? [];
  const actions = context.actions ?? [];
  const q = norm(query);
  if (!q) return {};

  // Direct answers come from the consumer's context — never hardcoded here.
  if (context.answers) {
    let best: NonNullable<PointeryContext["answers"]>[number] | null = null;
    let bestScore = 0;
    for (const a of context.answers) {
      const s = score(q, a.keywords);
      if (s > bestScore) { bestScore = s; best = a; }
    }
    if (best && bestScore >= 10) {
      return { answer: best.answer, spot: best.spot, go: best.go, hint: best.hint };
    }
  }

  let bestGuide: Guide | null = null;
  let bestGuideScore = 0;
  for (const g of guides) {
    const s = guideScore(q, g);
    if (s > bestGuideScore) { bestGuideScore = s; bestGuide = g; }
  }

  let bestTarget: Target | null = null;
  let bestTargetScore = 0;
  for (const t of targets) {
    const s = targetScore(q, t, page);
    if (s > bestTargetScore) { bestTargetScore = s; bestTarget = t; }
  }

  let bestAction: Action | null = null;
  let bestActionScore = 0;
  for (const a of actions) {
    const s = actionScore(q, a);
    if (s > bestActionScore) { bestActionScore = s; bestAction = a; }
  }

  // "where …" wants a place; "how/walk/guide …" wants steps. (Fix 2: "where"
  // no longer falls through to guides/actions.)
  const wantsTarget = /^(where|show me|take me|go to|find|open)/.test(q);
  const wantsGuide = /^(how|walk|guide|steps|tutorial)/.test(q) || bestGuideScore >= 12;
  if (wantsTarget && bestTarget && bestTargetScore >= MIN_TARGET_SCORE) {
    return { spot: bestTarget.key, go: bestTarget.page, hint: bestTarget.hint };
  }
  if (bestGuide && wantsGuide && bestGuideScore >= Math.max(6, bestTargetScore - 4)) {
    const first = bestGuide.steps[0];
    return {
      guide: { id: bestGuide.id, title: bestGuide.title, steps: bestGuide.steps },
      spot: first?.spot, go: first?.go, hint: bestGuide.title,
    };
  }
  if (bestAction && bestActionScore >= 12 && bestActionScore >= bestTargetScore) {
    // Anchor the action to its best-scoring target (was: first hint containing
    // the action's first word — wrong as soon as two hints share a word).
    let spot: string | undefined;
    let spotScore = 0;
    for (const t of targets) {
      const s = score(q, [t.key.replace(/-/g, " "), t.hint, ...t.keywords]);
      if (s > spotScore) { spotScore = s; spot = t.key; }
    }
    return { action: bestAction.name, confirm: bestAction.confirm, spot, hint: bestAction.label ?? bestAction.name };
  }
  if (bestTarget && bestTargetScore >= MIN_TARGET_SCORE) {
    return { spot: bestTarget.key, go: bestTarget.page, hint: bestTarget.hint };
  }
  return {};
}

export function getSuggestions(): string[] {
  return [
    "Where is export?",
    "How do I invite a teammate?",
    "Show me the pipeline table",
    "Walk me through closing a deal",
  ];
}
