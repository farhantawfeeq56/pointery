import type { PointeryContext, PointeryResult } from "./types.js";

type Target = PointeryContext["targets"][number];
type Guide = PointeryContext["guides"][number];
type Action = PointeryContext["actions"][number];

const norm = (s: string) => s.toLowerCase().trim();
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

export function resolveQuery(query: string, context: PointeryContext): PointeryResult {
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
    const s = score(q, [g.title, g.id.replace(/-/g, " "), ...g.keywords]);
    if (s > bestGuideScore) { bestGuideScore = s; bestGuide = g; }
  }

  let bestTarget: Target | null = null;
  let bestTargetScore = 0;
  for (const t of targets) {
    const s = score(q, [t.key.replace(/-/g, " "), t.hint, ...t.keywords]);
    if (s > bestTargetScore) { bestTargetScore = s; bestTarget = t; }
  }

  let bestAction: Action | null = null;
  let bestActionScore = 0;
  for (const a of actions) {
    const s = score(q, [a.name.replace(/-/g, " "), a.label ?? "", ...a.keywords]);
    if (s > bestActionScore) { bestActionScore = s; bestAction = a; }
  }

  // "how do I …" prefers a guide; short "export"/"invite" prefers target+action
  const wantsGuide = /^(how|where|show me|walk|guide|steps)/.test(q) || bestGuideScore >= 12;
  if (bestGuide && wantsGuide && bestGuideScore >= Math.max(6, bestTargetScore - 4)) {
    const first = bestGuide.steps[0];
    return {
      guide: { id: bestGuide.id, title: bestGuide.title, steps: bestGuide.steps },
      spot: first?.spot, go: first?.go, hint: bestGuide.title,
    };
  }
  if (bestAction && bestActionScore >= 12 && bestActionScore >= bestTargetScore) {
    const spot = targets.find((t) => norm(t.hint).includes(bestAction!.name.replace(/-/g, " ").split(" ")[0]))?.key;
    return { action: bestAction.name, confirm: bestAction.confirm, spot, hint: bestAction.label ?? bestAction.name };
  }
  if (bestTarget && bestTargetScore > 0) {
    return { spot: bestTarget.key, go: bestTarget.page, hint: bestTarget.hint };
  }
  return {};
}

export function getSuggestions(): string[] {
  return [
    "Where is export?",
    "How do I invite a teammate?",
    "What is my pipeline worth?",
    "Take me to the Acme deal",
    "Walk me through closing a deal",
  ];
}
