import { buildGuide, resolveCombo, resolveQuery, retrieveCandidates, splitClauses } from "./resolver.js";
import type { AskHandlerOptions, PointeryContext, PointeryPlan, PointeryResult } from "./types.js";

/** Drop plan steps that point outside the map; rebuild wording from labels. Needs >=2 valid steps. */
function sanitizePlan(raw: unknown, context: PointeryContext): PointeryPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const steps = (raw as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) return null;
  const byId = new Map((context.entries ?? []).map((e) => [e.id, e]));
  const title = typeof (raw as { title?: unknown }).title === "string"
    ? ((raw as { title: string }).title.trim().slice(0, 80) || "Your steps")
    : "Your steps";
  // shortcut: plan steps are navigation-only; step actions collapse to "take me there".
  const out = steps.slice(0, 4).flatMap((s) => {
    if (!s || typeof s !== "object") return [];
    const spot = (s as { spot?: unknown }).spot;
    if (typeof spot !== "string" || !byId.has(spot)) return [];
    const e = byId.get(spot)!;
    const go = typeof (s as { go?: unknown }).go === "string" && (context.entries ?? []).some((x) => x.page === (s as { go: string }).go)
      ? (s as { go: string }).go
      : e.page;
    const f = typeof (s as { filter?: unknown }).filter === "string" ? (s as { filter: string }).filter.trim().slice(0, 80) : "";
    return [{
      text: e.type === "button" ? `Click ${e.label}` : `Go to ${e.label}`,
      go,
      spot,
      ...(f && e.rows ? { filter: f } : {}),
    }];
  });
  if (out.length < 2) return null;
  return { title, steps: out };
}

/** Drop LLM fields that point outside the shipped map (LLM text is untrusted). Guide steps are rebuilt from the flow — the model picks anchors, never wording. */
function sanitizeResult(r: PointeryResult, context: PointeryContext, allowed?: string[]): PointeryResult {
  const out: PointeryResult = {};
  const ids = new Set((context.entries ?? []).map((e) => e.id));
  const byId = new Map((context.entries ?? []).map((e) => [e.id, e]));
  const pages = new Set((context.entries ?? []).map((e) => e.page));
  const actionNames = new Set((context.actions ?? []).map((a) => a.name));
  const flows = new Map((context.flows ?? []).map((f) => [f.id, f]));
  const confirmOf = (name: string) => (context.actions ?? []).find((a) => a.name === name)?.confirm;
  // Blocked actions are dropped but spot/go/guide survive — the UI routes there instead.
  if (r.action && actionNames.has(r.action) && (!allowed || allowed.includes(r.action))) {
    out.action = r.action;
    out.confirm = confirmOf(r.action);
  }
  if (r.guide && flows.has(r.guide.id)) out.guide = buildGuide(flows.get(r.guide.id)!, context.entries ?? []);
  const plan = sanitizePlan((r as { plan?: unknown }).plan, context);
  if (plan) {
    out.plan = plan;
    const first = plan.steps[0];
    if (first) {
      if (!out.spot) { out.spot = first.spot; if (first.filter) out.filter = first.filter; }
      if (!out.go) out.go = first.go;
    }
  }
  if (r.spot && ids.has(r.spot)) {
    out.spot = r.spot;
    // Row search text survives only on rows:true containers — never per-record ids.
    const f = typeof r.filter === "string" ? r.filter.trim().slice(0, 80) : "";
    if (f && byId.get(r.spot)?.rows) out.filter = f;
  }
  if (r.go && pages.has(r.go)) out.go = r.go;
  if ((out.spot || out.go || out.action || out.guide || out.plan) && r.hint) out.hint = r.hint;
  if (out.plan && !out.hint && typeof r.hint !== "string") out.hint = out.plan.title;
  if (r.answer && (out.spot || out.go)) { out.answer = r.answer; if (r.hint) out.hint = r.hint; }
  return out;
}

/**
 * Build a `POST(req)` handler for the consumer's `/api/ask` route.
 * Tries the bundled keyword resolver first (curated `pins[]` before generic
 * scoring, combo clauses before single); only when it misses
 * (no spot/go/action/guide/plan) and `opts.llm` is set, forwards
 * `{ query, candidates, page }` — the top-ranked slice of the map, never the
 * whole file — to the customer's own model endpoint
 * (their key, their cost — nothing comes to us).
 *
 * Local wins `where/how/do` navigation, guides and allowlisted actions
 * (fast, free). The LLM handles only what keywords can't: answers,
 * `filter` row search on `rows:true` spots, paraphrase and fuzzy queries,
 * and `plan` walkthroughs for "A and B" combo queries.
 *
 * ```ts
 * // app/api/ask/route.ts
 * import { createAskHandler, type PointeryContext } from "pointery";
 * import context from "@/pointery.context.json";
 * export const POST = createAskHandler(context as PointeryContext);
 * ```
 */
export function createAskHandler(context: PointeryContext, opts: AskHandlerOptions = {}) {
  return async function POST(req: Request): Promise<Response> {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const query = typeof body.query === "string" ? body.query : "";
    const page = typeof body.page === "string" ? body.page : undefined;

    // Free combo path: each "and/then" clause resolved locally into a plan.
    const combo = sanitizeResult(resolveCombo(query, context, page) ?? {}, context, opts.allowActions);
    if (combo.plan) {
      const override: PointeryResult | null = opts.guard?.(query, combo) ?? null;
      return Response.json(override ?? combo);
    }
    const local = sanitizeResult(resolveQuery(query, context, page), context, opts.allowActions);
    // Confident local hit: skip the LLM entirely (fast, free) — unless the
    // query looks like a combo whose other half the single hit would hide.
    const looksCombo = splitClauses(query).length > 1;
    if ((local.spot || local.go || local.action || local.guide) && !looksCombo) {
      const override: PointeryResult | null = opts.guard?.(query, local) ?? null;
      return Response.json(override ?? local);
    }

    if (opts.llm?.url && query.trim()) {
      try {
        const candidates = retrieveCandidates(query, context, {
          entries: opts.retrieve?.entries ?? 8,
          flows: opts.retrieve?.flows ?? 3,
          actions: opts.retrieve?.actions ?? 3,
          page,
        });
        const r = await fetch(opts.llm.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(opts.llm.key ? { authorization: `Bearer ${opts.llm.key}` } : {}),
          },
          body: JSON.stringify({ query, candidates, page }),
        });
        if (r.ok) {
          const llm = sanitizeResult(await r.json(), context, opts.allowActions);
          const override: PointeryResult | null = opts.guard?.(query, llm) ?? null;
          const final = override ?? llm;
          // LLM miss too: return the (empty) local result, guarded.
          if (final.spot || final.go || final.action || final.guide || final.plan || final.answer) return Response.json(final);
        }
      } catch {
        // fall through to local miss below
      }
    }

    const override: PointeryResult | null = opts.guard?.(query, local) ?? null;
    return Response.json(override ?? local);
  };
}
