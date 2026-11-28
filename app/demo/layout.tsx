import Link from "next/link";
import { notFound } from "next/navigation";
import { isDemoEnabled } from "@/lib/demo";
import VariantLab from "./variant-lab";

const NAV = [
  { href: "/demo", label: "Dashboard", key: "nav-dashboard" },
  { href: "/demo/pipeline", label: "Pipeline", key: "nav-pipeline" },
  { href: "/demo/contacts", label: "Contacts", key: "nav-contacts" },
  { href: "/demo/settings", label: "Settings", key: "nav-settings" },
];

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  if (!isDemoEnabled()) notFound();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-6 py-8">
      <aside className="w-48 shrink-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Demo CRM</p>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href as never}
              data-pointery={n.key}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <p className="mt-6 rounded-xl bg-violet-50 p-3 text-xs leading-5 text-violet-900">
          Press <kbd className="rounded bg-white px-1.5 py-0.5 font-mono shadow-sm">Shift+A</kbd> and ask “where is export?”
        </p>
      </aside>
      <section className="min-w-0 flex-1">{children}</section>
      <VariantLab />
    </div>
  );
}
