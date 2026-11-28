export type PointerySpot = { key: string; page: string; hint: string };
export type PointeryGuideStep = { text: string; go: string; spot: string };
export type PointeryGuide = { id: string; title: string; steps: PointeryGuideStep[] };

/** Ad-hoc multi-intent walkthrough — templated steps, same UI as a guide. Max 4 steps. */
export type PointeryPlanStep = { text: string; go: string; spot: string; filter?: string };
export type PointeryPlan = { title: string; steps: PointeryPlanStep[] };

/** One UI anchor: identity + purpose + place. No sentences, no live values. */
export type PointeryEntry = {
  id: string;
  page: string;
  label: string;
  /** Stable purpose, one clause ("Downloads the pipeline as CSV") — never an instruction. */
  for?: string;
  type?: "nav" | "button" | "table" | "card" | "field" | "section" | string;
  /** Non-obvious synonyms only ("csv"); matching derives from label + for. */
  aliases?: string[];
  /** Container whose rows are found by text at runtime (never per-record ids). */
  rows?: boolean;
};

/** Ordered anchor ids — the model (or the "Go to {label}" template) writes the wording. */
export type PointeryFlow = {
  id: string;
  title: string;
  steps: string[];
  /** Non-obvious synonyms / verb forms ("closing"); matching derives from title + id. */
  aliases?: string[];
};

export type PointeryAction = {
  name: string;
  label?: string;
  confirm?: boolean;
  /** Entry id the action runs against. */
  at?: string;
  aliases?: string[];
};

/** Curated fast-path: exact-phrase wins that skip generic scoring and the LLM.
 *  Strict match only (no word-overlap fallback) — nothing else is pinned. */
export type PointeryPin = {
  /** Canonical phrase, e.g. "where is export" — normalized before compare. */
  match: string;
  aliases?: string[];
  spot?: string;
  go?: string;
  action?: string;
  /** Flow id — steps are rebuilt from the flow, never stored here. */
  guide?: string;
  hint?: string;
};

export type PointeryContext = {
  version?: number;
  entries: PointeryEntry[];
  flows: PointeryFlow[];
  actions: PointeryAction[];
  pins?: PointeryPin[];
};

/** Top-ranked slice of the map sent to the LLM — never the whole file. */
export type PointeryCandidates = Pick<PointeryContext, "entries" | "flows" | "actions">;

export type PointeryResult = {
  spot?: string;
  go?: string;
  action?: string;
  /** Row search text — kept only alongside a `spot` whose entry has `rows: true`. */
  filter?: string;
  /** Echoed from the matched action's `confirm` flag — UI confirms only when true. */
  confirm?: boolean;
  answer?: string;
  guide?: PointeryGuide;
  plan?: PointeryPlan;
  hint?: string;
};

export type PointeryTheme = { primary?: string; radius?: number };
export type PointeryPosition = "top" | "center" | "bottom";
/** Palette entrance. `slide` drifts in from the palette edge (down on top, up on bottom). */
export type PointeryAnimation = "fade" | "slide" | "scale" | "none";
export type PointeryLabels = { placeholder?: string; empty?: string; confirmTitle?: string };

export type PointeryProps = {
  trigger?: string; // any "+"-joined combo, e.g. "shift+a" (default) or "ctrl+shift+p" — ctrl/cmd treated the same, plus cmd/ctrl+k always on
  theme?: PointeryTheme;
  position?: PointeryPosition;
  /** Palette entrance animation. Defaults to "slide". */
  animation?: PointeryAnimation;
  suggestions?: string[];
  allowActions?: string[];
  labels?: PointeryLabels;
  /** POST endpoint for queries. Defaults to "/api/ask". */
  endpoint?: string;
  /** Override default action behavior (dispatches `pointery:action` + toast otherwise). */
  onAction?: (name: string) => void | Promise<void>;
};

/** Customer's own LLM endpoint. Required at runtime — the handler 503s without it. OpenAI-compatible is the default wire (`{ model, messages }`); native Anthropic Messages / Gemini `generateContent` URLs are auto-detected from the host — same shape, no extra config. `model` passes through verbatim: copy the exact id from the provider dashboard (`gpt-4o-mini`, `claude-3-5-haiku-latest`, `gemini-2-flash`, `anthropic/claude-3-5-haiku` via OpenRouter, …). Key and cost are theirs. */
export type PointeryLLMAdapter = {
  url: string;
  key?: string;
  /** Exact model id as the provider spells it. Defaults to `gpt-4o-mini` on api.openai.com, otherwise required. */
  model?: string;
};

export type AskHandlerOptions = {
  llm?: PointeryLLMAdapter;
  /** When set, other actions are dropped server-side, keeping spot/go/guide. UI defaults to [] (blocked). */
  allowActions?: string[];
  /** Cap the candidates slice forwarded to the LLM (defaults 8/3/3). */
  retrieve?: { entries?: number; flows?: number; actions?: number };
  /** Return a result to short-circuit (e.g. block demo routes in prod), or null to continue. */
  guard?: (query: string, local: PointeryResult) => PointeryResult | null;
};
