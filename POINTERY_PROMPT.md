# POINTERY_PROMPT.md — the map-maker (ships with `npx pointery init`, per stack)

Paste this into your coding agent (Cursor / Claude / Copilot). It scans your
app and fills `pointery.context.json` — the ship-time index of stable UI anchors
your LLM ranks on every ask (`/api/ask` sends the top-ranked slice as system
context in an OpenAI-compatible `{ model, messages }` call to your own model — the LLM is required, there is no
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
> 6. Brain (my key, my bill, required — one step): walk me through it — add `POINTERY_LLM_URL` (my model endpoint: OpenAI-compatible chat-completions URL, or native Anthropic `…/v1/messages` / Gemini `…:generateContent` — auto-detected), `POINTERY_LLM_KEY`, AND `POINTERY_LLM_MODEL` (exact model id as the provider spells it: `gpt-4o-mini`, `claude-3-5-haiku-latest`, `gemini-2-flash`, …) to `.env.local` together, restart dev, and
>    verify with “where is export?”. Without all three, `/api/ask` fails closed (503). OpenAI defaults the model to `gpt-4o-mini` when unset; every other provider needs it. Never print or commit the key.
> 7. Settings page (`/pointery`): `init` already dropped a starter
>    (Next: `app/pointery/page.tsx` + `app/api/admin/config/route.ts`;
>    other stacks: build the equivalent). It is read-only by design:
>    customization lives in the `<Pointery/>` props in code, so the page
>    shows system status (ask health, brain, context validity) and the
>    context table. It loads
>    `pointery.config.json` via GET only (PUT stays dev-only and refuses
>    in production — edit the file directly and redeploy). Personalize it
>    on first run from the files you just wrote:
>    status probe must use real queries from the
>    context (a flow title, an entry label — never the "export"
>    placeholder if the app has no export), and defaults (trigger, theme,
>    position, suggestions, allowActions) must mirror `pointery.config.json`.
>    Set `suggestions` to 3–5 real first-run questions for THIS app, built
>    from the entry labels and flow titles you just indexed (the palette
>    shows them as its default list) — never the "export" placeholder if
>    the app has no export. Tag its
>    sections with `data-pointery` ids and keep the matching
>    `pointery-settings-*` entries on page `/pointery` in sync; re-run step 5.
>
> Then show me the wiring diff: mount `<Pointery/>` once in `layout.tsx`
> (via a client wrapper that loads `pointery.config.json` and listens for
> `pointery:config`), gated off marketing pages (wrapper returns null on
> `/`, or mount only in the `(app)` group layout). Sync the palette to my
> brand at init: lift my primary color and corner radius from my theme /
> tokens into `pointery.config.json` and the `<Pointery/>` props (trigger,
> theme, position, suggestions), so it looks native on day one — everything
> stays user-configurable afterwards via props or the config file. Ensure
> `/api/ask` calls `createAskHandler(context, { llm: { url, key, model } })`
> (required — no keyless mode), and confirm `/pointery` shows status ok, done.

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
