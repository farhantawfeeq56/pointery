import { resolveQuery } from "./resolver.js";
import type { AskHandlerOptions, PointeryContext, PointeryResult } from "./types.js";

/**
 * Build a `POST(req)` handler for the consumer's `/api/ask` route.
 * Uses the bundled keyword resolver; when `opts.llm` is set, forwards
 * `{ query, context }` to the customer's own model endpoint first
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

    if (opts.llm?.url) {
      try {
        const r = await fetch(opts.llm.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(opts.llm.key ? { authorization: `Bearer ${opts.llm.key}` } : {}),
          },
          body: JSON.stringify({ query, context }),
        });
        if (r.ok) return Response.json(await r.json());
      } catch {
        // fall through to local resolver
      }
    }

    const local = resolveQuery(query, context);
    const override: PointeryResult | null = opts.guard?.(query, local) ?? null;
    return Response.json(override ?? local);
  };
}
