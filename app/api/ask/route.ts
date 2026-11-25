import { NextResponse } from "next/server";
import { resolveQuery, type PointeryContext } from "pointery";
import rawContext from "@/pointery.context.json";
import { isDemoEnabled } from "@/lib/demo";

const context = rawContext as PointeryContext;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query : "";
  // BYOK seam: if POINTERY_LLM_URL is set, forward { query } to the
  // customer's own model endpoint. Otherwise use the bundled keyword resolver.
  // No data ever goes to Pointery — the key and the call are theirs.
  const url = process.env.POINTERY_LLM_URL;
  if (url) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.POINTERY_LLM_KEY ?? ""}` },
        body: JSON.stringify({ query }),
      });
      if (r.ok) return NextResponse.json(await r.json());
    } catch { /* fall through to local resolver */ }
  }
  const result = resolveQuery(query, context);
  // Never navigate into the demo CRM when it's disabled (production).
  if (!isDemoEnabled() && (result.go?.startsWith("/demo") || result.guide)) {
    return NextResponse.json({
      answer: "The demo CRM is disabled in this environment. Set POINTERY_DEMO=1 to explore it.",
    });
  }
  return NextResponse.json(result);
}
