# POINTERY_PROMPT.md — the map-maker (ships with `npx pointery init`, per stack)

Paste this into your coding agent (Cursor / Claude / Copilot). It scans your
app and fills `pointery.context.json` — the ship-time index of stable UI anchors
your LLM ranks on every ask (`/api/ask` forwards `{ query, candidates, page }`, the
top-ranked slice, to your own model — the LLM is required, there is no
keyless mode). Re-run whenever your UI changes.

---

**Prompt:**

> My app uses Pointery (in-app ask-anything: palette → /api/ask → pulse /
> navigate / guide / action). The file `pointery.context.json` is the context
> my LLM gets with every query — keep it accurate and small. Do this:
>
> 1. Scan `app/**` (routes, components). Find every user-facing control a user
>    might ask for: nav items, buttons, tables, search inputs. Index stable
>    anchors only — never per-record ids (no `deal-acme`), never live values
>    (no `$8,000`, counts, totals). For lists, index the container
>    (`pipeline-table`), not the rows; the client finds the row text at runtime.
>    Mark the container with rows:true so the model can answer instance queries
>    ("where is the Acme deal") with filter ("Acme") alongside that spot —
>    the client pulses the matching row, else the container.
> 2. Add a stable `data-pointery="kebab-id"` to each. Only real selectors that
>    exist in the rendered DOM — never invent ids. Keep ids stable across
>    refactors.
> 3. Update `pointery.context.json` to match — identity + purpose + place,
>    no sentences, no live values:
>    `{ version: 2, entries: [{ id, page, label, for, type, aliases?, rows? }],
>    flows: [{ id, title, steps: [entryId...], aliases? }],
>    actions: [{ name, label, confirm, at, aliases? }],
>    pins?: [{ match, aliases?, spot?, go?, action?, guide?, hint? }] }`
>    - `pins[]` = curated fast-path (optional): exact-phrase wins checked
>      before generic scoring, served locally with no LLM. Strict match only
>      (no word-overlap). Use for golden demo paths; the rest still
>      resolves generically.
>    - `label`: the element's own words ("Export"). `for`: stable purpose,
>      one clause ("Downloads the pipeline as CSV") — never an instruction.
>    - `aliases`: non-obvious synonyms only ("csv"). Matching derives from
>      label + for; never list phrasings ("where is export" doesn't belong here).
>    - `flows[].steps` = entry ids in walk order; wording is generated, not stored.
>    - `actions[].at` = the entry id it runs against.
>    - `confirm: true` for anything destructive (delete, charge, send, close).
>    - rows:true on containers whose children are runtime data (deal, contact,
>      chat rows). Only then may the model set filter alongside that spot —
>      the server drops it otherwise, and the keyword fallback never sets it.
> 4. Keep it small: max ~40 entries, ~10 flows, only allowlisted actions.
>    Delete stale ids for removed UI.
> 5. Run `npx pointery init --check` and fix whatever it reports (guide step
>    pointing at a missing target or wrong page, live `$` data baked into the map).
> 6. Brain (my key, my bill, required): walk me through it — add `POINTERY_LLM_URL` (my model
>    endpoint) and `POINTERY_LLM_KEY` to `.env.local`, restart dev, and
>    verify with “where is export?”. Without both, `/api/ask` fails closed (503). Never print or commit the key.
> 7. Settings page (`/pointery`): `init` already dropped a starter
>    (Next: `app/pointery/page.tsx` + `app/api/admin/config/route.ts`;
>    other stacks: build the equivalent). SaaS-style controls for shortcut
>    (trigger), brand (primary color + radius with live preview), and
>    behavior (position, suggestions, allowActions, palette copy). It loads
>    `pointery.config.json` via GET, auto-saves edits via PUT (debounced)
>    plus a Save button (PUT is dev-only and refuses in production — edit the
>    file directly and redeploy), applies theme vars live, and dispatches a
>    `pointery:config` CustomEvent with the new config so the mounted
>    `<Pointery/>` (whose client wrapper listens for it) updates without
>    reload. Personalize it on first run from the files you just wrote:
>    status probe and example suggestions must use real queries from the
>    context (a flow title, an entry label — never the "export"
>    placeholder if the app has no export), and defaults (trigger, theme,
>    position, allowActions) must mirror `pointery.config.json`. Tag its
>    controls with `data-pointery` ids and keep the matching
>    `pointery-settings-*` entries on page `/pointery` in sync; re-run step 5.
>
> Then show me the wiring diff: mount `<Pointery/>` once in `layout.tsx`
> (via a client wrapper that loads `pointery.config.json` and listens for
> `pointery:config`), gated off marketing pages (wrapper returns null on
> `/`, or mount only in the `(app)` group layout), ensure `/api/ask` calls
> `createAskHandler(context, { llm: { url, key } })` (required — no keyless mode), and confirm
> `/pointery` saves to disk, done.

**Rules for the agent:** no fake selectors, `confirm:true` on destructive,
re-run on UI change. This file is versioned per stack (Next / Vue / HTML) —
update it without re-publishing npm.

## AGENTS.md — the sync rule (`npx pointery init` appends this)

One block, delimited by `<!-- pointery:start -->` / `<!-- pointery:end -->`,
so every future agent run keeps the map fresh without being asked:

> `pointery.context.json` is the LLM context for in-app ask-anything.
> Whenever you add, move, rename, or remove a user-facing control, value, or
> route: update its `data-pointery` id in code AND its entry in
> `pointery.context.json`, then run `npx pointery init --check`.

`init` creates `AGENTS.md` if missing, appends the block if absent, skips if
present, and refreshes it only with `--force`. Your existing file is never
clobbered.
