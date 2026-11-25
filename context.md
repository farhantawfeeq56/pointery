# Pointery — context

## What this is
Pointery = drop-in in-app ask-anything kit. Demo CRM proves it. No paywall yet.

## Pass 1 (feat/pointery-demo, 2026-11-25)
Built the whole loop: type → `/api/ask` → `{spot,go,action}` → pulse/navigate/execute.

- `components/Pointery.tsx` — engine: Shift+A + Cmd/K palette, toast, `pulse()`, guide walk (Next/Back), action confirm, CSS-var theme, props per README.
- `lib/pointery/resolver.ts` — keyword resolver + answer ("pipeline is $20,400"). `/api/ask` uses it; `POINTERY_LLM_URL` env forwards to customer's own LLM (BYOK seam).
- `pointery.context.json` — 10 targets, 3 guides (invite/export/close-deal), 3 actions (mark-won confirm, invite confirm, export).
- `app/demo/*` — CRM: dashboard, pipeline (Export CSV, mark-won via event+localStorage), contacts (invite, search), settings. All controls carry `data-pointery`.
- `app/page.tsx` — product landing (3 parts, 10-line snippet, try-phrases). `app/admin/ask` — Studio (color/radius/trigger/position/toggles → snippet copy, localStorage).
- `pointery.config.json`, `POINTERY_PROMPT.md` (map-maker prompt), theme CSS in `globals.css`.
- Build + lint clean. No new deps.

## Try
`npm run dev` → open `/`, press Shift+A → "where is export?" / "how do I invite a teammate?" / "what is my pipeline worth?" / "walk me through closing a deal".

## Pass 2 (same branch, 2026-11-25)
Demo CRM is dev-only now — production must not show it.

- `lib/demo.ts` — `isDemoEnabled()`: on when `POINTERY_DEMO=1/true` or any non-production env (`next dev` just works); off in production builds unless forced on.
- `app/demo/layout.tsx` — calls `notFound()` when disabled, so `/demo*` 404s in prod (verified: 404 on `next start`, 200 on `next dev`).
- `app/page.tsx` — landing renders demo links/CTAs only when enabled; prod shows Studio CTA + "How it works ↓" instead.
- `app/api/ask` — refuses demo navigation in prod (returns "demo disabled" answer instead of `go:/demo…`); verified via curl both envs.
- Known limit: demo route code still ships in the bundle (only served as 404). True exclusion = separate app; not done (see Next).

## Pass 3 (same branch, 2026-11-25)
Extracted the `pointery` package — no more publishing during design iteration.

- `packages/pointery/` — the product. `name: "pointery"` (not -kit), `src/Pointery.tsx`, `src/resolver.ts`, `src/types.ts`, `src/index.ts`, `src/styles.css`. No `@/` imports inside; context comes in as a `resolveQuery(query, context)` argument per README.
- `PointeryContext.answers[]` added — the "$20,400" answer moved out of kit code into `pointery.context.json`. Kit ships zero demo data.
- Root renamed `pointery-harness` (private) with `workspaces: ["packages/*"]`; app consumes `pointery` via symlink + `transpilePackages`. Edit kit source → dev hot-reloads, no build/publish (verified live on :3000).
- Kept ONE Next app as the harness (did not split apps/site+apps/demo): two servers can't navigate to each other, which would break the landing→demo funnel. Prod still 404s `/demo*` and hides demo links (re-verified). True repo-split later = `git subtree split`, ~10 min.
- Publish path (not done): kit needs a real build (tsup/tsc) replacing `main: ./src/index.ts` before npm publish.

## Next (not done)
Real LLM adapter wiring test, `npx pointery init` CLI, POINTERY_PROMPT per-stack versions, private-npm packaging, studio writing `pointery.config.json` to disk (currently localStorage + copy).
