import { createAskHandler } from "pointery/server";
import type { PointeryContext } from "pointery";
import rawContext from "@/pointery.context.json";
import rawConfig from "@/pointery.config.json";
import { isDemoEnabled } from "@/lib/demo";

const context = rawContext as PointeryContext;
const brain = (rawConfig as { brain?: { retrieve?: { entries?: number; flows?: number; actions?: number }; limits?: { queryMax?: number; planMax?: number }; cache?: { ttlMs?: number; max?: number }; llm?: { temperature?: number; maxTokens?: number } } }).brain ?? {};

// TEMP test hooks: type 1-7 in the palette to preview each feedback.
// 1 spot, 2 go, 3 answer, 4 guide, 5 plan, 6 action(confirm), 7 filter(row). Delete before merge.
const TEST_HOOKS: Record<string, unknown> = {
  "1": { spot: "nav-pipeline", hint: "1 - spot: pulsing Pipeline nav" },
  "2": { go: "/demo/contacts", spot: "invite-button", hint: "2 - go: navigated to Contacts" },
  "3": {
    answer: "3 - answer: open pipeline is $20,400",
    spot: "pipeline-value",
    go: "/demo",
    hint: "Open pipeline",
  },
  "4": {
    guide: {
      id: "invite-teammate",
      title: "Invite a teammate",
      steps: [
        { text: "Go to Contacts", go: "/demo/contacts", spot: "nav-contacts" },
        { text: "Click Invite teammate", go: "/demo/contacts", spot: "invite-button" },
      ],
    },
    spot: "nav-contacts",
    go: "/demo/contacts",
    hint: "4 - guide: Invite a teammate",
  },
  "5": {
    plan: {
      title: "Your steps",
      steps: [
        { text: "Go to Pipeline", go: "/demo/pipeline", spot: "nav-pipeline" },
        { text: "Click Export", go: "/demo/pipeline", spot: "export-button" },
      ],
    },
    spot: "nav-pipeline",
    go: "/demo/pipeline",
    hint: "5 - plan: Pipeline + Export",
  },
  "6": {
    action: "mark-won",
    confirm: true,
    spot: "pipeline-table",
    go: "/demo/pipeline",
    filter: "Acme",
    hint: "Mark deal as Won",
    actionLabel: "Mark deal as Won",
    actionTarget: "Pipeline table",
  },
  "7": {
    spot: "pipeline-table",
    go: "/demo/pipeline",
    filter: "Acme",
    hint: "7 - filter: Acme row in Pipeline table",
  },
};

const basePOST = createAskHandler(context, {
  llm: {
    url: process.env.POINTERY_LLM_URL ?? "",
    key: process.env.POINTERY_LLM_KEY ?? "",
    model: process.env.POINTERY_LLM_MODEL ?? "",
    temperature: brain.llm?.temperature,
    maxTokens: brain.llm?.maxTokens,
  },
  retrieve: brain.retrieve,
  limits: brain.limits,
  cache: brain.cache,
  guard: (_query, local) =>
    // Never navigate into the demo CRM when it's disabled (production).
    !isDemoEnabled() && (local.go?.startsWith("/demo") || local.guide)
      ? { answer: "The demo CRM is disabled in this environment. Set POINTERY_DEMO=1 to explore it." }
      : null,
});

// BYOK seam (required): POINTERY_LLM_URL + POINTERY_LLM_KEY forward
// { query, candidates, page } (top-ranked slice, never the whole file)
// to the customer's own model endpoint (their key, their cost).
// Nothing goes to Pointery. Missing env fails closed with a 503.
// Tuning (retrieve/limits/cache/temperature) lives in pointery.config.json `brain`.
export async function POST(req: Request): Promise<Response> {
  const body = await req.clone().json().catch(() => ({} as Record<string, unknown>));
  const q = typeof body.query === "string" ? body.query.trim() : "";
  const hook = TEST_HOOKS[q];
  if (hook) return Response.json(hook);
  return basePOST(req);
}
