import { createAskHandler } from "pointery/server";
import type { PointeryContext } from "pointery";
import rawContext from "@/pointery.context.json";
import { isDemoEnabled } from "@/lib/demo";

const context = rawContext as PointeryContext;

// BYOK seam: POINTERY_LLM_URL forwards { query, candidates, page } (top-ranked
// slice of the map, never the whole file) to the customer's own model endpoint
// (their key, their cost). Nothing goes to Pointery.
export const POST = createAskHandler(context, {
  llm: process.env.POINTERY_LLM_URL
    ? { url: process.env.POINTERY_LLM_URL, key: process.env.POINTERY_LLM_KEY }
    : undefined,
  guard: (_query, local) =>
    // Never navigate into the demo CRM when it's disabled (production).
    !isDemoEnabled() && (local.go?.startsWith("/demo") || local.guide)
      ? { answer: "The demo CRM is disabled in this environment. Set POINTERY_DEMO=1 to explore it." }
      : null,
});
