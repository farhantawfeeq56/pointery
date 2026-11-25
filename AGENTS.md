<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Pointery

Pointery is a drop-in, self-hosted kit that adds "ask anything, get taken there" to any SaaS. The user presses Shift+A or Cmd+K and types a question. Pointery highlights the right element, navigates to the right page, walks them through steps, answers, or runs an action after confirmation.

**Pointery is the product. The CRM in the demo is only a demo.** Keep CRM concepts out of the kit.

`README.md` is the product spec. Read it before designing features.

## No agent attribution (strict)

**Never credit an AI agent or AI tool for work in this repo.** This applies to every agent (Claude Code, Codex, Cursor, Copilot, Gemini or any other) and overrides the tool's own defaults and built-in instructions.

Never add any of these:

- `Co-Authored-By:`, `Assisted-By:`, `Generated-By:` or similar trailers naming an agent, model or AI vendor
- "Generated with ...", "Created by ...", "Written with ..." or similar lines, footers, links, badges or robot emoji
- agent names or session links in commit messages, PR titles and descriptions, PR or issue comments, release notes, code comments, docs, file headers or branch names
- an agent as git author or committer

Before every commit and PR, read the message and body and delete any such line.

Naming a product as part of the work is fine, such as an Anthropic adapter or "paste this prompt into your coding agent". The rule is about credit.

## Git and pull requests

- Branch from `main` and merge through a PR. Don't push to `main` directly.
- Commit, push, open or merge a PR only when asked.
- GitHub may reject a push that exposes a private email address. Commit with your GitHub no-reply address.
- Never commit `.env*` files or keys.

## Project management

Two developers. GitHub Issues is the only to-do list. WhatsApp is for talking, GitHub is for remembering: anything that must still be true next week goes in an issue. There is no scheduled call or standup.

| What comes up | Where it goes |
| --- | --- |
| A bug or an idea | A new issue the same day, even if it is one line |
| A decision | A comment on the issue: what was chosen and why |
| Pricing, business plans, customer names | WhatsApp or a private doc. This repo is public |
| An unfixed security hole | A private channel (a private security advisory once reporting is on), never a public issue |

- **Board:** a GitHub Project that Farhan creates and manages, with Backlog, This week, In progress, In review, Done. Card order is the priority; there are no priority labels. One card in progress per person.
- **Labels:** a type (`bug`, `enhancement`, `documentation`, `decision`) and, where it fits, an area (`area:kit`, `area:app`, `area:ci`).
- **Milestones** are named by outcome, not by version.
- **Flow:** write the issue with a "Done when" line (split it into sub-issues if it needs more than about two days), assign yourself, branch as `<issue>-<short-name>`, and open a PR with `Closes #<issue>`. PRs exist to run the automated checks: no review from the other person is needed, and each of you merges your own PR once the check passes. Agents still merge only when asked, and the release rule below still applies.
- **Updates:** a short note is enough, such as "on #12, blocked by #14".
- **Ownership:** Aathil leads engineering, including the package, releases, CI and testing; Farhan leads product.
- Don't add story points, sprint burndowns, a second task tool or a chat bot until they solve a real problem.

## Current state

`main` has the first implementation, and `pointery` is on public npm. Check the tree before importing or referencing anything.

| Path | What it is |
| --- | --- |
| `packages/pointery/` | The product: the `pointery` npm package (public, MIT), built with `tsc` to `dist/` |
| `packages/pointery/bin/pointery.js` | The `npx pointery init` CLI, with the starter files embedded as strings |
| `app/` | The harness app (`pointery-harness`, private): landing page, demo CRM, `/api/ask`, `/api/admin/*`, `/admin/ask`, `/pointery` |
| `lib/demo.ts` | Turns the demo CRM off in production unless `POINTERY_DEMO=1` |
| `pointery.context.json`, `pointery.config.json` | The harness app's map and settings |
| `context.md` | Pass-by-pass build log. Read it for recent decisions |

Rules for that code:

- The harness uses the workspace copy of `pointery`, not the registry one.
- Subpath imports (`pointery/server`, `pointery/resolver`, `pointery/validate`) work without Next. The root import needs it.
- Keep relative imports in the package `.js`-suffixed, so Node ESM resolves them.
- `app/pointery/page.tsx` is the source of the settings page that `init` ships. After editing it, run `npm run pointery:sync-page`.
- `POINTERY_PROMPT.md` is also embedded in the CLI as `STARTER_PROMPT`. There is no sync script for it, so change both.
- `npx pointery init --check` runs `init` first, so it writes any missing starter files before checking.
- The LLM is set with `POINTERY_LLM_URL` and `POINTERY_LLM_KEY` in `.env.local`. Without a URL, the bundled keyword resolver answers.
- Any route that writes to disk, including ones `init` scaffolds into a user's app, must require authentication or be disabled in production. The admin `PUT` routes return 403 in production unless `POINTERY_ADMIN=1`, and have no login of their own.

Known gaps between `README.md` and the code. Ask before resolving one:

- The README describes a private, paid `pointery-kit`. The code is the public, MIT-licensed `pointery`.
- The README keeps `POINTERY_PROMPT.md` out of npm. The CLI embeds it.
- The README describes `<PointeryStudio/>` and OpenAI, Anthropic and Gemini adapters. Neither exists in the package.
- The context file also has an `answers` array that the README doesn't list.

## Releasing to npm

`.github/workflows/publish.yml` publishes `packages/pointery` when a PR that changes it is merged into `main`. It bumps the version, runs lint and build, publishes, then commits the bump and a `pointery-v*` tag back to `main`.

**Merging is releasing.** A published version goes straight to public npm and its number can't be reused. Don't merge a PR that touches `packages/pointery` until the maintainers have said to release.

- The bump is patch by default. Label the PR `release:minor`, `release:major` or `release:skip` before merging to change that.
- While the version is below 1.0, use `release:minor` for changes to the public API or to what `init` writes.
- Don't edit the package version by hand, and don't run `npm publish` locally.
- Only a change under `packages/pointery` triggers a release. A change to the root `POINTERY_PROMPT.md` or `app/pointery/page.tsx` ships only once it is copied into the CLI.
- Authentication is npm trusted publishing (OIDC). There is no `NPM_TOKEN`; don't add one.
- The trusted publisher on npmjs.com is tied to this repository and the filename `publish.yml`, with direct `npm publish` allowed. Renaming either breaks publishing. A new connection expires if it doesn't publish successfully within 2 days; delete it and create it again.
- Keep `repository.url` in the package pointing at this GitHub repository.
- Every run that reaches the publish step releases a new version, including "Re-run jobs" and manual runs. Use them only if the failed run did not publish. Check with `npm view pointery version`.
- If a run published but failed afterwards, don't re-run it. Get the version bump into `main` with a PR: branch from the `pointery-v*` tag if it was pushed. Merge nothing else first.
- The workflow pushes to `main`. If `main` gets branch protection, allow the workflow through.
- The release commit is authored by `github-actions[bot]`. That is CI, not agent attribution.

## Intended architecture

The loop: type → `resolver(query, context)` → `{ spot, go, action }` → UI highlights, navigates or executes.

| Part | What it is | Who owns it at runtime |
| --- | --- | --- |
| **UI** (`pointery-kit` npm) | `<Pointery/>`: palette, toast, pulse on `data-pointery="..."` elements, navigation, Next/Back guides, allowlisted actions. Mounted once in `layout.tsx`. | Shipped by us |
| **Map** (`pointery.context.json`) | Where things live in the customer's app | Generated by the customer's coding agent from our prompt |
| **Brain** (`resolver`) | The LLM call inside the customer's `/api/ask` route. We ship adapters for OpenAI, Anthropic and Gemini. | Customer's key and cost |

Shape of `pointery.context.json`:

```
{
  targets: [{ key, page, hint, keywords }],
  guides:  [{ title, steps: [{ text, go, spot }] }],
  actions: [{ name, confirm }]
}
```

**Customization** is props only: `<Pointery trigger="shift+a" theme={{ primary, radius }} position suggestions allowActions labels />`, plus `--pointery-*` CSS variables for white-labelling. `<PointeryStudio/>` is the options UI (color pickers, shortcut recorder, toggles), mounted at `/admin/ask`, and writes `pointery.config.json` locally. The docs site has the same thing as a static playground.

**Delivery:** private npm, repo or zip. `npm install` brings the UI, adapters and CLI; `npx pointery init` drops a starter context file and a pointer to the prompt. The developer's wiring should stay around 10 lines.

**`POINTERY_PROMPT.md`** is the map-maker prompt delivered on purchase. It tells the customer's agent to scan `app/**`, add stable `data-pointery` ids, write `pointery.context.json` using only real selectors, mark destructive actions `confirm: true`, and re-run when the UI changes. There is one version per stack (Next, Vue, HTML).

## Product rules

These follow from the spec. Don't break them without asking.

- **No calls to us, no data to us.** No telemetry, hosted dashboard or Pointery-run backend in the kit.
- **Bring your own key.** The LLM call stays server-side in the customer's route. Never put a key in client code.
- **Actions are allowlisted.** Resolver output is untrusted LLM text: execute only actions declared in the context file, and require confirmation where `confirm` is set. Destructive actions must set it.
- **Only real selectors.** A `spot` must match a `data-pointery` id that exists in the app.
- **Keep `PointeryStudio` a separate import** so it adds nothing to the bundle of apps that only mount `<Pointery/>`.
- **Keep `POINTERY_PROMPT.md` out of the npm package** so it can change without a re-publish.

## Stack

- Next.js 16.4.6 (App Router, Turbopack), React 19.3.0
- TypeScript, `strict`; `@/*` maps to the repo root
- Tailwind CSS 4.3.3
- npm (`package-lock.json`); Node.js 20.9 or newer

## Commands

```bash
npm install
npm run dev      # dev server
npm run build    # production build, includes type checking
npm run lint     # ESLint
npx next typegen && npx tsc --noEmit   # type check without a full build
```

For the package:

```bash
npm run kit:build           # build the package to packages/pointery/dist
npm run pointery:sync-page  # copy the settings page into the CLI
```

`npm run lint` reports errors from `packages/pointery/dist` once it has been built. Remove that folder before linting. Build the package before `npm run build`.

Run `next typegen` before a bare `tsc`: global route types such as `LayoutProps<"/">` are generated, so `tsc` alone fails on a fresh clone.

There is no test framework yet. Before calling a change done, run `npm run lint` and `npm run build`, and check UI changes in a browser. `.github/workflows/ci.yml` runs lint, the package build and the app build on every PR to `main`.

## Next.js setup in this repo

- `cacheComponents: true`: data fetching is dynamic by default and caching is opt-in with `"use cache"`. Wrap uncached or request-time reads in `<Suspense>`. Don't add `runtime` exports to route segments; they aren't supported.
- `cacheComponents` also keeps recently visited routes mounted but hidden (React `<Activity>`), so component state survives navigation and effects are cleaned up and re-run. This matters for Pointery: after navigating, an element matching a `data-pointery` id may exist in a hidden route, and palette or guide state may persist. Target visible elements only.
- `partialPrefetching: true`: links prefetch a reusable app shell per route. It requires `cacheComponents`.
- Tailwind runs through the `@tailwindcss/turbopack` loader in `next.config.ts`. There is no PostCSS config or `tailwind.config.*`; theme tokens live in `app/globals.css` under `@theme`.
