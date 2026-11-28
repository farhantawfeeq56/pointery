"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Pointery } from "pointery";
import type { PointeryProps } from "pointery";

// Marketing pages have no app UI to point at — keep the palette inside the app.

// Server-component layout can't render the client <Pointery/> directly.
// Disk is truth: load pointery.config.json via /api/admin/config so the
// mounted palette matches the shipped config. Falls back to kit
// defaults when the API is unreachable.
export default function PointeryMount() {
  const [cfg, setCfg] = useState<PointeryProps>({});
  const [hidden, setHidden] = useState<string[]>(["/"]);
  const path = usePathname();

  // Live updates: applies `pointery:config` events (dispatched by config
  // tooling) so the mounted palette follows disk without a reload.
  useEffect(() => {
    const onLive = (e: Event) => {
      const detail = (e as CustomEvent).detail as (PointeryProps & { config?: PointeryProps }) | undefined;
      if (detail) {
        const c = (detail as { config?: PointeryProps }).config ?? detail;
        if (c.hiddenRoutes) setHidden(c.hiddenRoutes);
        setCfg({ ...c });
      }
    };
    window.addEventListener("pointery:config", onLive);
    return () => window.removeEventListener("pointery:config", onLive);
  }, []);

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.config) {
          const c = d.config;
          if (c.hiddenRoutes) setHidden(c.hiddenRoutes);
          setCfg({
            trigger: c.trigger,
            theme: c.theme,
            cssVars: c.cssVars,
            zIndex: c.zIndex,
            paletteWidth: c.paletteWidth,
            overlayBlur: c.overlayBlur,
            fab: c.fab,
            hiddenRoutes: c.hiddenRoutes,
            timing: c.timing,
            position: c.position,
            animation: c.animation,
            suggestions: c.suggestions,
            allowActions: c.allowActions,
            labels: c.labels,
            endpoint: c.endpoint,
          });
        }
      })
      .catch(() => {});
  }, []);

  return hidden.includes(path) ? null : <Pointery {...cfg} />;
}
