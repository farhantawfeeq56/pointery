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

## Pass 13 (feat/studio-context, 2026-11-25)
Harness page is the shipped page — no fork.

- `app/pointery/page.tsx` is single source of truth. `scripts/sync-starter-page.mjs` (`npm run pointery:sync-page`) re-embeds it verbatim into `bin/pointery.js` as `STARTER_SETTINGS_PAGE`. Rule: edit the harness page, run sync, commit both.
- Verified: shipped `app/pointery/page.tsx` from fresh `init` is byte-identical to harness (ignoring CRLF); `node --check` clean.

## Pass 14 (feat/studio-context, 2026-11-25)
Security: unauthenticated admin PUT closed in production.

- `init` scaffolds `/api/admin/config` with no login — anyone could overwrite `pointery.config.json`. Fix: PUT refuses with 403 when `NODE_ENV=production` unless `POINTERY_ADMIN=1/true`. GET stays public (theme/trigger are client-visible by design). Applied to harness config + context PUTs and the scaffolded `STARTER_ADMIN_CONFIG_ROUTE` alike; step 7 documents the rule in both prompt copies.
- Verified: tsc clean, `node --check` clean, fresh `init` ships the guard.

## Next (not done)
Real LLM adapter wiring test, POINTERY_PROMPT per-stack versions, row editing of context tables in Studio.

## Pass 15 (feat/basic-changes, 2026-11-26)
Fixes 1–5: map holds stable UI anchors only, retriever sends candidates, admin writes dev-only.

- **Fix 1 — no live data in the map:** `pointery.context.json` drops `deal-acme` (+`$8,000` hint), `$20,400` answer, `answers[]` → `[]`. New stable `pipeline-table` anchor (`/demo/pipeline`); `pipeline-value` hint/counts generalized; `close-deal` guide steps point at `nav-pipeline`/`pipeline-table`; `mark-won` is generic "Mark deal as Won". Demo `pipeline/page.tsx` adds `data-pointery="pipeline-table"`, drops the per-row `deal-acme` conditional (won-state now keys off `DEALS[0].id`, not a UI id). Suggestions (`resolver.getSuggestions`, `pointery.config.json`, landing `TRIES`) say "Show me the pipeline table", not "pipeline worth" / Acme.
- **Fix 2 — resolver:** `retrieveCandidates()` ranks top-K (8/3/3) with same-page boost; `resolveQuery` takes `page`, "where…" goes target-first ("where is export?" now navigates instead of firing the action), target threshold `>=3` kills single-word noise, action anchoring scores targets instead of first-hint-contains-word. `Pointery.tsx` POSTs `{ query, page }`.
- **Fix 4 — LLM gets a slice:** `server.ts` forwards `{ query, candidates, page }` and sanitizes LLM output (unknown spot/action/guide dropped, `confirm` re-echoed from the map). New `PointeryCandidates`/`RetrieveOptions` types, exported from the barrel.
- **Fix 3 — coupling guardrails:** `validateContext()` (+ CLI `--check`) now also fails on live `$`-data in hints/answers, guide `go` ≠ target `page`, and dangling `answers[].spot`.
- **Fix 5 — admin lockdown:** both admin PUTs + scaffolded `STARTER_ADMIN_CONFIG_ROUTE` refuse in production unconditionally (no `POINTERY_ADMIN` bypass). Prompt step 7, `AGENTS.md`, package README updated to match.
## Pass 16 (feat/basic-changes, 2026-11-26)
Facts-only v2 map: entries/flows/actions, wording generated. (`version: 2` — breaking shape, pre-1.0.)

- **Map holds identity + purpose + place, nothing else:** `entries[]` = `{ id, page, label, for, type?, aliases?, rows? }` — no sentences, no keyword phrasing, no live values. `label` = the element's own words, `for` = one stable purpose clause ("Downloads the pipeline as CSV"). `flows[]` = `{ id, title, steps: [entryId] }` (+ optional verb-form `aliases`); `actions[]` = `{ name, label, confirm, at }`. Harness file migrated (19 entries incl. `pipeline-table` rows-table, 3 flows, 3 actions, `answers[]` gone).
- **Resolver reads v2:** matching derives from id-words + label + for + aliases; `buildGuide()` templates step text (`Click {label}` for buttons, `Go to {label}` else) so stored flows carry no prose; strong action matches (exact label) outrank guides ("mark deal as won" → action again); `norm` strips punctuation ("deal?" matches); candidates favor recall (`>0`) while direct resolve keeps precision (`>=3`).
- **Every consumer updated:** `server.ts` sanitize rebuilds guides from flows, `validate.ts` + CLI `--check` check entries/flows/actions (+ live-`$` + dangling `at`), Studio + settings counts, `STARTER_CONTEXT`/`--check`/`STARTER_PROMPT`/`AGENTS_BLOCK`, `POINTERY_PROMPT.md`, both READMEs, `AGENTS.md` shape + sync block + dropped stale `answers` gap note, landing "Map your app" line, settings page re-synced into CLI.
- Verified: `tsc`, `eslint`, `next build` clean; `init --check` ok; fresh-`init` starter is v2 and prompt identical to root; resolver spot-checks (export→entry, invite→generated guide, deals→pipeline-table, won→action, closing→guide, acme→{} local + table in candidates).

## Pass 17 (feat/basic-changes, 2026-11-26)
Runtime row search (fixes #14): `PointeryResult.filter?` for instance queries. Server keeps it only on `rows:true` spots (trimmed, ≤80 chars); fallback never sets it. `pulse(spot, filter)` pulses the matching row (`tr/li/[role=row]`, else children), container on miss, toasts first hit on multi-match (cells joined with `·`). Prompt + starter document the contract; demo suggests "Where is the Acme deal?". Verified live vs stub LLM; eslint, kit tsc, `next build`, `init --check` clean.

## Pass 18 (feat/basic-changes, 2026-11-26)
Actions blocked by default, fall through to spot/go/guide.

- `Pointery.tsx`: `DEFAULTS.allowActions` `["mark-won",…]` → `[]`; blocked action no longer returns early — toasts "needs approval — taking you there instead", strips `action`, continues to `go/spot/guide` handling. Also drops the CRM demo leak from kit defaults.
- `server.ts` + `types.ts`: new `AskHandlerOptions.allowActions`; `sanitizeResult` drops non-listed actions but keeps `spot/go/guide/hint` (verified: `[]` → `{spot,hint}`, allowed → full `{action,confirm,spot,hint}`); local path now also sanitized. Unset = back-compat (allows all) so harness demo keeps working; UI default `[]` is the block.
- Package README `allowActions` row updated. Lint clean (dist removed per repo rule), `kit:build` clean.

## Pass 19 (feat/basic-changes, 2026-11-26)
Hybrid brain: local first, LLM only where it wins.

- `server.ts` `createAskHandler` was LLM-first (every ask hit the model when configured). Now: resolve locally first; confident hit (`spot/go/action/guide`) returns at once with `guard` — fast, free, no key spend. Only on a local miss (empty) and non-blank query does it forward `{ query, candidates, page }` to `opts.llm`, sanitize + guard that too, and fall back to the local miss when the LLM misses/fails.
- Local covers `where/how/do` navigation, guides, allowlisted actions. LLM covers only what keywords can't: `answer`, `filter` row search on `rows:true`, paraphrase/fuzzy. `guard` now applies to both paths (was local-only, so an LLM `go:/demo…` could bypass the prod demo block).
- Package README brain row reworded to match. Verified: `kit:build` clean; stub-host check — local hit returns without touching LLM, nonsense query falls through to `{}` when host dead, guard overrides both paths.

## Pass 20 (feat/basic-changes, 2026-11-26)
Palette gated off the landing page.

- `app/pointery-mount.tsx`: `usePathname` + `HIDDEN = ["/"]` — returns null on marketing pages, mounts `<Pointery/>` everywhere else. Single mount preserved (no per-page mounts). Harness-only; package untouched so no release triggered.
- Verified: `npm run lint` clean.

## Pass 21 (feat/basic-changes, 2026-11-26)
Package fix: buyers now gate the palette off marketing pages.

- `POINTERY_PROMPT.md` + `packages/pointery/bin/pointery.js` (STARTER_PROMPT, kept in sync): wiring-diff step now says mount via client wrapper "gated off marketing pages (wrapper returns null on `/`, or mount only in the `(app)` group layout)". Harness `app/pointery-mount.tsx` (Pass 20) is the reference implementation.
- No component/API change — guidance only, so no new props or bundle impact. Note: touches `packages/pointery`, so merging this to main will trigger a release build; hold the PR until release is wanted.
- Verified: `node --check` on CLI, `npm run lint` clean.

## Pass 22 (feat/basic-changes, 2026-11-26)
Standing rule: package-first.

- `AGENTS.md` "Rules for that code" now leads with: buyer-facing changes go in `packages/pointery`, never only in the harness (`app/` is the demo, nothing there ships). Harness updated to match, not vice versa; `app/`-only changes must be called out as demo-specific. (This rule itself lives in the harness repo's AGENTS.md, not the npm package — correctly, since it's a contributor rule.)

## Pass 24 (feat/basic-changes, 2026-11-26)
Settings union: A∪B in /pointery, /admin/ask deleted.

- `app/pointery/page.tsx` now carries everything the Studio had: status pill + context-validity pill + error list + LLM hint (`pointery-settings-status`), read-only entries/flows/actions table (`pointery-settings-context`), snippet + copy (`pointery-settings-snippet`). Kept its own shortcut cards, live brand preview, auto-save + Save now, labels.
- Prod guard lives in the page itself (`notFound()` when `NODE_ENV === "production"`) so it ships to buyers via `pointery:sync-page` — re-synced into `STARTER_SETTINGS_PAGE`.
- `app/admin/` route deleted (it was only the page). Landing + demo-settings links now point at `/pointery` ("Settings" copy). README + AGENTS.md route mentions updated.
- `pointery.context.json`: 5 `studio-*` entries replaced with `pointery-settings-status/context/snippet`. Same 3 added to `STARTER_CONTEXT` in `bin/pointery.js` (hand-kept in sync — no sync script for it).
- Verified: `init --check` ok, `tsc` clean (after `next typegen` to drop stale `/admin/ask` route types), `npm run build` clean (`/pointery` prerenders as not-found in prod), lint unchanged (only pre-existing `dist/` noise).

## Pass 25 (feat/basic-changes, 2026-11-26)
Pins: curated keyword fast-path (Tier 0), generic scoring unchanged.

- `packages/pointery/src/types.ts` — new `PointeryPin { match, aliases?, spot?, go?, action?, guide?, hint? }`; `PointeryContext.pins?` (optional, so existing maps stay valid).
- `resolver.ts` — new `matchPin()`: strict exact-or-substring match (term `>=4` chars, no word-overlap fallback), best-longest-term wins; guide pins rebuild steps via `buildGuide()`, action pins echo `confirm` from the map. `resolveQuery()` checks pins before generic scoring; a pin hit returns instantly and skips the LLM in `server.ts` (same as any local hit). No pin match → generic path exactly as before (entry `>=3`, action/guide `>=12`).
- `validate.ts` + CLI `--check` slim copy — pins validated (missing `match`, no target, dangling `spot/action/guide/go`); stale pin fails the check (verified).
- `POINTERY_PROMPT.md` + embedded `STARTER_PROMPT` — shape line gains `pins?[]` + fast-path bullet; verified the prompt body matches the root (only pre-existing tail difference remains). Package README map row mentions `pins?`.
- Harness `pointery.context.json` — 2 demo pins (`where is export` → `export-button`, `how do I invite` → `invite-teammate` flow).
- Verified: `kit:build` clean, `validate` clean, pin exact/alias/guide resolve, generic queries and misses unchanged, `createAskHandler` serves pins with no LLM, fresh `init` ok, `npm run lint` clean (dist removed first).
- Deliberately not done: weak-hit LLM rerank (Tier 1) — pins-only was asked for; generic keeps its current bar. Next publish carries this (minor).

## Pass 26 (feat/basic-changes, 2026-11-27)
LLM compulsory: fail closed without key instead of guessing from keywords.

- `packages/pointery/src/server.ts` — `createAskHandler` returns 503 + "LLM not configured…" when `opts.llm.url` or `key` is missing (matches `/api/admin/llm`'s `configured = url && key`); configured path unchanged (local-first, LLM on miss). JSDoc + example updated to the required `{ llm: { url, key } }` form.
- Harness `app/api/ask/route.ts` always passes both env vars; `app/pointery/page.tsx` pill goes red ("LLM required — missing key") with a fail-closed hint.
- `POINTERY_PROMPT.md` + embedded `STARTER_PROMPT` + `SNIPPET`: step 6 and wiring diff now say required (no keyless mode).
- `scripts/sync-starter-page.mjs` — terminator search fixed to backtick-semicolon alone on its line; the old plain `` `; `` match hit the page's nested `snippet` template literal and left a duplicated tail in `bin/pointery.js` (repaired by deleting the orphan).
- Verified: no-key and url-without-key → 503; configured exact query → 200 local hit without fetch; `kit:build`, `tsc`, `npm run lint`, `npm run build` clean; sync re-run is idempotent.

## Pass 27 (feat/basic-changes, 2026-11-27)
Custom keyboard shortcut on /pointery: presets + recorder, generic trigger match.

- `packages/pointery/src/Pointery.tsx` — hardcoded shift+a check replaced with generic `parseTrigger`/`triggerMatches` ("+"-joined combo, ctrl/cmd treated as same primary mod cross-platform; single-char triggers like "?" ignore shift). Cmd/Ctrl+K stays hardwired as secondary. Fab title + palette hint now show the actual trigger via `prettyTrigger`.
- `packages/pointery/src/types.ts` — `trigger` comment updated to custom-combo form.
- `app/pointery/page.tsx` — shortcut section keeps Shift+A / ⌘-Ctrl+K as recommended presets, adds "Record your own…" (captures next full combo, Esc cancels, bare modifiers ignored) + current-shortcut kbd with a "custom" badge.
- Synced installer copy via `npm run pointery:sync-page`; verified `kit:build`, `lint`, `build` clean. Committed locally (4 files).
- Noted: `pointery.config.json` first suggestion keeps getting re-corrupted with helper text appended (bad textarea state from an open /pointery tab auto-saving?) — fixed the string twice, left radius/position alone, file uncommitted.
- Deliberately not done: context-table changes (left for last, as asked).

## Pass 28 (feat/basic-changes, 2026-11-27)
One brain setup step: URL + key + model together, single OpenAI-compatible wire.

- `packages/pointery/src/server.ts` — LLM forward is now OpenAI-compatible `{ model, messages }` (candidates slice as system context, strict JSON instruction); `model` passes through verbatim so OpenAI/OpenRouter/Ollama/any compatible URL works with no per-provider code. `gpt-4o-mini` default on api.openai.com, otherwise 503 names all three vars. Legacy custom-endpoint JSON responses still parse; cache key includes model.
- `src/types.ts` — `PointeryLLMAdapter` gains `model?`; JSDoc + example updated.
- Harness `app/api/ask/route.ts` passes `POINTERY_LLM_MODEL`; `app/api/admin/llm/route.ts` reports `{ configured, host, model }` (key never leaves server); `/pointery` pill shows `host / model` and prints the 3-line `.env.local` block when unconfigured.
- `POINTERY_PROMPT.md` step 6 + wiring diff, package README brain row, CLI `SNIPPET`/`STARTER_PROMPT`: URL + key + model in one step. Installer settings page re-synced via `npm run pointery:sync-page` (canonical source: `app/pointery/page.tsx`).
- Docs wording updated to the new wire (`AGENTS.md` pointery block + CLI `AGENTS_BLOCK`, `POINTERY_PARTS.md`); `context.md` history left untouched.
- Verified: mocked 503 on missing model, OpenAI-shape + legacy-shape parses → 200; `node --check` bin, `kit:build`, `lint`, `build` clean.
- Deliberately not done: native Anthropic/Gemini translators, live `/models` picker, CLI init wizard prompts.

## Pass 29 (feat/basic-changes, 2026-11-27)
Native Anthropic + Gemini translators, auto-detected from the URL host.

- `packages/pointery/src/server.ts` — `providerFor(url)`: `anthropic.com` → Messages wire (`x-api-key` + `anthropic-version`, `max_tokens`, top-level `system`, `content[].text` parse); `googleapis.com` → generateContent wire (`x-goog-api-key`, `system_instruction` + `generationConfig`, `candidates[0].content.parts[].text` parse); everything else keeps the OpenAI-compatible wire. Same prompt + same `sanitizeResult` on all three; shared `parseJsonText` also strips ``` fences.
- `src/types.ts` — adapter doc lists the three wires + example native model ids.
- Buyer docs (package README brain row, `POINTERY_PROMPT.md` step 6 + CLI mirror): native `…/v1/messages` / `…:generateContent` URLs work with the same 3 env vars.
- Verified: mocked Anthropic/Gemini/OpenAI requests carry the right headers + bodies and parse to 200s; `node --check` bin, `kit:build`, `lint`, `build` clean.
- Deliberately not done: per-provider model defaults beyond OpenAI (copy the id from the dashboard), live `/models` picker.

## Pass 30 (feat/basic-changes, 2026-11-27)
/pointery preview: mock browser with closed/open palette states, live-bound to config.

- `app/pointery/page.tsx` — new Preview section (first section, above shortcut/brand/behavior): faux browser (sidebar + pipeline rows) with `?` fab; closed state hides the palette, open state shows it positioned per `cfg.position` with `theme.primary/radius`, `labels.placeholder`, top-3 `suggestions`, and the trigger hint. All values read `cfg` directly so edits render instantly.
- `pointery.context.json` + `STARTER_CONTEXT` — new `pointery-settings-preview` entry on `/pointery`; re-synced via `npm run pointery:sync-page`; `init --check` ok.
- Verified: preview moved above per ask; `init --check` clean. Lint/build not re-run (eslint timed out last attempt).
- Deliberately not done: toast/guide/confirm preview states, keyboard 1/2 switching.

## Pass 31 (feat/basic-changes, 2026-11-27)
/pointery two-column layout: controls left, preview right (sticky).

- `app/pointery/page.tsx` — container widened to `max-w-6xl`; Shortcut/Brand/Behavior + save row wrapped in a left column, preview section on the right (`lg:grid-cols-[minmax(0,1fr)_400px]`, `lg:sticky lg:top-6`). Preview stays first in DOM so it shows up top on mobile. Removed the small duplicate "Live preview" box from Brand (the full panel covers it).
- Re-synced via `npm run pointery:sync-page`; `init --check`, `tsc`, `lint`, `next build` all clean.
- Noted again: a running dev server + open /pointery tab re-dirties `pointery.config.json` `position` via auto-save — reverted, not committed.
- Deliberately not done: toast/guide/confirm preview states.

## Pass 32 (feat/basic-changes, 2026-11-27)
/pointery controls merged into one panel (page feedback: remove box-per-setting look).

- `app/pointery/page.tsx` — left column is now a single `rounded-2xl border bg-white divide-y` panel; Shortcut/Brand/Behavior are plain padded sections separated by dividers, save row included. Preview, context table, and snippet blocks untouched (preview mock needs its frame; snippet is a code block).
- Re-synced via `npm run pointery:sync-page`; `init --check`, `tsc`, `lint`, `next build` clean.
- Not committed: `pointery.config.json` keeps changing in the working tree (looks like live testing of the controls) — left dirty deliberately.

## Pass 33 (feat/basic-changes, 2026-11-27)
/pointery fully flattened (page feedback: no boxes).

- `app/pointery/page.tsx` — zero `rounded-2xl` cards left: controls are full-bleed sections split by `divide-zinc-200` hairlines, preview lost its card (mock keeps its own single hairline frame), context table sits under a top hairline, snippet + env sample are light bordered code blocks instead of dark boxes, LLM warning is a red left-rule with no fill. Borders remain only where functional (inputs, buttons, mock frame, code).
- Re-synced via `npm run pointery:sync-page`; `init --check`, `tsc`, `lint`, `next build` clean.

## Pass 34 (feat/basic-changes, 2026-11-27)
/pointery error-state vartest toolbar (temporary, local only).

- `app/pointery/page.tsx` — floating bottom-right toolbar with checkboxes (Save fail [1], Ask down [2], LLM missing [3]) + ctx 0/1/3 segmented [4] + reset [0]; keys ignored while typing. Forces the four failure states (save badge, ask pill, LLM pill + brain block, context pill + error list) with realistic sample `validateContext` messages.
- Deliberately NOT re-synced into `STARTER_SETTINGS_PAGE` — remove the toolbar before the next `pointery:sync-page` so it never ships to buyers.
- Verified: `tsc` clean. `pointery.config.json` left dirty (live testing).

## Pass 35 (feat/basic-changes, 2026-11-27)
Vartest toolbar removed; ctx `+N more` collapse kept.

- `app/pointery/page.tsx` — back to live values everywhere (save/ask/LLM/context); only kept change is the error list shows first 3 + `+N more` line.
- Not yet re-synced into `STARTER_SETTINGS_PAGE` — run `npm run pointery:sync-page` when ready to ship the collapse to buyers.
- Verified: `tsc` clean, no vartest references left. `pointery.config.json` still dirty (live testing).

## Pass 36 (feat/basic-changes, 2026-11-27)
/pointery error/preview division vartest (temporary, local only).

- `app/pointery/page.tsx` — floating bottom-right 1-5 toolbar + 1-5 keys (ignored while typing): 1 baseline, 2 labeled hairline rule, 3 status card, 4 numbered sections w/ top border, 5 pills + Show/Hide issues fold. Single-copy wrapper, no content duplication.
- Deliberately NOT re-synced into `STARTER_SETTINGS_PAGE` — remove toolbar before sync so it never ships.
- Verified: `tsc` clean. `pointery.config.json` left dirty (live testing).

## Pass 37 (feat/basic-changes, 2026-11-27)
Variant 4 applied: /pointery error/preview division permanent.

- `app/pointery/page.tsx` — vartest toolbar + variant/showIssues state + key handler removed; section stays split with `01 — System status` eyebrow over pills/brain/errors and a hairline + `02 — Customize and preview` eyebrow before the grid.
- Re-synced via `npm run pointery:sync-page`; `init --check` ok, `tsc` clean, lint shows only pre-existing `dist/` noise.
- `pointery.config.json` left dirty (live testing).

## Pass 38 (feat/basic-changes, 2026-11-28)
Stripped section headings in /pointery customize zone.

- `app/pointery/page.tsx` — removed the Keyboard shortcut / Brand / Behavior / Preview h2s + gray sub descriptions; field labels (Primary color, Corner radius, Palette position, etc.) carry the meaning now. Preview tabs right-aligned in the freed header row.
- Re-synced via `npm run pointery:sync-page`; `init --check` ok, `tsc` clean.

## Pass 39 (feat/basic-changes, 2026-11-28)
Removed section dividers in /pointery customize zone.

- `app/pointery/page.tsx` — dropped `divide-y divide-zinc-200` from the controls column; sections now separated by padding alone.
- Re-synced via `npm run pointery:sync-page`; `init --check` ok, `tsc` clean.

## Pass 40 (feat/basic-changes, 2026-11-28)
Arranged /pointery customize zone: uniform rhythm + paired fields.

- `app/pointery/page.tsx` — dropped orphan `mt-3` on each group's first row (leftover heading gaps); Palette position + Allowed actions now sit side-by-side (`sm:grid-cols-2`), Suggestions full-width below, label inputs keep their 3-col row.
- Re-synced via `npm run pointery:sync-page`; `init --check` ok, `tsc` clean.

## Pass 41 (feat/basic-changes, 2026-11-28)
Shortcut section rework per page feedback: live card + pencil + chips.

- `app/pointery/page.tsx` — preset cards + Record button + Current line replaced by: current-shortcut card (label + mono value) with pencil icon button to start/stop recording; Shift+A and Cmd/Ctrl+K moved below as "Suggestions:" chips (active chip filled); custom badge kept. Recorder shows live progress (`Shift + …`) incl. bare-modifier presses, Esc cancels, hint line switches to "Press keys… (Esc to cancel)" while recording.
- Re-synced via `npm run pointery:sync-page`; `init --check` ok, `tsc` clean.

## Pass 42 (feat/basic-changes, 2026-11-28)
Tightened shortcut-box padding per page feedback.

- `app/pointery/page.tsx` — current-shortcut card `px-4 py-3` → `px-3 py-2`, pencil `p-2` → `p-1.5`, suggestion chips `px-3 py-1` → `px-2.5 py-0.5`.
- Re-synced via `npm run pointery:sync-page`; `init --check` ok, `tsc` clean.

## Pass 43 (feat/basic-changes, 2026-11-28)
Behavior section rework per page feedback (4 items).

- `app/pointery/page.tsx` — position select shortened to `w-40`; Allowed actions editor removed; Suggestions textarea replaced by boxes (3 by default, pad-to-3 when empty, + adds up to 4, − per stored row); Placeholder/Empty/Confirm grid removed. Live preview now filters blank suggestions so half-typed boxes never render empty chips.
- Re-synced via `npm run pointery:sync-page`; `init --check` ok, `tsc` clean.

## Pass 44 (feat/basic-changes, 2026-11-28)
Padding tightening per page feedback (2 items).

- `app/pointery/page.tsx` — position select `w-40` → `w-fit` (hugs biggest option); sections + save row `py-8` → `py-6`; inputs/select `px-3 py-2` → `px-2.5 py-1.5`; color swatch `h-10 w-14` → `h-8 w-12`; shortcut card `px-3 py-2` → `px-2.5 py-1.5 gap-2`; + button and save button slimmed. Preview mock untouched.
- Re-synced via `npm run pointery:sync-page`; `init --check` ok, `tsc` clean.

## Pass 45 (feat/basic-changes, 2026-11-28)
Narrowed boxes per page feedback.

- `app/pointery/page.tsx` — suggestion boxes into 2-col grid (half-width each), + button on its own row; shortcut card capped at `max-w-md`.
- Re-synced via `npm run pointery:sync-page`; `init --check` ok, `tsc` clean.

## Pass 46 (feat/basic-changes, 2026-11-28)
Shortcut card hugs content per page feedback.

- `app/pointery/page.tsx` — current-shortcut card `max-w-md` → `w-fit min-w-60` (fits "Shift + A", stable width while recording), gap widened for breathing room.
- Re-synced via `npm run pointery:sync-page`; `init --check` ok, `tsc` clean.

## Pass 47 (feat/basic-changes, 2026-11-28)
Fixed stuck label/control pairs per page feedback.

- `app/pointery/page.tsx` — the `w-fit` position select fit on the same line as its inline label title; title is now `mb-2 block` so the dropdown sits on its own line with an 8px gap (select's own `mt-2` removed to avoid doubling). Audited the rest: every other title is already followed by a block-level control, so no other stickers.
- Re-synced via `npm run pointery:sync-page`; `init --check` ok, `tsc` clean.
