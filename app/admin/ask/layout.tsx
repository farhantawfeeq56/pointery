import { notFound } from "next/navigation";

// Harness-only: same settings UI as /pointery, never rendered in production.
export default function AdminAskLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
