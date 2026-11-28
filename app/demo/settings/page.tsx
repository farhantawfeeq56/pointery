export default function SettingsPage() {
  return (
    <div className="flex max-w-lg flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Workspace preferences (demo stubs).</p>
      </div>
      <label className="rounded-2xl border border-border bg-surface p-4 text-sm">
        <span className="font-medium">Workspace name</span>
        <input defaultValue="Acme Inc" className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-primary" />
      </label>
      <label className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 text-sm">
        <span className="font-medium">Pointery suggestions</span>
        <input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
      </label>
      <p className="text-xs text-muted-foreground">Pointery itself is configured via props + <code className="font-mono">pointery.config.json</code> - see <a className="underline" href="/pointery">/pointery</a>.</p>
    </div>
  );
}
