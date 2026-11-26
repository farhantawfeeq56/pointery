import SettingsPage from "@/app/pointery/page";

// Single settings UI: /admin/ask renders the same page as /pointery.
// Canonical source is app/pointery/page.tsx (what `npx pointery init` ships).
export default function AdminAskPage() {
  return <SettingsPage />;
}
