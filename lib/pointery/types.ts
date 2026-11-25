export type PointerySpot = { key: string; page: string; hint: string };
export type PointeryGuideStep = { text: string; go: string; spot: string };
export type PointeryGuide = { id: string; title: string; steps: PointeryGuideStep[] };
export type PointeryAction = { name: string; label?: string; confirm?: boolean };

export type PointeryResult = {
  spot?: string;
  go?: string;
  action?: string;
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
  onAction?: (name: string) => void | Promise<void>;
};
