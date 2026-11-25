"use client";

import { useEffect, useState } from "react";
import { DEALS, money } from "@/lib/crm-data";

export default function PipelinePage() {
  const [won, setWon] = useState<string[]>([]);

  useEffect(() => {
    const read = () => {
      try {
        const log = JSON.parse(localStorage.getItem("pointery-actions") ?? "[]") as { name: string }[];
        if (log.some((e) => e.name === "mark-won")) setWon(["deal-acme"]);
      } catch { /* empty */ }
    };
    read();
    const on = (e: Event) => { if ((e as CustomEvent).detail === "mark-won") setWon(["deal-acme"]); };
    window.addEventListener("pointery:action", on);
    return () => window.removeEventListener("pointery:action", on);
  }, []);

  const exportCsv = () => {
    window.dispatchEvent(new CustomEvent("pointery:action", { detail: "export-pipeline" }));
    const csv = "deal,value,stage\n" + DEALS.map((d) => `${d.name},${d.value},${d.stage}`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "pipeline.csv";
    a.click();
  };

  const rows = DEALS;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-sm text-zinc-500">{rows.length} deals · drag-and-drop is out of scope for this demo</p>
        </div>
        <div className="flex gap-2">
          <button data-pointery="add-deal-button" className="rounded-full border px-4 py-2 text-sm font-medium hover:bg-zinc-50" onClick={() => alert("Add deal is a stub in the demo — wire it to your CRM.")}>+ Add deal</button>
          <button data-pointery="export-button" onClick={exportCsv} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">Export</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-400">
            <tr><th className="px-4 py-3">Deal</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3 text-right">Status</th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((d) => {
              const isWon = won.includes(d.id);
              return (
                <tr key={d.id} data-pointery={d.id === "deal-acme" ? "deal-acme" : undefined} className={isWon ? "bg-green-50" : undefined}>
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{isWon ? "Closed Won" : d.stage}</td>
                  <td className="px-4 py-3 text-right font-mono">{money(d.value)}</td>
                  <td className="px-4 py-3 text-right">
                    {isWon
                      ? <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">Won ✓</span>
                      : <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-500">Open</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-400">Try: Shift+A → “mark Acme as Won” (confirm) · “where is export?”</p>
    </div>
  );
}
