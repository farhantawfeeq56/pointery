"use client";

import { Pointery } from "pointery";

// Server-component layout can't render the client <Pointery/> directly.
// Demo side-effects live in the demo pages (they listen for
// `pointery:action`); the kit default logs + toasts.
export default function PointeryMount() {
  return <Pointery />;
}
