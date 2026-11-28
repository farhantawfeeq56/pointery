import { buildGuide, resolveCombo, resolveQuery, retrieveCandidates, splitClauses } from "./resolver.js";
import type { AskHandlerOptions, PointeryContext, PointeryPlan, PointeryResult } from "./types.js";

/** Drop plan steps that point outside the map; rebuild wording from labels. Needs >=2 valid steps. */
function sanitizePlan(raw: unknown, context: PointeryContext, planMax = 4): PointeryPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const steps = (raw as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) return null;
  const byId = new Map((context.entries ?? []).map((e) => [e.id, e]));
  const title = typeof (raw as { title?: unknown }).title === "string"
    ? ((raw as { title: string }).title.trim().slice(0, 80) || "Your steps")
    : "Your steps";
  // shortcut: plan steps are navigation-only; step actions collapse to "take me there".
  const out = steps.slice(0, planMax).flatMap((s) => {
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

/** Drop LLM fields that point outside the shipped map (LLM text is untrusted). Guide steps are rebuilt from the flow - the model picks anchors, never wording. */
function sanitizeResult(r: PointeryResult, context: PointeryContext, allowed?: string[], planMax = 4): PointeryResult {
  const out: PointeryResult = {};
  const ids = new Set((context.entries ?? []).map((e) => e.id));
  const byId = new Map((context.entries ?? []).map((e) => [e.id, e]));
  const pages = new Set((context.entries ?? []).map((e) => e.page));
  const actionNames = new Set((context.actions ?? []).map((a) => a.name));
  const flows = new Map((context.flows ?? []).map((f) => [f.id, f]));
  const confirmOf = (name: string) => (context.actions ?? []).find((a) => a.name === name)?.confirm;
  // Blocked actions are dropped but spot/go/guide survive - the UI routes there instead.
  // The human label rides along either way so toasts and the confirm dialog name the action, not its id.
  const knownAction = (context.actions ?? []).find((a) => a.name === r.action);
  if (r.action && actionNames.has(r.action)) {
    out.actionLabel = knownAction?.label ?? r.action;
    // Target: explicit spot wins, else the action's `at` anchor. The row filter stays in `filter` (rows:true only) - the UI names it inside the action sentence.
    const anchor =
      (r.spot && ids.has(r.spot) ? byId.get(r.spot) : undefined) ??
      (knownAction?.at ? byId.get(knownAction.at) : undefined);
    if (anchor) out.actionTarget = anchor.label;
    if (!allowed || allowed.includes(r.action)) {
      out.action = r.action;
      out.confirm = confirmOf(r.action);
    }
  }
  if (r.guide && flows.has(r.guide.id)) out.guide = buildGuide(flows.get(r.guide.id)!, context.entries ?? []);
  const plan = sanitizePlan((r as { plan?: unknown }).plan, context, planMax);
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
    // Row search text survives only on rows:true containers - never per-record ids.
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
 * to save cost - confident hits return at once - but misses need the model:
 * candidates (top-ranked slice, never the whole file) go as system context
 * in one LLM call to the customer's own endpoint (their key, their cost -
 * nothing comes to us). OpenAI-compatible is the default wire; native
 * Anthropic/Gemini endpoints are auto-detected from the URL host.
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
    /* relative or empty url - no default */
  }
  return "";
}

type LLMProvider = "openai" | "anthropic" | "gemini";

/** Native translators live here: Anthropic Messages + Gemini generateContent are
 *  detected from the URL host - same `{ url, key, model }` shape, no extra config.
 *  Everything else speaks the OpenAI-compatible wire (OpenAI, OpenRouter, Ollama…). */
function providerFor(url: string): LLMProvider {
  try {
    const host = new URL(url).host;
    if (host.includes("anthropic.com")) return "anthropic";
    if (host.includes("googleapis.com")) return "gemini";
  } catch {
    /* relative or empty url - default wire */
  }
  return "openai";
}

// shortcut: models sometimes wrap JSON in ``` fences despite the format flag.
function parseJsonText(text: unknown): unknown {
  if (typeof text !== "string" || !text.trim()) return {};
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(clean);
  } catch {
    return {};
  }
}
// Tiny LLM-response cache: normalized query + page + allowActions + model, 5 min TTL, max 200. Repeats cost 0 tokens.
const llmCache = new Map<string, { at: number; result: PointeryResult }>();
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;
const DEFAULT_CACHE_MAX = 200;
const cacheKey = (q: string, page: string | undefined, allowed?: string[], model?: string, temperature?: number) =>
  `${q.trim().toLowerCase().slice(0, 200)}|${page ?? ""}|${(allowed ?? []).join(",")}|${model ?? ""}|${temperature ?? 0}`;

export function createAskHandler(context: PointeryContext, opts: AskHandlerOptions = {}) {
  return async function POST(req: Request): Promise<Response> {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const query = typeof body.query === "string" ? body.query : "";
    const page = typeof body.page === "string" ? body.page : undefined;
    const queryMax = opts.limits?.queryMax ?? 200;
    const planMax = opts.limits?.planMax ?? 4;
    const cacheTtl = opts.cache?.ttlMs ?? DEFAULT_CACHE_TTL;
    const cacheMax = opts.cache?.max ?? DEFAULT_CACHE_MAX;
    const temperature = opts.llm?.temperature ?? 0;
    const maxTokens = opts.llm?.maxTokens ?? 300;
    // Cap what we forward - long pastes cost tokens without helping retrieval.
    const q = query.trim().slice(0, queryMax);

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
    const combo = sanitizeResult(resolveCombo(q, context, page, planMax) ?? {}, context, opts.allowActions, planMax);
    if (combo.plan) {
      const override: PointeryResult | null = opts.guard?.(query, combo) ?? null;
      return Response.json(override ?? combo);
    }
    const local = sanitizeResult(resolveQuery(q, context, page), context, opts.allowActions, planMax);
    // Confident local hit: skip the LLM entirely (fast, free) - unless the
    // query looks like a combo whose other half the single hit would hide.
    const looksCombo = splitClauses(q).length > 1;
    if ((local.spot || local.go || local.action || local.guide) && !looksCombo) {
      const override: PointeryResult | null = opts.guard?.(query, local) ?? null;
      return Response.json(override ?? local);
    }

    if (opts.llm?.url && q) {
      const key = cacheKey(q, page, opts.allowActions, llmModel, temperature);
      const hit = llmCache.get(key);
      if (cacheTtl > 0 && hit && Date.now() - hit.at < cacheTtl) {
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
        // Same prompt on every wire: candidates as system context, JSON-only reply.
        // OpenAI-compatible is the default; native Anthropic/Gemini bodies are
        // built from the URL host, so hundreds of models work with no extra config.
        const provider = providerFor(opts.llm.url);
        const systemPrompt = `You route in-app help. Candidates (JSON): ${JSON.stringify(candidates)}. Reply with JSON only: { "spot"?, "go"?, "action"?, "filter"?, "answer"?, "hint"?, "guide"?: { "id" }, "plan"?: { "title", "steps": [{ "spot", "go"? }] } }. spot must be an entry id, go an entry page, action a candidate action name, guide.id a candidate flow id. filter only alongside a rows:true spot, max 80 chars.`;
        const userPrompt = `${q}${page ? ` (current page: ${page})` : ""}`;
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (provider === "anthropic") {
          headers["x-api-key"] = opts.llm.key;
          headers["anthropic-version"] = "2023-06-01";
        } else if (provider === "gemini") {
          headers["x-goog-api-key"] = opts.llm.key;
        } else if (opts.llm.key) {
          headers.authorization = `Bearer ${opts.llm.key}`;
        }
        // shortcut: Anthropic needs max_tokens; Bearer auth would 401 there, key header above.
        const llmBody: unknown =
          provider === "anthropic"
            ? { model: llmModel, max_tokens: maxTokens, temperature, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }
            : provider === "gemini"
              ? { system_instruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: "user", parts: [{ text: userPrompt }] }], generationConfig: { temperature, maxOutputTokens: maxTokens } }
              : {
                model: llmModel,
                temperature,
                max_tokens: maxTokens,
                response_format: { type: "json_object" },
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt },
                ],
              };
        const r = await fetch(opts.llm.url, {
          method: "POST",
          headers,
          body: JSON.stringify(llmBody),
        });
        if (r.ok) {
          const data = await r.json();
          // Native shapes: Anthropic `content[].text`, Gemini `candidates[0].content.parts[].text`.
          // Default wire: OpenAI `choices[0].message.content` (JSON string).
          // Old wire (custom `{ query, candidates }` endpoints): raw result JSON.
          let payload: unknown = data;
          if (provider === "anthropic") {
            const blocks = (data as { content?: { text?: unknown }[] })?.content;
            payload = parseJsonText(Array.isArray(blocks) ? blocks.find((b) => typeof b?.text === "string")?.text : undefined);
          } else if (provider === "gemini") {
            const parts = (data as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] })?.candidates?.[0]?.content?.parts;
            payload = parseJsonText(Array.isArray(parts) ? parts.find((p) => typeof p?.text === "string")?.text : undefined);
          } else {
            const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
            if (typeof content === "string" && content.trim()) payload = parseJsonText(content);
          }
          const llm = sanitizeResult(payload as PointeryResult, context, opts.allowActions, planMax);
          const override: PointeryResult | null = opts.guard?.(query, llm) ?? null;
          const final = override ?? llm;
          // LLM miss too: return the (empty) local result, guarded.
          if (final.spot || final.go || final.action || final.guide || final.plan || final.answer) {
            if (cacheTtl > 0) {
              llmCache.set(key, { at: Date.now(), result: final });
              if (llmCache.size > cacheMax) llmCache.delete(llmCache.keys().next().value!);
            }
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
