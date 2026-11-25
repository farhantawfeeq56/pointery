"use client";

import { useEffect, useState } from "react";
import { Pointery } from "pointery";
import type { PointeryProps } from "pointery";

// Server-component layout can't render the client <Pointery/> directly.
// Disk is truth: load pointery.config.json via /api/admin/config so the
// Studio page preview matches what visitors get. Falls back to kit
// defaults when the API is unreachable.
export default function PointeryMount() {
  const [cfg, setCfg] = useState<PointeryProps>({});

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.config) {
          const c = d.config;
          setCfg({
            trigger: c.trigger,
            theme: c.theme,
            position: c.position,
            suggestions: c.suggestions,
            allowActions: c.allowActions,
            labels: c.labels,
          });
        }
      })
      .catch(() => {});
  }, []);

  return <Pointery {...cfg} />;
}
