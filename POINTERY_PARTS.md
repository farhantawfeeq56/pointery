# Pointery - 10 parts of the app (package, not the demo)

Verified against `packages/pointery/src/*` + `bin/pointery.js` on 2026-11-26.
Use as the checklist for every iteration: "which parts move together?"

## Runtime (shipped library code - iterate here)

### 1. `<Pointery/>` UI - `src/Pointery.tsx` + `src/styles.css`
Palette, toast, guide Next/Back, confirm dialog, FAB. Props only: `trigger, theme,
position, suggestions, allowActions, labels, endpoint (/api/ask), onAction`.
Theme via `--pointery-primary/--radius`. Needs Next (`"use client"` + `useRouter`);
import CSS separately via `pointery/styles.css`.

To preview, visit the following pages:
 - http://localhost:3000/demo/pipeline
 - http://localhost:3000/pointery
 - http://localhost:3000/admin/ask

### 2. `pulse(key, filter?)` - same file, standalone export
Finds `[data-pointery="..."]`, row-searches `tr/li/[role=row]` on `rows:true` +
`filter`, `scrollIntoView(center)` + 2.6s outline, fires `pointery:ambiguous`
on multi-hit.

### 5. Brain - `src/resolver.ts`
`resolveQuery` (local keyword match, same-page boost, `MIN_ENTRY_SCORE=3`),
`retrieveCandidates` (top 8/3/3 slice for LLM, never whole file),
`buildGuide` (templated `Click/Go to {label}` wording),
`getSuggestions()`.

### 6. Server - `src/server.ts`
`createAskHandler(context, { llm:{url,key?}, allowActions, retrieve, guard })`
→ `POST /api/ask`. Local-first, LLM-fallback on miss. `sanitizeResult` drops
non-allowlisted actions, unknown spots/pages, non-`rows` filters, orphan
answers/hints; rebuilds guide from flow id.

 1. Decide who answers - notebook (part 5) or phone-the-expert (LLM).
 2. Tell the expert the relevant context - it asks part 5 for the shortlist (top 8/3/3) and hands it as system
    context in an OpenAI-compatible `{ model, messages }` call. The LLM never sees the whole map, only what part 6 gives it.
 3. Clean the reply for the next person (part 1, the UI).

### 7. Contract - `src/types.ts` + `src/validate.ts`
`PointeryResult { spot, go, action, filter, confirm, answer, guide, hint }`,
`validateContext` for `init --check` (missing fields, duplicates, dangling
`steps`/`at`, live `$` data).

## Distribution (how buyers receive it - update when runtime changes)

### 8. CLI - `bin/pointery.js`
`init` writes `pointery.context.json` + `pointery.config.json` +
`POINTERY_PROMPT.md` (+ upserts `AGENTS.md` block).
`--check` validates map. No deps, node fs/path only.

### 9. Prompt - `POINTERY_PROMPT.md`
Map-maker instructions for customer's agent. Ships with CLI, **not** in `dist/`
(`files: [dist, src/styles.css, bin, README, LICENSE]`).

## Instance (buyer-owned copies - do NOT iterate, they own them)

### 3. Map - `pointery.context.json` (customer-owned, ship-time)
`{ entries[{id,page,label,for,type,aliases,rows}], flows[{id,title,steps,aliases}],
actions[{name,label,confirm,at,aliases}] }`. Stable anchors only, ~40 entries / ~10 flows max.

### 4. Config - `pointery.config.json` (customer-owned)
How palette looks/behaves: `trigger, theme, position, suggestions, allowActions`.
Context = where things are; config = how palette behaves.

### 10. Scaffolded glue (not in `dist/`, lives in buyer's repo)
3-line `/api/ask` route snippet, `data-pointery="kebab-id"` anchors in DOM.
(`/pointery` status page is harness-only debug - never scaffolded.)

## Iteration rules
- Behavior change order: **7 (contract) → 5 + 6 → 1 + 2**, then **8 + 9**
  (starters/prompt teach the change), then sync harness demo copies.
- I own **syntax + rules + starters** (`types.ts`, `validate.ts`, sanitize,
  `STARTER_*`, prompt). Buyer owns **content** (their rows). Prefer optional
  fields - required fields break existing maps on `--check`.
- In this repo, root `pointery.context.json` / `pointery.config.json` /
  `app/pointery/*` are **demo copies only**; editing them ships nothing.
