import Link from "next/link";
import { DEALS, PIPELINE_TOTAL, money } from "@/lib/crm-data";

export default function DemoHome() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Good morning, Farhan</h1>
        <p className="text-sm text-zinc-500">Here’s what needs you today. (Demo data - Pointery is the product.)</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div data-pointery="pipeline-value" className="rounded-2xl border bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Open pipeline</p>
          <p className="mt-1 text-3xl font-semibold">{money(PIPELINE_TOTAL)}</p>
          <p className="mt-1 text-xs text-zinc-500">{DEALS.length} open deals</p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Closing this week</p>
          <p className="mt-1 text-3xl font-semibold">2</p>
          <p className="mt-1 text-xs text-zinc-500">Acme + Globex</p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Tasks</p>
          <p className="mt-1 text-3xl font-semibold">3</p>
          <p className="mt-1 text-xs text-zinc-500">1 overdue</p>
        </div>
      </div>
      <div className="rounded-2xl border bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Top deals</h2>
          <Link href="/demo/pipeline" data-pointery="nav-pipeline" className="text-sm font-medium text-violet-700 hover:underline">Open pipeline →</Link>
        </div>
        <ul className="divide-y text-sm">
          {DEALS.slice(0, 3).map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2.5">
              <span className="font-medium">{d.name} <span className="ml-2 text-xs text-zinc-400">{d.stage}</span></span>
              <span className="font-mono">{money(d.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
