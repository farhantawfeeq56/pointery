import Link from "next/link";
import { isDemoEnabled } from "@/lib/demo";

const STEPS = [
  { n: "01", t: "Drop in the UI", d: "<Pointery/> — palette, toast, pulse on data-pointery, guides, allowlisted actions. 10 lines in layout.tsx." },
  { n: "02", t: "Map your app", d: "pointery.context.json — entries, flows, actions. Your agent builds it with POINTERY_PROMPT.md." },
  { n: "03", t: "Bring your key", d: "resolver(query, context) in /api/ask. OpenAI, Anthropic, Gemini — you pay, nothing touches us." },
];

const TRIES = ["Where is export?", "How do I invite a teammate?", "Show me the pipeline table"];

export default function Home() {
  const demo = isDemoEnabled();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-5">
        <span className="text-lg font-bold tracking-tight">◉ Pointery</span>
        <nav className="flex items-center gap-2 text-sm font-medium">
          {demo && <Link href="/demo" className="rounded-full px-4 py-2 text-zinc-600 hover:bg-zinc-100">Live demo</Link>}
          {demo && <Link href="/admin/ask" className="rounded-full px-4 py-2 text-zinc-600 hover:bg-zinc-100">Studio</Link>}
          {demo
            ? <Link href="/demo/pipeline" data-pointery="demo-cta" className="rounded-full bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700">Try it →</Link>
            : <Link href="/admin/ask" className="rounded-full bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700">Open Studio →</Link>}
        </nav>
      </header>

      <main className="flex flex-col items-center py-16 text-center">
        <p className="rounded-full border bg-white px-4 py-1.5 text-xs font-medium text-zinc-600 shadow-sm">
          Drop-in kit for any SaaS · press <kbd className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">Shift+A</kbd> anywhere in this site
        </p>
        <h1 className="mt-6 max-w-2xl text-5xl font-bold leading-[1.05] tracking-tight">
          Users ask.<br />Pointery takes them there.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-500">
          “Where is export?” → the button pulses. “How do I invite?” → a step-by-step walk.
          Answers and acts with confirmation. The CRM here is just the demo — <strong className="text-zinc-800">Pointery is the product.</strong>
        </p>
        <div className="mt-8 flex gap-3">
          {demo ? (
            <>
              <Link href="/demo" className="rounded-full bg-violet-700 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-600">Open the live demo</Link>
              <Link href="/admin/ask" className="rounded-full border bg-white px-6 py-3 text-sm font-semibold hover:bg-zinc-50">Theme it in Studio</Link>
            </>
          ) : (
            <>
              <Link href="/admin/ask" className="rounded-full bg-violet-700 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-600">Open Studio</Link>
              <a href="#how" className="rounded-full border bg-white px-6 py-3 text-sm font-semibold hover:bg-zinc-50">How it works ↓</a>
            </>
          )}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
          {TRIES.map((t) => (
            <span key={t} className="rounded-full bg-violet-50 px-3 py-1.5 font-medium text-violet-900">“{t}”</span>
          ))}
        </div>

        <div id="how" className="mt-14 grid w-full gap-4 text-left sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border bg-white p-5">
              <p className="font-mono text-xs text-violet-700">{s.n}</p>
              <h2 className="mt-1 font-semibold">{s.t}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500"><code className="font-mono text-[13px] text-zinc-700">{s.d.split(" — ")[0]}</code> — {s.d.split(" — ")[1]}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 w-full rounded-2xl bg-zinc-950 p-6 text-left">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">layout.tsx — 10 lines</p>
          <pre className="overflow-x-auto font-mono text-[13px] leading-6 text-zinc-100">{`import Pointery from "@/components/Pointery";\n\nexport default function RootLayout({ children }) {\n  return (\n    <html><body>\n      {children}\n      <Pointery />\n    </body></html>\n  );\n}`}</pre>
        </div>
      </main>

      <footer className="flex items-center justify-between border-t py-6 text-xs text-zinc-400">
        <span>Pointery — self-hosted · BYOK · no data to us</span>
        <span>{demo && (<><Link href="/demo/settings" className="underline">Demo settings</Link> · </>)}POINTERY_PROMPT.md ships on purchase</span>
      </footer>
    </div>
  );
}
