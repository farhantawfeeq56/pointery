import { promises as fs } from "fs";
import path from "path";
import { validateContext } from "pointery/validate";

const FILE = path.join(process.cwd(), "pointery.context.json");

export async function GET() {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const context = JSON.parse(raw);
    return Response.json({ context, errors: validateContext(context) });
  } catch (e) {
    return Response.json({ error: `Cannot read pointery.context.json: ${e}` }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  // No login on this route by design (local disk-truth Studio): refuse writes
  // in production unless explicitly enabled — otherwise anyone could overwrite the file.
  if (process.env.NODE_ENV === "production" && process.env.POINTERY_ADMIN !== "1" && process.env.POINTERY_ADMIN !== "true") {
    return Response.json({ error: "Refusing to write pointery.context.json in production. Set POINTERY_ADMIN=1 to enable." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const context = (body as { context?: unknown }).context ?? body;
  const errors = validateContext(context as never);
  if (errors.length > 0) return Response.json({ error: "Validation failed", errors }, { status: 400 });
  await fs.writeFile(FILE, JSON.stringify(context, null, 2) + "\n", "utf8");
  return Response.json({ ok: true, errors: [] });
}
