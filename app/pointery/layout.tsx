import { notFound } from "next/navigation";

// Harness-only: the settings UI writes to disk with no login, so it never
// renders in production. (Not synced to the CLI starter — init ships only
// app/pointery/page.tsx + the config route, whose PUT also refuses in prod.)
export default function PointeryLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
