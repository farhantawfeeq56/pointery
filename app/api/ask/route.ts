import { createAskHandler } from "pointery/server";
import type { PointeryContext } from "pointery";
import rawContext from "@/pointery.context.json";
import rawConfig from "@/pointery.config.json";
import { isDemoEnabled } from "@/lib/demo";

const context = rawContext as PointeryContext;
const brain = (rawConfig as { brain?: { retrieve?: { entries?: number; flows?: number; actions?: number }; limits?: { queryMax?: number; planMax?: number }; cache?: { ttlMs?: number; max?: number }; llm?: { temperature?: number; maxTokens?: number } } }).brain ?? {};

// BYOK seam (required): POINTERY_LLM_URL + POINTERY_LLM_KEY forward
// { query, candidates, page } (top-ranked slice, never the whole file)
// to the customer's own model endpoint (their key, their cost).
// Nothing goes to Pointery. Missing env fails closed with a 503.
// Tuning (retrieve/limits/cache/temperature) lives in pointery.config.json `brain`.
// TEMP-EMPTY-DEMO (delete before merge): type 1-19 in the palette to preview
// each package empty/error state. Raw bypass of the real handler (incl. server sanitize).
async function tempEmptyDemo(q: string): Promise<Response | null> {
  if (process.env.NODE_ENV === "production") return null;
  if (!/^(1[0-9]|[1-9])$/.test(q)) return null;
  switch (q) {
    case "3":
      // Non-JSON body: client r.json() throws -> unreachable toast.
      return new Response("temp hook 3: not JSON", { status: 500, headers: { "content-type": "text/plain" } });
    case "4":
      // Real action, but NOT in config allowActions (temp ["mark-won"]) -> blocked toast + navigate.
      return Response.json({ action: "invite-teammate", actionLabel: "Invite teammate", actionTarget: "Contacts", confirm: true, spot: "invite-button", go: "/demo/contacts" });
    case "5":
      await new Promise((r) => setTimeout(r, 1500));
      return Response.json({ spot: "nav-pipeline", go: "/demo/pipeline", hint: "Pipeline" });
    case "6":
      return Response.json({ spot: "pipeline-table", go: "/demo/pipeline", filter: "e" });
    case "7":
      // Impossible anchor: fires the real missing path on ANY page, no navigating.
      return Response.json({ spot: "temp-never-exists-xyz" });
    case "8":
      return Response.json({ guide: { id: "temp-broken", title: "Broken guide", steps: [] } });
    case "9":
      return Response.json({ action: "mark-won", actionLabel: "Mark deal Acme as Won", actionTarget: "Pipeline table", confirm: true, spot: "pipeline-table", go: "/demo/pipeline" });
    case "11":
      return Response.json({ spot: "temp-nope-not-real" });
    case "12":
      return Response.json({ plan: { title: "Half plan", steps: [{ text: "Go to Dashboard", go: "/demo", spot: "nav-dashboard" }] }, spot: "nav-dashboard", go: "/demo", hint: "Half plan" });
    case "13":
      return Response.json({ answer: "Empty-slice demo: a blank query sends { entries: [], flows: [], actions: [] } to the LLM - no UI of its own.", spot: "nav-dashboard", go: "/demo" });
    case "15":
      return Response.json({ error: "LLM_NOT_CONFIGURED", answer: "Something's wrong on our end - setup isn't finished. Report error code LLM_NOT_CONFIGURED to the site owner." }, { status: 503 });
    case "16":
      return Response.json({ error: "LLM_UNAUTHORIZED", answer: "Something's wrong on our end - the helper was refused. Report error code LLM_UNAUTHORIZED to the site owner." });
    case "17":
      return Response.json({ error: "LLM_RATE_LIMITED", answer: "The helper is busy - try again in a bit. Error code: LLM_RATE_LIMITED." });
    case "18":
      return Response.json({ error: "LLM_UPSTREAM_ERROR", answer: "Something's wrong on our end - the helper failed. Report error code LLM_UPSTREAM_ERROR to the site owner." });
    case "19":
      // Slow upstream: client gives up at timing.askMs (30s) with ASK_TIMEOUT; this late reply is ignored.
      await new Promise((r) => setTimeout(r, 35000));
      return Response.json({ spot: "nav-pipeline", go: "/demo/pipeline", hint: "Pipeline" });
    default:
      // 1, 2, 10, 14 -> {} collapses to the empty toast.
      return Response.json({});
  }
}

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

// TEMP-EMPTY-DEMO wrapper (delete before merge): reads the body once,
// serves 1-15 hooks, else rebuilds the request for the real handler.
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text().catch(() => "");
  let q = "";
  try {
    const b = JSON.parse(raw || "{}") as { query?: unknown };
    if (typeof b.query === "string") q = b.query.trim();
  } catch { /* fall through to real handler */ }
  const temp = await tempEmptyDemo(q);
  if (temp) return temp;
  return basePOST(new Request(req.url, { method: req.method, headers: req.headers, body: raw }));
}
