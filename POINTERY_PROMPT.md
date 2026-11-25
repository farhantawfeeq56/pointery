# POINTERY_PROMPT.md — the map-maker (ships on purchase, per stack)

Paste this into your coding agent (Cursor / Claude / Copilot). It scans your
app and produces `pointery.context.json`. Re-run whenever your UI changes.

---

**Prompt:**

> My app uses Pointery (in-app ask-anything: palette → resolver → pulse /
> navigate / guide / action). Do this:
>
> 1. Scan `app/**` (routes, components). Find every user-facing control or
>    value a user might ask for: nav items, buttons, key numbers, tables,
>    search inputs.
> 2. Add a stable `data-pointery="kebab-id"` to each. Only real selectors that
>    exist in the rendered DOM — never invent ids. Keep ids stable across
>    refactors.
> 3. Output `pointery.context.json`:
>    `{ targets: [{ key, page, hint, keywords[] }], guides: [{ id, title,
>    keywords[], steps: [{ text, go, spot }] }], actions: [{ name, label,
>    confirm, keywords[] }] }`
>    - `hint`: one line a user would understand ("Export — downloads CSV").
>    - `keywords`: every phrasing a user might type ("export", "csv",
>      "download report", "where is export").
>    - `confirm: true` for anything destructive (delete, charge, send, close).
>    - `steps[].go` = route, `steps[].spot` = an id from step 2 on that route.
> 4. Keep it small: max ~40 targets, ~10 guides, only allowlisted actions.
>    Delete stale keys for removed UI.
>
> Then show me the 10-line wiring diff: mount `<Pointery/>` once in
> `layout.tsx`, ensure `/api/ask` calls `resolveQuery` (or my LLM with the
> context), done.

**Rules for the agent:** no fake selectors, `confirm:true` on destructive,
re-run on UI change. This file is versioned per stack (Next / Vue / HTML) —
update it without re-publishing npm.
