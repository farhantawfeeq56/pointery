export type PointerySpot = { key: string; page: string; hint: string };
export type PointeryGuideStep = { text: string; go: string; spot: string };
export type PointeryGuide = { id: string; title: string; steps: PointeryGuideStep[] };

/** Ad-hoc multi-intent walkthrough - templated steps, same UI as a guide. Max 4 steps. */
export type PointeryPlanStep = { text: string; go: string; spot: string; filter?: string };
export type PointeryPlan = { title: string; steps: PointeryPlanStep[] };

/** One UI anchor: identity + purpose + place. No sentences, no live values. */
export type PointeryEntry = {
  id: string;
  page: string;
  label: string;
  /** Stable purpose, one clause ("Downloads the pipeline as CSV") - never an instruction. */
  for?: string;
  type?: "nav" | "button" | "table" | "card" | "field" | "section" | string;
  /** Non-obvious synonyms only ("csv"); matching derives from label + for. */
  aliases?: string[];
  /** Container whose rows are found by text at runtime (never per-record ids). */
  rows?: boolean;
};

/** Ordered anchor ids - the model (or the "Go to {label}" template) writes the wording. */
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
 *  Strict match only (no word-overlap fallback) - nothing else is pinned. */
export type PointeryPin = {
  /** Canonical phrase, e.g. "where is export" - normalized before compare. */
  match: string;
  aliases?: string[];
  spot?: string;
  go?: string;
  action?: string;
  /** Flow id - steps are rebuilt from the flow, never stored here. */
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

/** Top-ranked slice of the map sent to the LLM - never the whole file. */
export type PointeryCandidates = Pick<PointeryContext, "entries" | "flows" | "actions">;

export type PointeryResult = {
  spot?: string;
  go?: string;
  action?: string;
  /** Human label of the action from the map (falls back to the action name) - shown in the confirm dialog and Done toast. */
  actionLabel?: string;
  /** Anchor the action runs against, e.g. `Pipeline table` - the row `filter` (if any) is named inside the action sentence. */
  actionTarget?: string;
  /** Row search text - kept only alongside a `spot` whose entry has `rows: true`. */
  filter?: string;
  /** Echoed from the matched action's `confirm` flag - UI confirms only when true. */
  confirm?: boolean;
  answer?: string;
  guide?: PointeryGuide;
  plan?: PointeryPlan;
  hint?: string;
};

export type PointeryTheme = { primary?: string; radius?: number; accent?: string; background?: string; text?: string; border?: string; /** CSS font-family stack for the palette/toast/guide, e.g. "Inter, system-ui, sans-serif". Defaults to bundled Figtree. */ fontFamily?: string };

export type PointeryTiming = {
  /** Toast auto-dismiss. Defaults to 4200. */
  toastMs?: number;
  /** Pulse highlight duration. Defaults to 2600. */
  pulseMs?: number;
  /** Palette exit animation. Defaults to 160. */
  closeMs?: number;
  /** Input autofocus delay. Defaults to 30. */
  focusMs?: number;
  /** Pulse delay after navigation vs in place. Defaults to 450 / 50. */
  navigateMs?: number;
  navigateIdleMs?: number;
};
export type PointeryPosition = "top" | "center" | "bottom";
/** Palette entrance. `slide` drifts in from the palette edge (down on top, up on bottom). */
export type PointeryAnimation = "fade" | "slide" | "scale" | "none";
export type PointeryLabels = {
  placeholder?: string;
  empty?: string;
  confirmTitle?: string;
  /** "Asking…" busy toast. */
  asking?: string;
  /** Supports {action}. */
  blocked?: string;
  /** Supports {action}. */
  done?: string;
  /** Supports {endpoint}. */
  unreachable?: string;
  pressEnter?: string;
  guideComplete?: string;
  /** Supports {title}. */
  ambiguous?: string;
  /** Supports {action}. */
  confirmBody?: string;
  back?: string;
  next?: string;
  doneBtn?: string;
  cancel?: string;
  confirmBtn?: string;
  fabLabel?: string;
};

export type PointeryProps = {
  trigger?: string; // any "+"-joined combo, e.g. "shift+a" (default) or "ctrl+shift+p" - ctrl/cmd treated the same, plus cmd/ctrl+k always on
  theme?: PointeryTheme;
  /** Extra `--pointery-*` overrides (keys may include the prefix or not). */
  cssVars?: Record<string, string>;
  /** Overlay z-index. Defaults to 60 (toast/guide sit +10). */
  zIndex?: number;
  /** Palette width px. Defaults to 560. */
  paletteWidth?: number;
  /** Overlay blur px. Defaults to 2. */
  overlayBlur?: number;
  /** Idle "?" button: false hides it, string sets its glyph. Defaults to true. */
  fab?: boolean | string;
  /** Routes where the palette never mounts (mount checks this). Defaults to ["/"]. */
  hiddenRoutes?: string[];
  timing?: PointeryTiming;
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

/** Customer's own LLM endpoint. Required at runtime - the handler 503s without it. OpenAI-compatible is the default wire (`{ model, messages }`); native Anthropic Messages / Gemini `generateContent` URLs are auto-detected from the host - same shape, no extra config. `model` passes through verbatim: copy the exact id from the provider dashboard (`gpt-4o-mini`, `claude-3-5-haiku-latest`, `gemini-2-flash`, `anthropic/claude-3-5-haiku` via OpenRouter, …). Key and cost are theirs. */
export type PointeryLLMAdapter = {
  url: string;
  key?: string;
  /** Exact model id as the provider spells it. Defaults to `gpt-4o-mini` on api.openai.com, otherwise required. */
  model?: string;
  /** Sampling temperature. Defaults to 0. */
  temperature?: number;
  /** Max response tokens. Defaults to 300. */
  maxTokens?: number;
};

export type AskHandlerOptions = {
  llm?: PointeryLLMAdapter;
  /** When set, other actions are dropped server-side, keeping spot/go/guide. UI defaults to [] (blocked). */
  allowActions?: string[];
  /** Cap the candidates slice forwarded to the LLM (defaults 8/3/3). */
  retrieve?: { entries?: number; flows?: number; actions?: number };
  /** Query/plan caps (defaults 200 chars / 4 steps). */
  limits?: { queryMax?: number; planMax?: number };
  /** LLM-response cache (defaults 5 min / 200 entries; ttlMs 0 disables). */
  cache?: { ttlMs?: number; max?: number };
  /** Return a result to short-circuit (e.g. block demo routes in prod), or null to continue. */
  guard?: (query: string, local: PointeryResult) => PointeryResult | null;
};
