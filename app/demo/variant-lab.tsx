"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ctx from "../../pointery.context.json";

const NAMES = ["Ask", "List", "Grouped", "Rich", "Split", "Tabs", "Wizard", "Bar"];

type Item = {
  kind: "go" | "do" | "guide";
  id: string;
  title: string;
  sub: string;
  page?: string;
  spot?: string;
  flowSteps?: string[];
  confirm?: boolean;
};

const ALL: Item[] = [
  ...(ctx.entries ?? []).map((e) => ({
    kind: (e.type === "button" ? "do" : "go") as "go" | "do",
    id: e.id,
    title: e.label,
    sub: e.for ?? e.page,
    page: e.page,
    spot: e.id,
  })),
  ...(ctx.flows ?? []).map((f) => ({
    kind: "guide" as const,
    id: f.id,
    title: f.title,
    sub: `${f.steps.length} steps`,
    page: undefined,
    spot: undefined,
    flowSteps: f.steps,
  })),
  ...(ctx.actions ?? []).map((a) => ({
    kind: "do" as const,
    id: `action:${a.name}`,
    title: a.label ?? a.name,
    sub: a.confirm ? "action · needs confirm" : "action",
    page: undefined,
    spot: a.at,
    confirm: a.confirm,
  })),
];

function pulse(spot?: string, page?: string, push?: (p: string) => void) {
  if (page && push) push(page as never);
  if (!spot) return;
  setTimeout(() => {
    const el = document.querySelector(`[data-pointery="${spot}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("pointery-pulse");
    void (el as HTMLElement).offsetWidth;
    el.classList.add("pointery-pulse");
    setTimeout(() => el.classList.remove("pointery-pulse"), 2400);
  }, page ? 450 : 50);
}

function match(q: string): Item[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return ALL.slice(0, 7);
  const toks = needle.split(/\s+/);
  return ALL.filter((i) =>
    toks.every((t) => `${i.title} ${i.sub} ${i.id}`.toLowerCase().includes(t))
  ).slice(0, 7);
}

export default function VariantLab() {
  const [v, setV] = useState(() => {
    try {
      const saved = Number(localStorage.getItem("pointery-variant") || 1);
      return saved >= 1 && saved <= 8 ? saved : 1;
    } catch { return 1; }
  });
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<"all" | "go" | "do" | "guide">("all");
  const [step, setStep] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (n: number) => {
    setV(n);
    localStorage.setItem("pointery-variant", String(n));
    setSel(0);
    setStep(0);
  };

  // Ctrl/Cmd+K opens lab (capture + stop so the real palette stays shut in demo)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false); setQ("");
        return;
      }
      // 1-8 switches variant — but never while typing in the palette input
      if (/^[1-8]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const ae = document.activeElement as HTMLElement | null;
        if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) return;
        pick(Number(e.key));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    if (open) { const t = setTimeout(() => inputRef.current?.focus(), 30); return () => clearTimeout(t); }
  }, [open, v]);


  const results = useMemo(() => {
    let r = match(q);
    if (v === 6 && tab !== "all") r = r.filter((i) => i.kind === tab || (tab === "go" && i.kind === "go"));
    return r;
  }, [q, tab, v]);

  const best = results[0];
  const guideFlow = (ctx.flows ?? []).find(
    (f) => f.id === best?.id || f.title.toLowerCase().includes(q.trim().toLowerCase())
  );

  const go = (it?: Item) => {
    if (!it) return;
    if (it.kind === "guide" && it.flowSteps) {
      const first = (ctx.entries ?? []).find((e) => e.id === it.flowSteps![0]);
      pulse(first?.id, first?.page, router.push);
    } else {
      pulse(it.spot, it.page, router.push);
    }
    setOpen(false);
  };

  const shell = "w-full rounded-2xl bg-white shadow-2xl border border-zinc-200 overflow-hidden";
  const inputCls =
    "w-full px-4 py-3 text-[15px] outline-none placeholder:text-zinc-400 bg-transparent";

  return (
    <>
      <style>{`.pointery-fab{display:none}`}</style>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex justify-center bg-black/25 px-4 pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className={shell}
            style={{ maxWidth: v === 5 ? 720 : 560, height: "fit-content" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`Palette variant ${v}: ${NAMES[v - 1]}`}
          >
            {/* V8 minimal: input only */}
            {v === 8 ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  go(best);
                }}
              >
                <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type and hit Enter — no list" className={inputCls} />
              </form>
            ) : (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (v === 1) go(best);
                    else go(results[sel] ?? best);
                  }}
                >
                  <input
                    ref={inputRef}
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setSel(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSel((s) => Math.min(s + 1, results.length - 1));
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSel((s) => Math.max(s - 1, 0));
                      }
                    }}
                    placeholder={`${NAMES[v - 1]} — try "export", "invite", "pipeline" (variant ${v}/8)`}
                    className={inputCls}
                  />
                </form>

                {/* V1 ask: single answer card */}
                {v === 1 && (
                  <div className="border-t border-zinc-100 px-4 py-3">
                    {!q ? (
                      <div className="flex flex-wrap gap-1.5 py-1">
                        {["where is export?", "how do I invite?", "pipeline"].map((s) => (
                          <button key={s} onClick={() => setQ(s)} className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200">
                            {s}
                          </button>
                        ))}
                      </div>
                    ) : best ? (
                      <div>
                        <p className="text-sm"><strong>{best.title}</strong> <span className="text-zinc-500">— {best.sub}</span></p>
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => go(best)} className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white">Take me there</button>
                          {guideFlow && <span className="self-center text-xs text-zinc-500">{guideFlow.steps.length} steps</span>}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400">No match — try “export”, “invite”, or “pipeline”.</p>
                    )}
                  </div>
                )}

                {/* V2 classic list */}
                {v === 2 && (
                  <ul className="border-t border-zinc-100 py-1">
                    {results.map((r, i) => (
                      <li key={r.id}>
                        <button onClick={() => go(r)} onMouseEnter={() => setSel(i)}
                          className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${i === sel ? "bg-zinc-100" : ""}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span className="flex-1">{r.title}</span>
                          <kbd className="rounded bg-zinc-100 px-1.5 text-[10px] text-zinc-500">↵</kbd>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* V3 grouped */}
                {v === 3 && (
                  <div className="border-t border-zinc-100 px-2 py-2">
                    {(["go", "do", "guide"] as const).map((k) => {
                      const items = results.filter((r) => r.kind === k);
                      if (!items.length) return null;
                      return (
                        <div key={k}>
                          <p className="px-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            {k === "go" ? "Go to" : k === "do" ? "Do" : "Guides"}
                          </p>
                          {items.map((r) => (
                            <button key={r.id} onClick={() => go(r)} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-zinc-100">
                              {r.title} <span className="text-xs text-zinc-400">· {r.sub}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* V4 rich rows */}
                {v === 4 && (
                  <ul className="border-t border-zinc-100 p-2 space-y-1">
                    {results.map((r) => (
                      <li key={r.id}>
                        <button onClick={() => go(r)} className="block w-full rounded-xl border border-zinc-150 px-3 py-2 text-left hover:border-emerald-500">
                          <span className="flex items-center gap-2 text-sm font-semibold">{r.title}
                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.kind === "do" ? "bg-amber-100 text-amber-900" : r.kind === "guide" ? "bg-violet-100 text-violet-900" : "bg-emerald-100 text-emerald-900"}`}>{r.kind}</span>
                            {r.confirm && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">confirm</span>}
                          </span>
                          <span className="text-xs text-zinc-500">{r.sub}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* V5 two-pane */}
                {v === 5 && (
                  <div className="flex border-t border-zinc-100">
                    <ul className="w-1/2 border-r border-zinc-100 py-1">
                      {results.map((r, i) => (
                        <li key={r.id}>
                          <button onClick={() => go(r)} onMouseEnter={() => setSel(i)}
                            className={`block w-full px-4 py-2 text-left text-sm ${i === sel ? "bg-zinc-100" : ""}`}>{r.title}</button>
                        </li>
                      ))}
                    </ul>
                    <div className="w-1/2 bg-zinc-50 px-4 py-3 text-sm">
                      {(results[sel] ?? best) ? (
                        <>
                          <p className="font-bold">{(results[sel] ?? best)!.title}</p>
                          <p className="mt-1 text-xs text-zinc-500">{(results[sel] ?? best)!.sub}</p>
                          <p className="mt-1 font-mono text-[11px] text-zinc-400">{(results[sel] ?? best)!.page ?? (results[sel] ?? best)!.id}</p>
                          <button onClick={() => go(results[sel] ?? best)} className="mt-3 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white">Take me there</button>
                        </>
                      ) : <p className="text-xs text-zinc-400">No preview</p>}
                    </div>
                  </div>
                )}

                {/* V6 tabs */}
                {v === 6 && (
                  <>
                    <div className="flex gap-1 border-t border-zinc-100 px-3 pt-2">
                      {(["all", "go", "do", "guide"] as const).map((t) => (
                        <button key={t} onClick={() => setTab(t)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === t ? "bg-black text-white" : "bg-zinc-100 text-zinc-600"}`}>{t}</button>
                      ))}
                    </div>
                    <ul className="py-1">
                      {results.map((r) => (
                        <li key={r.id}>
                          <button onClick={() => go(r)} className="block w-full px-4 py-2 text-left text-sm hover:bg-zinc-100">
                            {r.title} <span className="text-xs text-zinc-400">· {r.kind}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* V7 wizard inside palette */}
                {v === 7 && (
                  <div className="border-t border-zinc-100 px-4 py-3">
                    {guideFlow ? (
                      <>
                        <p className="text-sm font-bold">{guideFlow.title} <span className="font-normal text-zinc-400">· {step + 1}/{guideFlow.steps.length}</span></p>
                        <p className="mt-1 text-sm text-zinc-600">Step {step + 1}: <code className="rounded bg-zinc-100 px-1">{guideFlow.steps[step]}</code></p>
                        <div className="mt-2 flex gap-2">
                          <button disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="rounded-full border px-3 py-1 text-xs disabled:opacity-40">Back</button>
                          {step < guideFlow.steps.length - 1
                            ? <button onClick={() => setStep((s) => s + 1)} className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Next</button>
                            : <button onClick={() => {
                                const first = (ctx.entries ?? []).find((e) => e.id === guideFlow.steps[0]);
                                pulse(first?.id, first?.page, router.push);
                                setOpen(false);
                              }} className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Go</button>}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-zinc-500">Type “invite” or “export” to load steps here.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* floating segmented toolbar, bottom-right */}
      <div className="fixed bottom-4 right-4 z-[80] flex items-center gap-1 rounded-full bg-zinc-900 p-1.5 shadow-xl" role="toolbar" aria-label="Palette variants">
        <span className="hidden px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 sm:block">{NAMES[v - 1]} · Ctrl+K</span>
        {NAMES.map((n, i) => (
          <button
            key={n}
            title={`${i + 1}: ${n}`}
            onClick={() => {
              pick(i + 1);
              setOpen(true);
            }}
            className={`h-7 w-7 rounded-full text-xs font-bold ${v === i + 1 ? "bg-white text-black" : "text-zinc-300 hover:bg-zinc-700"}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </>
  );
}
