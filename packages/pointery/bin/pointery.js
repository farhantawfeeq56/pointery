#!/usr/bin/env node
// `npx pointery init` — drop starter files into the consumer's app.
// Zero dependencies. Never overwrites without --force.
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const cmd = args[0];
const force = args.includes("--force");
const check = args.includes("--check");
const cwd = process.cwd();

const STARTER_CONTEXT = {
  version: 1,
  targets: [
    {
      key: "export-button",
      page: "/dashboard",
      hint: "Export — downloads the report as CSV",
      keywords: ["export", "csv", "download", "where is export"],
    },
  ],
  guides: [
    {
      id: "export-report",
      title: "Export your report",
      keywords: ["export", "csv", "download", "report"],
      steps: [
        { text: "Open the Dashboard", go: "/dashboard", spot: "export-button" },
        { text: "Click “Export” (top right)", go: "/dashboard", spot: "export-button" },
      ],
    },
  ],
  answers: [],
  actions: [
    { name: "export-report", label: "Export report CSV", confirm: false, keywords: ["export", "download csv"] },
  ],
};

const STARTER_CONFIG = {
  trigger: "shift+a",
  theme: { primary: "#6d28d9", radius: 14 },
  position: "top",
  suggestions: ["Where is export?"],
  allowActions: ["export-report"],
};

const SNIPPET = `import { Pointery } from "pointery";
import "pointery/styles.css";

// once in your root layout, next to {children}:
<Pointery />
// API route (app/api/ask/route.ts):
// import { createAskHandler } from "pointery";
// import context from "@/pointery.context.json";
// export const POST = createAskHandler(context);`;

function write(name, data) {
  const p = path.join(cwd, name);
  if (fs.existsSync(p) && !force) {
    console.log(`skip  ${name} (exists — use --force to overwrite)`);
    return;
  }
  fs.writeFileSync(p, typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n");
  console.log(`wrote ${name}`);
}

if (cmd === "init") {
  write("pointery.context.json", STARTER_CONTEXT);
  write("pointery.config.json", STARTER_CONFIG);
  console.log("\nNext: paste POINTERY_PROMPT.md into your coding agent to map your UI,");
  console.log("then mount <Pointery/> once in layout.tsx:\n\n" + SNIPPET);

  if (check) {
    const ctx = JSON.parse(fs.readFileSync(path.join(cwd, "pointery.context.json"), "utf8"));
    const problems = [];
    const keys = new Set((ctx.targets || []).map((t) => t.key));
    (ctx.guides || []).forEach((g, i) =>
      (g.steps || []).forEach((s) => {
        if (s.spot && !keys.has(s.spot)) problems.push(`guides[${i}]: spot "${s.spot}" matches no target`);
      })
    );
    console.log(problems.length ? "\ncheck failed:\n- " + problems.join("\n- ") : "\ncheck ok");
    process.exit(problems.length ? 1 : 0);
  }
} else {
  console.log("Usage: npx pointery init [--force] [--check]");
  process.exit(cmd ? 1 : 0);
}
