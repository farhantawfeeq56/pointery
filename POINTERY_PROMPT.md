# POINTERY_PROMPT.md — the map-maker (ships with `npx pointery init`, per stack)

Paste this into your coding agent (Cursor / Claude / Copilot). It scans your
app and fills `pointery.context.json` — the context file your LLM reads on
every ask (`/api/ask` forwards `{ query, context }` to your own model, or
the bundled keyword resolver when no LLM is set). Re-run whenever your UI changes.

---

**Prompt:**

> My app uses Pointery (in-app ask-anything: palette → /api/ask → pulse /
> navigate / guide / action). The file `pointery.context.json` is the context
> my LLM gets with every query — keep it accurate and small. Do this:
>
> 1. Scan `app/**` (routes, components). Find every user-facing control or
>    value a user might ask for: nav items, buttons, key numbers, tables,
>    search inputs.
> 2. Add a stable `data-pointery="kebab-id"` to each. Only real selectors that
>    exist in the rendered DOM — never invent ids. Keep ids stable across
>    refactors.
> 3. Update `pointery.context.json` to match:
>    `{ targets: [{ key, page, hint, keywords[] }], guides: [{ id, title,
>    keywords[], steps: [{ text, go, spot }] }], answers: [{ keywords[],
>    answer, spot?, go? }], actions: [{ name, label, confirm, keywords[] }] }`
>    - `hint`: one line a user would understand ("Export — downloads CSV").
>    - `keywords`: every phrasing a user might type ("export", "csv",
>      "download report", "where is export").
>    - `confirm: true` for anything destructive (delete, charge, send, close).
>    - `steps[].go` = route, `steps[].spot` = an id from step 2 on that route.
> 4. Keep it small: max ~40 targets, ~10 guides, only allowlisted actions.
>    Delete stale keys for removed UI.
> 5. Run `npx pointery init --check` and fix whatever it reports (guide step
>    pointing at a missing target).
> 6. Brain (my key, my bill): if I want the LLM instead of the keyword
>    resolver, walk me through it — add `POINTERY_LLM_URL` (my model
>    endpoint) and `POINTERY_LLM_KEY` to `.env.local`, restart dev, and
>    verify with “where is export?”. Never print or commit the key.
> 7. Settings page (`/pointery`): `init` already dropped a starter
>    (Next: `app/pointery/page.tsx` + `app/api/admin/config/route.ts`;
>    other stacks: build the equivalent). SaaS-style controls for shortcut
>    (trigger), brand (primary color + radius with live preview), and
>    behavior (position, suggestions, allowActions, palette copy). It loads
>    `pointery.config.json` via GET, auto-saves edits via PUT (debounced)
>    plus a Save button, applies theme vars live, and dispatches a
>    `pointery:config` CustomEvent with the new config so the mounted
>    `<Pointery/>` (whose client wrapper listens for it) updates without
>    reload. Tag its controls with `data-pointery` ids and keep the matching
>    `pointery-settings-*` targets on page `/pointery` in sync; re-run step 5.
>
> Then show me the wiring diff: mount `<Pointery/>` once in `layout.tsx`
> (via a client wrapper that loads `pointery.config.json` and listens for
> `pointery:config`), ensure `/api/ask` calls `createAskHandler(context)`
> (or my LLM with the context), and confirm `/pointery` saves to disk, done.

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
