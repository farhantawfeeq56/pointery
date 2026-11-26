# Pointery — ask anything in-app, get taken there.

Drop-in kit for any SaaS. User presses Shift+A (or Cmd+K), types
"where is export?" or "how do I invite a teammate?", and Pointery
highlights the button, navigates to the right page, and walks them
step-by-step.

## Install

```bash
npm i pointery
npx pointery init
```

`init` drops four things: `pointery.context.json` (starter map — the LLM
context your `/api/ask` forwards as `{ query, context }`), `pointery.config.json`
(theme/shortcut), `POINTERY_PROMPT.md` (the map-maker prompt to paste into your
coding agent), and a sync block in `AGENTS.md` (keeps the map fresh on every
later UI change). It never overwrites without `--force` — except `AGENTS.md`,
where it appends/refreshes only its own delimited block. `npx pointery init --check`
validates that every guide step points at a real target.

## Wire up (10 lines)

```tsx
// layout.tsx — mount once, next to {children}
import { Pointery } from "pointery";
import "pointery/styles.css";

<Pointery />;
```

```ts
// app/api/ask/route.ts — your endpoint, your key, your data
import { createAskHandler, type PointeryContext } from "pointery";
import context from "@/pointery.context.json";

export const POST = createAskHandler(context as PointeryContext);
```

```tsx
// optional: real side-effects for actions
<Pointery onAction={async (name) => { /* your logic */ }} />;
```

Without `onAction`, actions just log to localStorage, fire a
`pointery:action` window event, and toast. Your data never leaves
your app.

## The 3 parts

1. **UI (this package):** `<Pointery/>` palette, toast, pulse on
   `data-pointery="..."` elements, guide walk, allowlisted actions.
2. **Map (`pointery.context.json`, yours):** `{ entries, flows,
   actions }` — a ship-time index of stable UI anchors (never
   per-record ids, never live values). Built by your coding agent running our
   prompt (`POINTERY_PROMPT.md`), not by us.
3. **Brain (your key):** pass `llm: { url, key }` to
   `createAskHandler` to forward `{ query, candidates, page }` — the
   top-ranked slice of the map, never the whole file — to your own
   model endpoint. Otherwise the bundled keyword resolver answers
   locally. No calls to us, no data to us.

## Props

| Prop | Default | What |
| ---- | ------- | ---- |
| `trigger` | `"shift+a"` | Shortcut (Cmd/Ctrl+K always works too) |
| `theme` | `{ primary: "#6d28d9", radius: 14 }` | Applied as `--pointery-*` CSS vars |
| `position` | `"top"` | `"top"` / `"center"` / `"bottom"` |
| `suggestions` | built-in 5 | Buttons shown before typing |
| `allowActions` | `[]` (blocked) | Actions the UI will run — anything else routes to spot/go/guide |
| `labels` | english | `placeholder`, `empty`, `confirmTitle` |
| `endpoint` | `"/api/ask"` | Where queries are POSTed |
| `onAction` | log + toast | `(name) => void \| Promise<void>` |

White-label further with `--pointery-*` CSS vars.

## Validate your map

```ts
import { validateContext } from "pointery";
const errors = validateContext(context); // [] = valid
```

## License

MIT.
