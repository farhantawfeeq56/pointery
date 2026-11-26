import type { PointeryContext, PointeryEntry, PointeryFlow, PointeryGuide, PointeryResult } from "./types.js";

type Action = PointeryContext["actions"][number];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();

/** Minimum entry score to count as a match — filters single-word overlap noise. */
const MIN_ENTRY_SCORE = 3;

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

// Matching derives from the entry's own words (id + label + for); aliases cover the rest.
const entryTerms = (e: PointeryEntry) => [e.id.replace(/-/g, " "), e.label, e.for ?? "", ...(e.aliases ?? [])];
const entryScore = (q: string, e: PointeryEntry, page?: string) => {
  const s = score(q, entryTerms(e));
  // Same-page boost: when the user is already there, prefer nearby anchors.
  return s > 0 && page && e.page === page ? s + 2 : s;
};
const flowScore = (q: string, f: PointeryFlow) =>
  score(q, [f.title, f.id.replace(/-/g, " "), ...(f.aliases ?? [])]);
const actionScore = (q: string, a: Action, entries: PointeryEntry[]) => {
  const anchor = entries.find((e) => e.id === a.at);
  return score(q, [a.name.replace(/-/g, " "), a.label ?? "", ...(a.aliases ?? []), ...(anchor ? entryTerms(anchor) : [])]);
};

export type RetrieveOptions = {
  entries?: number;
  flows?: number;
  actions?: number;
  /** Current route — same-page entries rank slightly higher. */
  page?: string;
};

/**
 * Rank the map for a query and return only the top candidates.
 * The LLM gets this slice — never the whole file — and writes the wording.
 */
export function retrieveCandidates(
  query: string,
  context: PointeryContext,
  opts: RetrieveOptions = {},
) {
  const q = norm(query);
  const { entries: nE = 8, flows: nF = 3, actions: nA = 3, page } = opts;
  if (!q) return { entries: [], flows: [], actions: [] } as Pick<PointeryContext, "entries" | "flows" | "actions">;

  // Candidates favor recall (>0) — the LLM reranks. Direct resolve below uses MIN_ENTRY_SCORE.
  const rankEntries = (context.entries ?? [])
    .map((e) => ({ e, s: entryScore(q, e, page) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, nE)
    .map((r) => r.e);
  const rankFlows = (context.flows ?? [])
    .map((f) => ({ f, s: flowScore(q, f) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, nF)
    .map((r) => r.f);
  const rankActions = (context.actions ?? [])
    .map((a) => ({ a, s: actionScore(q, a, context.entries ?? []) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, nA)
    .map((r) => r.a);
  return { entries: rankEntries, flows: rankFlows, actions: rankActions };
}

const byId = (entries: PointeryEntry[], id: string) => entries.find((e) => e.id === id);

/** Build guide steps from a flow's anchor ids. Wording is templated — the map holds no sentences. */
export function buildGuide(flow: PointeryFlow, entries: PointeryEntry[]): PointeryGuide {
  const steps = flow.steps
    .map((id) => byId(entries, id))
    .filter((e): e is PointeryEntry => Boolean(e))
    .map((e) => ({
      text: e.type === "button" ? `Click ${e.label}` : `Go to ${e.label}`,
      go: e.page,
      spot: e.id,
    }));
  return { id: flow.id, title: flow.title, steps };
}

export function resolveQuery(query: string, context: PointeryContext, page?: string): PointeryResult {
  const entries = context.entries ?? [];
  const flows = context.flows ?? [];
  const actions = context.actions ?? [];
  const q = norm(query);
  if (!q) return {};

  let bestFlow: PointeryFlow | null = null;
  let bestFlowScore = 0;
  for (const f of flows) {
    const s = flowScore(q, f);
    if (s > bestFlowScore) { bestFlowScore = s; bestFlow = f; }
  }

  let bestEntry: PointeryEntry | null = null;
  let bestEntryScore = 0;
  for (const e of entries) {
    const s = entryScore(q, e, page);
    if (s > bestEntryScore) { bestEntryScore = s; bestEntry = e; }
  }

  let bestAction: Action | null = null;
  let bestActionScore = 0;
  for (const a of actions) {
    const s = actionScore(q, a, entries);
    if (s > bestActionScore) { bestActionScore = s; bestAction = a; }
  }

  // "where …" wants a place; "how/walk/guide …" wants steps.
  const wantsEntry = /^(where|show me|take me|go to|find|open)/.test(q);
  const wantsGuide = /^(how|walk|guide|steps|tutorial)/.test(q) || bestFlowScore >= 12;
  if (wantsEntry && bestEntry && bestEntryScore >= MIN_ENTRY_SCORE) {
    return { spot: bestEntry.id, go: bestEntry.page, hint: bestEntry.label };
  }
  // An exact action match beats a guide; guides win only when they outscore.
  if (bestAction && bestActionScore >= 12 && bestActionScore >= bestEntryScore && bestActionScore >= bestFlowScore) {
    const anchor = (bestAction.at ? byId(entries, bestAction.at) : undefined) ?? bestEntry;
    return { action: bestAction.name, confirm: bestAction.confirm, spot: anchor?.id, hint: bestAction.label ?? bestAction.name };
  }
  if (bestFlow && wantsGuide && bestFlowScore >= Math.max(6, bestEntryScore - 4)) {
    const guide = buildGuide(bestFlow, entries);
    const first = guide.steps[0];
    return { guide, spot: first?.spot, go: first?.go, hint: guide.title };
  }
  if (bestAction && bestActionScore >= 12 && bestActionScore >= bestEntryScore) {
    const anchor = (bestAction.at ? byId(entries, bestAction.at) : undefined) ?? bestEntry;
    return { action: bestAction.name, confirm: bestAction.confirm, spot: anchor?.id, hint: bestAction.label ?? bestAction.name };
  }
  if (bestEntry && bestEntryScore >= MIN_ENTRY_SCORE) {
    return { spot: bestEntry.id, go: bestEntry.page, hint: bestEntry.label };
  }
  return {};
}

export function getSuggestions(): string[] {
  return [
    "Where is export?",
    "How do I invite a teammate?",
    "Show me the pipeline table",
    "Walk me through closing a deal",
    "Where is the Acme deal?",
  ];
}
