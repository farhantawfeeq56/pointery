import { createAskHandler } from "pointery/server";
import type { PointeryContext } from "pointery";
import rawContext from "@/pointery.context.json";
import { isDemoEnabled } from "@/lib/demo";

const context = rawContext as PointeryContext;

// BYOK seam (required): POINTERY_LLM_URL + POINTERY_LLM_KEY forward
// { query, candidates, page } (top-ranked slice, never the whole file)
// to the customer's own model endpoint (their key, their cost).
// Nothing goes to Pointery. Missing env fails closed with a 503.
export const POST = createAskHandler(context, {
  llm: {
    url: process.env.POINTERY_LLM_URL ?? "",
    key: process.env.POINTERY_LLM_KEY ?? "",
    model: process.env.POINTERY_LLM_MODEL ?? "",
  },
  guard: (_query, local) =>
    // Never navigate into the demo CRM when it's disabled (production).
    !isDemoEnabled() && (local.go?.startsWith("/demo") || local.guide)
      ? { answer: "The demo CRM is disabled in this environment. Set POINTERY_DEMO=1 to explore it." }
      : null,
});
