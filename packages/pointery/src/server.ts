import { resolveQuery, retrieveCandidates } from "./resolver.js";
import type { AskHandlerOptions, PointeryContext, PointeryResult } from "./types.js";

/** Drop LLM fields that point outside the shipped map (Fix 4/5: LLM text is untrusted). */
function sanitizeResult(r: PointeryResult, context: PointeryContext): PointeryResult {
  const out: PointeryResult = {};
  const keys = new Set((context.targets ?? []).map((t) => t.key));
  const pages = new Set((context.targets ?? []).map((t) => t.page));
  const actionNames = new Set((context.actions ?? []).map((a) => a.name));
  const guideIds = new Set((context.guides ?? []).map((g) => g.id));
  const confirmOf = (name: string) => (context.actions ?? []).find((a) => a.name === name)?.confirm;
  if (r.action && actionNames.has(r.action)) {
    out.action = r.action;
    out.confirm = confirmOf(r.action);
  }
  if (r.guide && guideIds.has(r.guide.id)) out.guide = r.guide;
  if (r.spot && keys.has(r.spot)) out.spot = r.spot;
  if (r.go && pages.has(r.go)) out.go = r.go;
  if ((out.spot || out.go || out.action || out.guide) && r.hint) out.hint = r.hint;
  if (r.answer && (out.spot || out.go)) { out.answer = r.answer; if (r.hint) out.hint = r.hint; }
  return out;
}

/**
 * Build a `POST(req)` handler for the consumer's `/api/ask` route.
 * Uses the bundled keyword resolver; when `opts.llm` is set, forwards
 * `{ query, candidates, page }` — the top-ranked slice of the map, never the
 * whole file — to the customer's own model endpoint first
 * (their key, their cost — nothing comes to us) and falls back locally.
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

    if (opts.llm?.url) {
      try {
        const candidates = retrieveCandidates(query, context, {
          targets: opts.retrieve?.targets ?? 8,
          guides: opts.retrieve?.guides ?? 3,
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
        if (r.ok) return Response.json(sanitizeResult(await r.json(), context));
      } catch {
        // fall through to local resolver
      }
    }

    const local = resolveQuery(query, context, page);
    const override: PointeryResult | null = opts.guard?.(query, local) ?? null;
    return Response.json(override ?? local);
  };
}
