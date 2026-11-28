# Pointery - ask anything in-app, get taken there.

Pointery is a drop-in kit for any SaaS. User presses Shift+A (or Cmd+K), types "where is export?" or "how do I invite a teammate?", and Pointery highlights the button, navigates to the right page, and walks them step-by-step. It can also answer ("pipeline is $20k") and act ("mark Acme as Won") with confirmation.

CRM in the demo is just the demo. Pointery is the product.

## How it works - 3 parts

1. **UI (pointery-kit npm):** `<Pointery/>` engine. Opens palette, shows toast, pulses `data-pointery="..."` element, navigates, walks guides Next/Back, runs allowlisted actions. Mount once in `layout.tsx`.

2. **Map (pointery.context.json):** Where things live. `{entries[{id,page,label,for}], flows[{title,steps:[entryId]}], actions[{name,confirm,at}]}`. Built by their coding agent running our prompt, not by us.

3. **Brain (their key):** `resolver(query, context)` - their LLM call in their `/api/ask` route (OpenAI/Anthropic/Gemini). We ship adapters, they pay key costs. No calls to us, no data to us.

Loop: type → resolver(query+context) → `{spot,go,action}` → UI pulses/navigates/executes.

## POINTERY_PROMPT.md - the map-maker

Separate .md we deliver on purchase. They paste into Cursor/Claude: "scan app/**, add stable data-pointery ids, output pointery.context.json, only real selectors, mark destructive confirm:true, re-run when UI changes." Kept separate from npm so we can update it without re-publishing. Different version per stack (Next/Vue/HTML).

## Customization

All via props, no hosted dashboard:
`<Pointery trigger="shift+a" theme={{primary,radius,fontFamily}} position animation suggestions allowActions labels />` + CSS vars `--pointery-*` for white-label.
Options UI = `<PointeryStudio/>` in same package, mounted at `/pointery` - color pickers, shortcut recorder, toggles → writes `pointery.config.json` locally. Same as static playground on docs site. Separate import so no bundle bloat.

## Error codes - support lookup

Every failure shows the user a plain sentence plus a stable code. User reports the code, support looks it up here:

| Code | User sees | Support fix |
|---|---|---|
| LLM_NOT_CONFIGURED | setup isn't finished | set `POINTERY_LLM_URL` + `POINTERY_LLM_KEY` + `POINTERY_LLM_MODEL` in `.env.local`, restart |
| LLM_UNAUTHORIZED | the helper was refused | key invalid or no model access - check provider dashboard, rotate key |
| LLM_RATE_LIMITED | the helper is busy | quota / rate limit - wait, retry, check plan |
| LLM_UPSTREAM_ERROR | the helper failed | provider 5xx - check provider status, retry |
| LLM_REQUEST_FAILED | couldn't get an answer | server can't reach the LLM endpoint - check URL, egress, DNS |
| ASK_UNREACHABLE | can't reach the helper | `/api/ask` down or offline - check endpoint mounted, connection |
| ASK_BAD_RESPONSE | unexpected reply | endpoint returned non-JSON - custom handler must return JSON |
| ASK_TIMEOUT | taking too long | over `timing.askMs` (30s) - retry, or raise the timeout |

## Business model

Self-hosted, BYOK. Private npm / repo / zip.
- One-time: as-is, no support.
- Retainer: updates, new adapters, prompt fixes, framework ports.

What npm install does: copies UI + adapters + CLI. `npx pointery init` drops starter context + prompt pointer. Agent fills context. Dev wires 10 lines. Done.
