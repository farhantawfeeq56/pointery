import { connection } from "next/server";

// Read-only LLM status for Studio. Env is truth: reports whether a key is
// set and which host it points at — the key itself never leaves the server.
// Smart default so OpenAI works with zero model config; every other
// provider passes its model id through verbatim (never validated here).
function defaultModelFor(url: string): string {
  try {
    const host = new URL(url).host;
    if (host.includes("openai.com")) return "gpt-4o-mini";
  } catch {
    /* relative or empty url — no default */
  }
  return "";
}

export async function GET() {
  await connection(); // runtime env, not build-time prerender
  const url = process.env.POINTERY_LLM_URL ?? "";
  const model = process.env.POINTERY_LLM_MODEL ?? "";
  const configured = Boolean(url && process.env.POINTERY_LLM_KEY && (model || defaultModelFor(url)));
  let host = "";
  try {
    if (url) host = new URL(url).host;
  } catch {
    host = "";
  }
  return Response.json({ configured, host, model: model || defaultModelFor(url) });
}
