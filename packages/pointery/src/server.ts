import { buildGuide, resolveQuery, retrieveCandidates } from "./resolver.js";
import type { AskHandlerOptions, PointeryContext, PointeryResult } from "./types.js";

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
  if (r.spot && ids.has(r.spot)) {
    out.spot = r.spot;
    // Row search text survives only on rows:true containers — never per-record ids.
    const f = typeof r.filter === "string" ? r.filter.trim().slice(0, 80) : "";
    if (f && byId.get(r.spot)?.rows) out.filter = f;
  }
  if (r.go && pages.has(r.go)) out.go = r.go;
  if ((out.spot || out.go || out.action || out.guide) && r.hint) out.hint = r.hint;
  if (r.answer && (out.spot || out.go)) { out.answer = r.answer; if (r.hint) out.hint = r.hint; }
  return out;
}

/**
 * Build a `POST(req)` handler for the consumer's `/api/ask` route.
 * Tries the bundled keyword resolver first (curated `pins[]` before generic
 * scoring); only when it misses (no spot/go/action/guide) and `opts.llm`
 * is set, forwards
 * `{ query, candidates, page }` — the top-ranked slice of the map, never the
 * whole file — to the customer's own model endpoint
 * (their key, their cost — nothing comes to us).
 *
 * Local wins `where/how/do` navigation, guides and allowlisted actions
 * (fast, free). The LLM handles only what keywords can't: answers,
 * `filter` row search on `rows:true` spots, paraphrase and fuzzy queries.
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

    const local = sanitizeResult(resolveQuery(query, context, page), context, opts.allowActions);
    // Confident local hit: skip the LLM entirely (fast, free).
    if (local.spot || local.go || local.action || local.guide) {
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
          if (final.spot || final.go || final.action || final.guide || final.answer) return Response.json(final);
        }
      } catch {
        // fall through to local miss below
      }
    }

    const override: PointeryResult | null = opts.guard?.(query, local) ?? null;
    return Response.json(override ?? local);
  };
}
