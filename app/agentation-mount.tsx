"use client";

import { Agentation } from "agentation";

// Dev-only visual feedback toolbar. No MCP, no endpoint - local copy-paste mode.
// Renders nothing in production so no feedback UI ships to buyers.
export default function AgentationMount() {
  if (process.env.NODE_ENV !== "development") return null;
  return <Agentation />;
}
