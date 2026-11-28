import Link from "next/link";
import { isDemoEnabled } from "@/lib/demo";

const STEPS = [
  {
    n: "01",
    t: "Drop in the UI",
    d: "<Pointery/> - palette, toast, pulse on data-pointery, Next/Back guides, confirm step for actions. Mount once via a client wrapper, gated off marketing pages.",
  },
  {
    n: "02",
    t: "Map your app",
    d: "pointery.context.json - entries, flows, actions, pins. Stable anchors only, no live values. Your agent builds it with POINTERY_PROMPT.md, checked with init --check.",
  },
  {
    n: "03",
    t: "Bring your key",
    d: "createAskHandler in /api/ask - local keywords first (fast, free), LLM only on a miss. OpenAI-compatible default, Anthropic/Gemini auto-detected, fails closed without a key.",
  },
];

const DOES = [
  {
    t: "Find",
    d: "“Where is export?” → pulses the button and navigates to its page. Spot plus go, from stable data-pointery ids.",
  },
  {
    t: "Walk",
    d: "“How do I invite?” → step-by-step guide with Next/Back. Combo queries (“…and then…”) become a short plan.",
  },
  {
    t: "Act",
    d: "“Mark deal as won” runs only allowlisted actions - blocked by default, destructive ones confirm first.",
  },
  {
    t: "Pin down rows",
    d: "“Where is the Acme deal?” → pulses the matching row inside a rows:true table. Runtime search, never per-record ids.",
  },
  {
    t: "Answer",
    d: "Anything keywords can't cover falls through to your own model - same guardrails, same spot/go shape.",
  },
  {
    t: "Curated fast-paths",
    d: "Optional pins[] answer golden phrases exactly and skip the LLM. Everything else scores generically.",
  },
];

const TRIES = [
  "Where is export?",
  "How do I invite a teammate?",
  "Walk me through closing a deal",
  "Where is the Acme deal?",
  "Mark deal as won",
];

const WIRE = `npx pointery init   # context + config + prompt + settings page

// layout.tsx - mount once, gated off marketing pages
import { Pointery } from "pointery";
import "pointery/styles.css";
// wrapper returns null on "/" so the palette lives inside the app
<Pointery trigger="shift+a" />  // Cmd/Ctrl+K always works too

// app/api/ask/route.ts - your endpoint, your key, your data
import { createAskHandler } from "pointery/server";
export const POST = createAskHandler(context, {
  llm: { url, key, model },   // required - 503 without it
  allowActions: ["export-pipeline"],  // UI default is [] (blocked)
});

// optional side-effects - otherwise logs + toasts + pointery:action event
<Pointery onAction={async (name) => { /* your logic */ }} />

npx pointery init --check   # flows/pins point at real entries`;

export default function Home() {
  const demo = isDemoEnabled();
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- Figtree shared with /pointery settings */}
      <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        :root {
          --color-primary: #ED1C24;
          --color-primary-hover: #C9141B;
          --color-secondary: #235789;
          --color-accent: #F1D302;
          --color-background: #FDFFFC;
          --color-background-secondary: #F2F2EF;
          --color-surface: #FDFFFC;
          --color-text-primary: #020100;
          --color-text-secondary: #666663;
          --color-text-tertiary: #666663;
          --color-border: #E5E5E2;
          --color-error: #ED1C24;
          --shadow-md: 0 4px 12px rgba(2, 1, 0, 0.08);
        }
        .pointery-landing { font-family: "Figtree", ui-sans-serif, system-ui, sans-serif; background: var(--color-background); color: var(--color-text-primary); }
        .py-inset { background: var(--color-background-secondary); color: var(--color-text-secondary); border: 1px solid var(--color-border); }
        .py-code { background: var(--color-background-secondary); border: 1px solid var(--color-border); color: var(--color-text-primary); }
        .py-save { background: var(--color-primary); color: #fff; }
        .py-save:hover { background: var(--color-primary-hover); }
                .py-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 14px; }
      `}</style>
      <div className="pointery-landing w-full flex-1">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6">
          <header className="flex items-center justify-between py-5">
            <span className="text-lg font-bold tracking-tight">◉ Pointery</span>
            <nav className="flex items-center gap-2 text-sm font-medium">
              {demo && <Link href="/demo" className="rounded-full px-4 py-2 text-muted-foreground hover:bg-surface-muted">Live demo</Link>}
              {demo && <Link href="/pointery" className="rounded-full px-4 py-2 text-muted-foreground hover:bg-surface-muted">Settings</Link>}
              {demo
                ? <Link href="/demo/pipeline" className="py-save rounded-full px-4 py-2 text-white">Try it →</Link>
                : <Link href="/pointery" className="py-save rounded-full px-4 py-2 text-white">Open settings →</Link>}
            </nav>
          </header>

          <main className="flex flex-col items-center py-16 text-center">
            <p className="py-inset rounded-full px-4 py-1.5 text-xs font-medium shadow-sm">
              Drop-in kit for any SaaS · the palette lives inside the app, not this page{demo && <> - open the demo and press <kbd className="rounded bg-surface px-1.5 py-0.5 font-mono">Shift+A</kbd></>}
            </p>
            <h1 className="mt-6 max-w-2xl text-5xl font-bold leading-[1.05] tracking-tight">
              Users ask.<br />Pointery takes them there.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8" style={{ color: "var(--color-text-secondary)" }}>
              Find, walk, act, pin down rows, answer - with confirmation where it matters.
              The CRM here is just the demo - <strong style={{ color: "var(--color-text-primary)" }}>Pointery is the product.</strong>
            </p>
            <div className="mt-8 flex gap-3">
              {demo ? (
                <>
                  <Link href="/demo" className="py-save rounded-full px-6 py-3 text-sm font-semibold text-white">Open the live demo</Link>
                  <Link href="/pointery" className="rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold hover:bg-surface-muted" style={{ borderColor: "var(--color-border)" }}>Theme it in settings</Link>
                </>
              ) : (
                <>
                  <Link href="/pointery" className="py-save rounded-full px-6 py-3 text-sm font-semibold text-white">Open settings</Link>
                  <a href="#how" className="rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold hover:bg-surface-muted" style={{ borderColor: "var(--color-border)" }}>How it works ↓</a>
                </>
              )}
            </div>
            <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2 text-xs">
              {TRIES.map((t) => (
                <span key={t} className="py-inset rounded-full px-3 py-1.5 font-medium">“{t}”</span>
              ))}
            </div>

            <p className="mt-14 w-full text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">01 - What it does</p>
            <div className="mt-3 grid w-full gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
              {DOES.map((s) => (
                <div key={s.t} className="py-card p-5">
                  <h2 className="font-semibold">{s.t}</h2>
                  <p className="mt-2 text-sm leading-6" style={{ color: "var(--color-text-secondary)" }}>{s.d}</p>
                </div>
              ))}
            </div>

            <p id="how" className="mt-10 w-full text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">02 - How it works</p>
            <div className="mt-3 grid w-full gap-4 text-left sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="py-card p-5">
                  <p className="font-mono text-xs" style={{ color: "var(--color-primary)" }}>{s.n}</p>
                  <h2 className="mt-1 font-semibold">{s.t}</h2>
                  <p className="mt-2 text-sm leading-6" style={{ color: "var(--color-text-secondary)" }}><code className="font-mono text-[13px]" style={{ color: "var(--color-text-primary)" }}>{s.d.split(" - ")[0]}</code> - {s.d.split(" - ")[1]}</p>
                </div>
              ))}
            </div>

            <p className="mt-10 w-full text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">03 - Wire up</p>
            <div className="py-code mt-3 w-full rounded-[14px] p-5 text-left">
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[13px] leading-6">{WIRE}</pre>
            </div>

            <div className="mt-4 grid w-full gap-4 text-left sm:grid-cols-2">
              <div className="py-card p-5">
                <h2 className="font-semibold">Tune it in /pointery</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--color-text-secondary)" }}>
                  Shortcut recorder (Shift+A, Cmd+K, or your own combo), brand color + radius, position, suggestions -
                  live preview, status pills for ask / LLM / context, auto-save to disk with a Save button.
                </p>
                {demo
                  ? <Link href="/pointery" className="mt-3 inline-block text-sm font-medium hover:underline" style={{ color: "var(--color-primary)" }}>Open settings →</Link>
                  : <span className="mt-3 inline-block text-sm" style={{ color: "var(--color-text-tertiary)" }}>Settings is dev-only - it 404s in production.</span>}
              </div>
              <div className="py-card p-5">
                <h2 className="font-semibold">Safe by default</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--color-text-secondary)" }}>
                  Your key stays server-side, nothing calls home. Actions are allowlisted and blocked unless listed;
                  destructive ones carry <code className="font-mono text-[13px]" style={{ color: "var(--color-text-primary)" }}>confirm:true</code>.
                  Admin disk writes refuse in production; demo routes 404 there too.
                </p>
              </div>
            </div>

            {demo && (
              <div className="py-card mt-4 w-full p-5 text-left">
                <h2 className="font-semibold">The demo CRM (dev-only)</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--color-text-secondary)" }}>
                  Dashboard, pipeline (Export CSV, mark-won via event, row pulse), contacts (invite, search), settings stubs -
                  18 anchors over 5 pages plus the /pointery ones, 3 guides (invite / export / close), 3 actions.
                  It 404s in production unless <code className="font-mono text-[13px]" style={{ color: "var(--color-text-primary)" }}>POINTERY_DEMO=1</code>.
                </p>
                <Link href="/demo" className="mt-3 inline-block text-sm font-medium hover:underline" style={{ color: "var(--color-primary)" }}>Open the demo →</Link>
              </div>
            )}
          </main>

          <footer className="flex items-center justify-between border-t border-border py-6 text-xs text-muted-foreground" style={{ borderColor: "var(--color-border)" }}>
            <span>Pointery - self-hosted · BYOK · no data to us</span>
            <span>{demo && (<><Link href="/demo/settings" className="underline">Demo settings</Link> · </>)}<Link href="/pointery" className="underline">Settings</Link> · POINTERY_PROMPT.md ships on purchase</span>
          </footer>
        </div>
      </div>
    </>
  );
}
