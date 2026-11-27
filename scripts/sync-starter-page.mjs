// Single source of truth: app/pointery/page.tsx is what `npx pointery init`
// ships. This script re-embeds it into packages/pointery/bin/pointery.js
// as STARTER_SETTINGS_PAGE (escaped for the template literal).
// Run after editing the page: npm run pointery:sync-page
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pageFile = path.join(root, "app", "pointery", "page.tsx");
const binFile = path.join(root, "packages", "pointery", "bin", "pointery.js");

const src = fs.readFileSync(pageFile, "utf8");
// Escape for embedding inside a JS template literal: backslash first.
const escaped = src.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const bin = fs.readFileSync(binFile, "utf8");
const startMarker = "const STARTER_SETTINGS_PAGE = `";
const start = bin.indexOf(startMarker);
if (start === -1) throw new Error("STARTER_SETTINGS_PAGE not found in bin");
// Terminator is backtick-semicolon alone on its line. (A plain "`;" search
// would match the nested `snippet` template literal's closing "`;" inside
// the page and corrupt the file with a duplicated tail.)
const endMatch = bin.slice(start + startMarker.length).match(/\n`;\s*\n/);
if (!endMatch || endMatch.index === undefined) throw new Error("STARTER_SETTINGS_PAGE terminator not found");
const end = start + startMarker.length + endMatch.index + 1;
const next = bin.slice(0, start + startMarker.length) + escaped + bin.slice(end);
fs.writeFileSync(binFile, next);
console.log(`synced ${pageFile} -> STARTER_SETTINGS_PAGE (${src.length} chars)`);
