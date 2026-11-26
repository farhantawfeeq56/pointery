export type PointerySpot = { key: string; page: string; hint: string };
export type PointeryGuideStep = { text: string; go: string; spot: string };
export type PointeryGuide = { id: string; title: string; steps: PointeryGuideStep[] };

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

export type PointeryContext = {
  version?: number;
  entries: PointeryEntry[];
  flows: PointeryFlow[];
  actions: PointeryAction[];
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
  hint?: string;
};

export type PointeryTheme = { primary?: string; radius?: number };
export type PointeryPosition = "top" | "center" | "bottom";
export type PointeryLabels = { placeholder?: string; empty?: string; confirmTitle?: string };

export type PointeryProps = {
  trigger?: string; // e.g. "shift+a" (default), plus cmd+k always on
  theme?: PointeryTheme;
  position?: PointeryPosition;
  suggestions?: string[];
  allowActions?: string[];
  labels?: PointeryLabels;
  /** POST endpoint for queries. Defaults to "/api/ask". */
  endpoint?: string;
  /** Override default action behavior (dispatches `pointery:action` + toast otherwise). */
  onAction?: (name: string) => void | Promise<void>;
};

/** Customer's own LLM endpoint. Pointery forwards { query, candidates, page } — key and cost are theirs. */
export type PointeryLLMAdapter = {
  url: string;
  key?: string;
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
