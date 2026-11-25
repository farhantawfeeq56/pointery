import context from "@/pointery.context.json";
import type { PointeryResult } from "./types";

type Target = { key: string; page: string; hint: string; keywords: string[] };
type Guide = { id: string; title: string; keywords: string[]; steps: { text: string; go: string; spot: string }[] };
type Action = { name: string; label?: string; confirm?: boolean; keywords: string[] };

const targets = (context.targets ?? []) as Target[];
const guides = (context.guides ?? []) as Guide[];
const actions = (context.actions ?? []) as Action[];

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

export function resolveQuery(query: string): PointeryResult {
  const q = norm(query);
  if (!q) return {};

  // Direct answers (demo data)
  if (/(how much|pipeline value|total|revenue|pipeline is)/.test(q) && /(pipeline|much|total|value|revenue)/.test(q)) {
    return { answer: "Open pipeline is $20,400 across 4 deals.", spot: "pipeline-value", go: "/demo", hint: "Pipeline value" };
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
    return { action: bestAction.name, spot, hint: bestAction.label ?? bestAction.name };
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
