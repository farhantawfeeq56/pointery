import { connection } from "next/server";

// Read-only LLM status for Studio. Env is truth: reports whether a key is
// set and which host it points at — the key itself never leaves the server.
export async function GET() {
  await connection(); // runtime env, not build-time prerender
  const url = process.env.POINTERY_LLM_URL ?? "";
  const configured = Boolean(url && process.env.POINTERY_LLM_KEY);
  let host = "";
  try {
    if (url) host = new URL(url).host;
  } catch {
    host = "";
  }
  return Response.json({ configured, host });
}
