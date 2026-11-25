import { promises as fs } from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "pointery.config.json");

export async function GET() {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return Response.json({ config: JSON.parse(raw) });
  } catch (e) {
    return Response.json({ error: `Cannot read pointery.config.json: ${e}` }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  // No login on this route by design (local disk-truth Studio): refuse writes
  // in production unless explicitly enabled — otherwise anyone could overwrite the file.
  if (process.env.NODE_ENV === "production" && process.env.POINTERY_ADMIN !== "1" && process.env.POINTERY_ADMIN !== "true") {
    return Response.json({ error: "Refusing to write pointery.config.json in production. Set POINTERY_ADMIN=1 to enable." }, { status: 403 });
  }
  let config: unknown;
  try {
    const body = await req.json();
    config = (body as { config?: unknown }).config ?? body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return Response.json({ error: "Config must be a JSON object" }, { status: 400 });
  }
  await fs.writeFile(FILE, JSON.stringify(config, null, 2) + "\n", "utf8");
  return Response.json({ ok: true });
}
