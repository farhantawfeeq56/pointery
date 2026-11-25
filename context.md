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

## Pass 4 (same branch, 2026-11-25)
Package v0.1.0 starting point — publishable shape, zero new deps (tsc only).

- `src/server.ts` — `createAskHandler(context, { llm, guard })`: 3-line `/api/ask` for consumers, BYOK forward + local fallback. Route uses it via `pointery/server` subpath (keeps React/Next out of the server bundle).
- `src/validate.ts` — `validateContext()` (missing fields, dup keys, stale guide spots). CLI `--check` uses a slim copy.
- `bin/pointery.js` (ESM) — `init` drops starter context+config, never overwrites without `--force`.
- `Pointery.tsx` — generic now: `endpoint` prop (default `/api/ask`), `confirm` echoed from matched action (non-confirm actions run at once), default `onAction` = log + `pointery:action` event + toast. Demo CSV/mark-won/invite side-effects moved out (demo pages already consume the event).
- Harness: `app/pointery-mount.tsx` (client wrapper for server layout), `route.ts` down to `createAskHandler` + demo guard.
- `package.json` — real publish fields: `dist` main/types, subpath exports, `files`, MIT, `bin`, `engines`, keywords; `type: module` + `.js`-suffixed imports so Node ESM resolves (caught via plain-node check).
- `README.md`, `LICENSE`, package `tsconfig.json`. `dist/` gitignored — rebuild with `npm run kit:build`.
- Verified: `tsc` clean, eslint clean, `next build` clean, CLI init/check/fail-check, resolver+handler via plain node.

## Pass 5 (same branch, 2026-11-25)
Published `pointery@0.1.0` to npm (public, `latest` tag). Name claimed under farhantawfeeq56 (a `0.0.0-stage` stub existed first; 0.1.0 landed over it).

- Fixed `bin` path to `bin/pointery.js` (npm auto-corrects `./`-prefixed bin targets with a warning — published 0.1.0 already carries the corrected form).
- Verified the real registry tarball: `npm pack pointery@0.1.0` → CLI `init --check` ok; `validate`/`resolveQuery`/`createAskHandler` correct via subpath imports (`pointery/server`, `pointery/resolver`, `pointery/validate` — the barrel needs Next for `next/navigation`, by design).
- Harness stays on the workspace symlink for iteration (do not switch to registry dep until the API stabilizes).

## Pass 6 (same branch, 2026-11-25)
`npx pointery init` is now the whole starter: package + prompt + sync rule.

- `bin/pointery.js` — `init` drops four things: `pointery.context.json` (the LLM context `/api/ask` forwards as `{ query, context }`), `pointery.config.json`, `POINTERY_PROMPT.md` (map-maker prompt, embedded as `STARTER_PROMPT` so no extra publish file needed), and a delimited `<!-- pointery:start/end -->` sync block in `AGENTS.md`. Idempotent: creates/appends/skips, refreshes only with `--force`; pre-existing `AGENTS.md` content is never clobbered (verified: fresh init, re-init skip, append, --force refresh, `--check` fail exit 1 on stale spot).
- `POINTERY_PROMPT.md` (root) — rewritten around the context-file story: the prompt tells the agent `pointery.context.json` is what the LLM reads every ask, adds `answers[]` to the schema, adds step 5 (`npx pointery init --check`), and documents the AGENTS.md sync rule. Ends at the 10-line wiring diff.
- Package `README.md` — install section now describes the four dropped files.
- Naming note: canonical file is `pointery.context.json` (dot — already published, sent as `context` in server.ts). `pointery-context.json` (dash) means the same thing when it comes up in discussion.
- Not published yet: this changes the last published `0.1.0` CLI behavior, so next publish should bump (minor) — not done here.
- Known lint state: `npm run lint` reports 10 pre-existing errors in `dist/Pointery.js` (react-hooks/refs in compiled output); identical with these changes stashed, so unrelated.

## Next (done below)
Real LLM adapter wiring test, POINTERY_PROMPT per-stack versions.

## Pass 7 (feat/studio-context, 2026-11-25)
Single Studio page, disk is truth — branch renamed from `feat/pointery-demo`.

- `app/api/admin/config` + `app/api/admin/context` — GET reads the file from disk, PUT writes it back. Context PUT is gated by `validateContext` (400 + errors on stale spots); config PUT requires a JSON object.
- `app/admin/ask/page.tsx` — rewritten as the one page: status (`/api/ask` probe + `validateContext` errors + target/guide/answer/action counts), appearance (primary, radius, trigger, position, suggestions list, allowActions list, live CSS-var preview), Save-to-disk button, read-only content table from disk, snippet. Initial state loads from the admin API, not localStorage.
- `app/pointery-mount.tsx` — loads `pointery.config.json` via the admin API and passes it to `<Pointery/>`, so visitors get the saved theme/trigger/position. Falls back to kit defaults offline.
- `pointery.context.json` — 15 targets now (10 demo + 5 studio: status/appearance/content/save/snippet on `/admin/ask`). `validateContext` clean, `tsc` clean, `next build` clean.
- Row editing of targets/guides/answers/actions in the page is next (content is read-only this pass).

## Pass 8 (feat/studio-context, 2026-11-25)
API key = env file, agent teaches the steps. No key UI, no key storage.

- `POINTERY_PROMPT.md` + embedded `STARTER_PROMPT` in `bin/pointery.js` — new step 6 (Brain): agent walks the owner through `POINTERY_LLM_URL` + `POINTERY_LLM_KEY` in `.env.local`, restart, verify with “where is export?”, never prints/commits the key.
- `app/api/admin/llm` — read-only GET: `{ configured, host }` from env only (`force-dynamic` so it reflects runtime env). Key never leaves the server.
- Studio status card — new “LLM → host ✓ / keyword resolver (no key)” pill + hint pointing at prompt step 6 when unset.
- `tsc` clean, `next build` clean.

## Pass 9 (feat/studio-context, 2026-11-25)
`/pointery` SaaS settings — disk is truth, palette follows live.

- `app/pointery/page.tsx` — new settings page: Shortcut (Shift+A / Cmd+K cards), Brand (color + radius + live preview), Behavior (position, suggestions, allowActions, labels copy), status pills (ask/LLM/counts), auto-save (~700ms debounce PUT to `/api/admin/config`) + Save now. Every edit applies CSS vars and dispatches `pointery:config` so the mounted palette updates without reload.
- `app/pointery-mount.tsx` — listens for `pointery:config` and swaps cfg live (initial load still from disk via GET).
- `packages/pointery/src/Pointery.tsx` — trigger is now dynamic: Cmd/Ctrl+K always, Shift+A only when `trigger !== "cmd+k"` (was both-always). Effect deps `[open, cfg.trigger]`.
- `pointery.context.json` — 19 targets (15 + 4 `pointery-settings-*` on `/pointery`: shortcut/brand/behavior/save). Page carries matching `data-pointery` ids.
- `validateContext` clean, kit `tsc` clean.

## Pass 10 (feat/studio-context, 2026-11-25)
Prompt-only `/pointery` rollout (option 1) — no package code change.

- `POINTERY_PROMPT.md` + embedded `STARTER_PROMPT` in `bin/pointery.js` — new step 7: agent scaffolds a SaaS-style `/pointery` settings page (shortcut/brand/behavior), loading `pointery.config.json` via GET, auto-saving via PUT (debounced) + Save button, applying theme vars live, dispatching `pointery:config` for reload-free palette updates; tags controls with `data-pointery` ids + matching `pointery-settings-*` targets on `/pointery`; re-runs `--check`. Closing wiring diff now mentions the client wrapper + disk-save confirm. Verified: `node --check` clean, fresh `init` in temp dir ships step 7, generated prompt IDENTICAL to root.
- Not published: next publish carries the new CLI prompt behavior (minor bump).

## Pass 11 (feat/studio-context, 2026-11-25)
`init` scaffolds the settings page (option 2, done in-harness).

- `bin/pointery.js` — `init` now drops `app/pointery/page.tsx` (shortcut/brand/behavior, auto-save PUT debounced + Save, theme vars live, `pointery:config` dispatch) + `app/api/admin/config/route.ts` (GET/PUT disk truth), but only when `app/` exists (Next); otherwise skips with a pointer to prompt step 7. `write()` creates parent dirs. `STARTER_CONTEXT` gains the 4 `pointery-settings-*` targets so the starter map matches the starter page.
- Step 7 reworded in both `POINTERY_PROMPT.md` and `STARTER_PROMPT`: init already dropped the starter — agent verifies/adapts, keeps `pointery-settings-*` targets in sync, re-runs `--check`.
- Verified: `node --check` clean; Next-like tmp dir gets 6 files with working dispatch/route; bare tmp dir skips page; generated prompt IDENTICAL to root; starter context 5 targets.
- Not published: next minor bump carries new init + prompt behavior.

## Pass 12 (feat/studio-context, 2026-11-25)
Personalize-the-starter-page rule in step 7 (both prompt copies).

- Step 7 now orders first-run personalization: status probe + example suggestions use real queries from the context (guide title / answer keyword, never the "export" placeholder when the app has none); defaults (trigger, theme, position, allowActions) mirror `pointery.config.json`; `data-pointery` ids + `pointery-settings-*` targets stay in sync; re-run `--check`. (Brand colors need no code change — the page GET-loads config and applies theme vars live.)
- Verified: `node --check` clean, fresh Next-like `init` ships the rule, generated prompt matches root ignoring CRLF.

## Next (not done)
Real LLM adapter wiring test, POINTERY_PROMPT per-stack versions, row editing of context tables in Studio.
