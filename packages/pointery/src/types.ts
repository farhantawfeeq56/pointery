export type PointerySpot = { key: string; page: string; hint: string };
export type PointeryGuideStep = { text: string; go: string; spot: string };
export type PointeryGuide = { id: string; title: string; steps: PointeryGuideStep[] };
export type PointeryAction = { name: string; label?: string; confirm?: boolean };

export type PointeryContext = {
  targets: { key: string; page: string; hint: string; keywords: string[] }[];
  guides: { id: string; title: string; keywords: string[]; steps: { text: string; go: string; spot: string }[] }[];
  actions: { name: string; label?: string; confirm?: boolean; keywords: string[] }[];
  /** Static copy only — never live per-user data (counts, totals, record names). */
  answers?: { keywords: string[]; answer: string; spot?: string; go?: string; hint?: string }[];
};

/** Top-ranked slice of the map sent to the LLM — never the whole file. */
export type PointeryCandidates = Pick<PointeryContext, "targets" | "guides" | "actions">;

export type PointeryResult = {
  spot?: string;
  go?: string;
  action?: string;
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
  /** Cap the candidates slice forwarded to the LLM (defaults 8/3/3). */
  retrieve?: { targets?: number; guides?: number; actions?: number };
  /** Return a result to short-circuit (e.g. block demo routes in prod), or null to continue. */
  guard?: (query: string, local: PointeryResult) => PointeryResult | null;
};
