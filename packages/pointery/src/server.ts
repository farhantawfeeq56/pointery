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
 * The LLM is required: without `opts.llm` (`url` + `key` + `model`) every ask
 * fails closed with a 503 + "LLM not configured" answer instead of
 * returning a guessed keyword result. Keyword scoring still runs first
 * (curated `pins[]` before generic scoring, combo clauses before single)
 * to save cost — confident hits return at once — but misses need the model:
 * candidates (top-ranked slice, never the whole file) go as system context
 * in an OpenAI-compatible `{ model, messages }` call to the customer's own
 * endpoint (their key, their cost — nothing comes to us).
 *
 * Local wins `where/how/do` navigation, guides and allowlisted actions
 * (fast, free). The LLM handles only what keywords can't: answers,
 * `filter` row search on `rows:true` spots, paraphrase and fuzzy queries,
 * and `plan` walkthroughs for "A and B" combo queries.
 * Token savers: queries capped at 200 chars, single-intent shortlist is
 * 5/2/2 (combos keep 8/3/3), LLM hits cached 5 min (repeats cost 0).
 *
 * ```ts
 * // app/api/ask/route.ts
 * import { createAskHandler, type PointeryContext } from "pointery";
 * import context from "@/pointery.context.json";
 * export const POST = createAskHandler(context as PointeryContext, {
 *   llm: { url: process.env.POINTERY_LLM_URL ?? "", key: process.env.POINTERY_LLM_KEY ?? "", model: process.env.POINTERY_LLM_MODEL ?? "" },
 * });
 * ```
 */
// Smart default so OpenAI works with zero model config; every other provider
// passes its model id through verbatim (copy it from the provider dashboard).
function defaultModelFor(url: string): string {
  try {
    if (new URL(url).host.includes("openai.com")) return "gpt-4o-mini";
  } catch {
    /* relative or empty url — no default */
  }
  return "";
}
// Tiny LLM-response cache: normalized query + page + allowActions + model, 5 min TTL, max 200. Repeats cost 0 tokens.
const llmCache = new Map<string, { at: number; result: PointeryResult }>();
const LLM_CACHE_TTL = 5 * 60 * 1000;
const LLM_CACHE_MAX = 200;
const cacheKey = (q: string, page: string | undefined, allowed?: string[], model?: string) =>
  `${q.trim().toLowerCase().slice(0, 200)}|${page ?? ""}|${(allowed ?? []).join(",")}|${model ?? ""}`;

export function createAskHandler(context: PointeryContext, opts: AskHandlerOptions = {}) {
  return async function POST(req: Request): Promise<Response> {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const query = typeof body.query === "string" ? body.query : "";
    const page = typeof body.page === "string" ? body.page : undefined;
    // Cap what we forward — long pastes cost tokens without helping retrieval.
    const q = query.trim().slice(0, 200);

    // Compulsory brain: fail closed instead of guessing from keywords alone.
    // URL + key + model are asked for together in `.env.local` (one step, one restart).
    const llmModel = opts.llm?.model?.trim() || defaultModelFor(opts.llm?.url ?? "");
    if (!opts.llm?.url || !opts.llm?.key || !llmModel) {
      return Response.json(
        { answer: "LLM not configured. Set POINTERY_LLM_URL, POINTERY_LLM_KEY and POINTERY_LLM_MODEL in .env.local and restart." },
        { status: 503 },
      );
    }

    // Free combo path: each "and/then" clause resolved locally into a plan.
    const combo = sanitizeResult(resolveCombo(q, context, page) ?? {}, context, opts.allowActions);
    if (combo.plan) {
      const override: PointeryResult | null = opts.guard?.(query, combo) ?? null;
      return Response.json(override ?? combo);
    }
    const local = sanitizeResult(resolveQuery(q, context, page), context, opts.allowActions);
    // Confident local hit: skip the LLM entirely (fast, free) — unless the
    // query looks like a combo whose other half the single hit would hide.
    const looksCombo = splitClauses(q).length > 1;
    if ((local.spot || local.go || local.action || local.guide) && !looksCombo) {
      const override: PointeryResult | null = opts.guard?.(query, local) ?? null;
      return Response.json(override ?? local);
    }

    if (opts.llm?.url && q) {
      const key = cacheKey(q, page, opts.allowActions, llmModel);
      const hit = llmCache.get(key);
      if (hit && Date.now() - hit.at < LLM_CACHE_TTL) {
        const override: PointeryResult | null = opts.guard?.(query, hit.result) ?? null;
        return Response.json(override ?? hit.result);
      }
      try {
        const single = !looksCombo;
        const candidates = retrieveCandidates(q, context, {
          entries: single ? (opts.retrieve?.entries ?? 5) : (opts.retrieve?.entries ?? 8),
          flows: single ? (opts.retrieve?.flows ?? 2) : (opts.retrieve?.flows ?? 3),
          actions: single ? (opts.retrieve?.actions ?? 2) : (opts.retrieve?.actions ?? 3),
          page,
        });
        // One wire for every provider: OpenAI-compatible chat completions.
        // `model` passes through verbatim — OpenAI, OpenRouter, Ollama, etc.
        // all accept it, so hundreds of models work with no per-provider code.
        const r = await fetch(opts.llm.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(opts.llm.key ? { authorization: `Bearer ${opts.llm.key}` } : {}),
          },
          body: JSON.stringify({
            model: llmModel,
            temperature: 0,
            max_tokens: 300,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `You route in-app help. Candidates (JSON): ${JSON.stringify(candidates)}. Reply with JSON only: { "spot"?, "go"?, "action"?, "filter"?, "answer"?, "hint"?, "guide"?: { "id" }, "plan"?: { "title", "steps": [{ "spot", "go"? }] } }. spot must be an entry id, go an entry page, action a candidate action name, guide.id a candidate flow id. filter only alongside a rows:true spot, max 80 chars.`,
              },
              { role: "user", content: `${q}${page ? ` (current page: ${page})` : ""}` },
            ],
          }),
        });
        if (r.ok) {
          const data = await r.json();
          // New wire: OpenAI `choices[0].message.content` (JSON string).
          // Old wire (custom `{ query, candidates }` endpoints): raw result JSON.
          const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
          let payload: unknown = data;
          if (typeof content === "string" && content.trim()) {
            try {
              payload = JSON.parse(content);
            } catch {
              payload = {};
            }
          }
          const llm = sanitizeResult(payload as PointeryResult, context, opts.allowActions);
          const override: PointeryResult | null = opts.guard?.(query, llm) ?? null;
          const final = override ?? llm;
          // LLM miss too: return the (empty) local result, guarded.
          if (final.spot || final.go || final.action || final.guide || final.plan || final.answer) {
            llmCache.set(key, { at: Date.now(), result: final });
            if (llmCache.size > LLM_CACHE_MAX) llmCache.delete(llmCache.keys().next().value!);
            return Response.json(final);
          }
        }
      } catch {
        // fall through to local miss below
      }
    }

    const override: PointeryResult | null = opts.guard?.(query, local) ?? null;
    return Response.json(override ?? local);
  };
}
