import { NextResponse } from "next/server";
import { resolveQuery } from "@/lib/pointery/resolver";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query : "";
  // BYOK seam: if POINTERY_LLM_URL is set, forward { query, context } to the
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
  return NextResponse.json(resolveQuery(query));
}
