"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import type { PointeryContext } from "pointery";

const ENV_SNIPPET = "POINTERY_LLM_URL=https://api.openai.com/v1/chat/completions\nPOINTERY_LLM_KEY=sk-...\nPOINTERY_LLM_MODEL=gpt-4o-mini";

export default function PointerySettingsPage() {
  const [askOk, setAskOk] = useState<boolean | null>(null);
  const [ctx, setCtx] = useState<PointeryContext | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [llm, setLlm] = useState<{ configured: boolean; host: string; model: string } | null>(null);

  // Disk is truth: load pointery.config.json + context summary on mount.
  useEffect(() => {
    fetch("/api/admin/context")
      .then((r) => r.json().catch(() => null))
      .then((d) => {
        if (d?.context) setCtx(d.context);
        if (d?.errors) setErrors(d.errors);
      })
      .catch(() => {});
    fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "where is export?" }),
    })
      .then((r) => r.json())
      .then((d) => setAskOk(Boolean(d.spot || d.go || d.action || d.guide || d.answer)))
      .catch(() => setAskOk(false));
    fetch("/api/admin/llm")
      .then((r) => r.json().catch(() => null))
      .then((d) => d && setLlm(d))
      .catch(() => {});
  }, []);

  // Dev-only: writes to disk with no login, so it never renders in production.
  if (process.env.NODE_ENV === "production") notFound();

  const counts = ctx ? `${ctx.entries?.length ?? 0} entries · ${ctx.flows?.length ?? 0} flows · ${ctx.actions?.length ?? 0} actions` : null;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- Figtree is intentionally scoped to /pointery; this ships inside the init starter page */}
      <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        :root {
          --color-primary: #00A878;
          --color-primary-hover: #008F65;
          --color-primary-active: #007653;
          --color-primary-subtle: #D8F1A0;
          --color-accent: #FE5E41;
          --color-accent-hover: #E94D32;
          --color-background: #FFFFFF;
          --color-background-secondary: #F8FAF5;
          --color-surface: #FFFFFF;
          --color-surface-secondary: #D8F1A0;
          --color-surface-tertiary: #F3C178;
          --color-surface-inverse: #0B0500;
          --color-text-primary: #0B0500;
          --color-text-secondary: #716D67;
          --color-text-tertiary: #9B9892;
          --color-text-inverse: #FFFFFF;
          --color-text-brand: #00A878;
          --color-text-accent: #FE5E41;
          --color-border: #E8EAE5;
          --color-border-strong: #C9CEC4;
          --color-border-brand: #00A878;
          --color-border-focus: #00A878;
          --color-action-primary: #00A878;
          --color-action-primary-hover: #008F65;
          --color-action-secondary: #D8F1A0;
          --color-action-accent: #FE5E41;
          --color-action-disabled: #E8EAE5;
          --color-success: #00A878;
          --color-success-subtle: #D8F1A0;
          --color-warning: #F3C178;
          --color-warning-text: #0B0500;
          --color-error: #FE5E41;
          --color-error-subtle: #FFF0EC;
          --color-info: #00A878;
          --color-info-subtle: #E8F7F1;
          --shadow-sm: 0 1px 2px rgba(11, 5, 0, 0.05);
          --shadow-md: 0 4px 12px rgba(11, 5, 0, 0.08);
          --shadow-lg: 0 12px 32px rgba(11, 5, 0, 0.12);
        }
        .pointery-settings { font-family: "Figtree", ui-sans-serif, system-ui, sans-serif; background: var(--color-background); color: var(--color-text-primary); }
        .py-ok, .py-warn, .py-err, .py-idle, .py-subtle { background: var(--color-background-secondary); color: var(--color-text-secondary); border: 1px solid var(--color-border); }
        .py-ok::before, .py-warn::before, .py-err::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 999px; margin-right: 6px; vertical-align: 1px; }
        .py-ok::before { background: var(--color-success); }
        .py-warn::before { background: var(--color-warning); }
        .py-err::before { background: var(--color-error); }
        .py-code { background: var(--color-background-secondary); border: 1px solid var(--color-border); color: var(--color-text-primary); }
        /* motion: ease + enter only */
        .pointery-settings { --py-ease: cubic-bezier(0.23, 1, 0.32, 1); }
        @keyframes py-enter { from { opacity: 0; transform: translateY(8px); filter: blur(4px); } to { opacity: 1; transform: none; filter: blur(0); } }
        .py-enter { animation: py-enter 480ms var(--py-ease) both; }
        @media (prefers-reduced-motion: reduce) {
          .py-enter { animation-duration: 0ms; }
        }
      `}</style>
    <div className="pointery-settings w-full flex-1">
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Pointery status</h1>
          <p className="text-sm text-zinc-500">
            Customize with <code className="font-mono">{"<Pointery/>"}</code> props in your layout - this page shows system status.
          </p>
        </div>
      </div>

      <p className="py-enter text-xs font-medium uppercase tracking-wider text-zinc-400" style={{ animationDelay: "60ms" }}>System status</p>
      <div data-pointery="pointery-settings-status" className="py-enter flex flex-wrap gap-2 text-xs" style={{ animationDelay: "110ms" }}>
        <span className={`rounded-full px-3 py-1 font-medium ${askOk ? "py-ok" : "py-idle"}`}>
          /api/ask {askOk == null ? "…" : askOk ? "reachable ✓" : "unreachable"}
        </span>
        <span className={`rounded-full px-3 py-1 font-medium ${llm?.configured ? "py-ok" : "py-err"}`}>
          {llm == null ? "brain …" : llm.configured ? `LLM → ${llm.host || "env"}${llm.model ? ` / ${llm.model}` : ""} ✓` : "LLM required - missing key/url/model"}
        </span>
        {counts && <span className="py-subtle rounded-full px-3 py-1 font-medium">{counts}</span>}
        <span className={`rounded-full px-3 py-1 font-medium ${errors.length === 0 ? "py-ok" : "py-err"}`}>
          context {errors.length === 0 ? "valid ✓" : `${errors.length} error${errors.length > 1 ? "s" : ""}`}
        </span>
      </div>
      {llm && !llm.configured && (
          <div data-pointery="pointery-settings-brain" className="text-xs">
              <p className="font-medium" style={{ color: "var(--color-error)" }}>Brain setup needed</p>
              <p className="mt-1 text-zinc-500">Add all three to <code className="font-mono">.env.local</code> together, then restart. Without all three, /api/ask fails closed (503).</p>
              <pre className="py-code mt-2 overflow-x-auto rounded-lg p-3 font-mono text-xs leading-5">{ENV_SNIPPET}</pre>
            </div>
      )}
      {errors.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-red-700">
          {errors.slice(0, 3).map((e) => (
            <li key={e}>{e}</li>
          ))}
          {errors.length > 3 && <li>+{errors.length - 3} more</li>}
        </ul>
      )}
      {ctx && (
        <div data-pointery="pointery-settings-context" className="border-t border-zinc-200 pt-8 text-sm">
          <h2 className="text-sm font-medium">Context <span className="font-normal text-zinc-500">(read-only - edit <code className="font-mono">pointery.context.json</code>)</span></h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left uppercase tracking-wider text-zinc-400">
                <tr><th className="py-1 pr-3">id</th><th className="py-1 pr-3">page</th><th className="py-1">label - for</th></tr>
              </thead>
              <tbody className="divide-y font-mono">
                {(ctx.entries ?? []).map((t) => (
                  <tr key={t.id}><td className="py-1 pr-3">{t.id}</td><td className="py-1 pr-3">{t.page}</td><td className="py-1">{t.label}{t.for ? ` - ${t.for}` : ""}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-mono text-xs text-zinc-500">
            flows: {(ctx.flows ?? []).map((g) => `${g.id} (${g.steps.length})`).join(", ") || "-"} · actions:{" "}
            {(ctx.actions ?? []).map((a) => `${a.name}${a.confirm ? " ⚠" : ""}`).join(", ") || "-"}
          </p>
        </div>
      )}
    </div>
    </div>
    </>
  );
}
