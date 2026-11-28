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

## Business model

Self-hosted, BYOK. Private npm / repo / zip.
- One-time: as-is, no support.
- Retainer: updates, new adapters, prompt fixes, framework ports.

What npm install does: copies UI + adapters + CLI. `npx pointery init` drops starter context + prompt pointer. Agent fills context. Dev wires 10 lines. Done.
