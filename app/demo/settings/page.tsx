export default function SettingsPage() {
  return (
    <div className="flex max-w-lg flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-500">Workspace preferences (demo stubs).</p>
      </div>
      <label className="rounded-2xl border bg-white p-4 text-sm">
        <span className="font-medium">Workspace name</span>
        <input defaultValue="Acme Inc" className="mt-2 w-full rounded-lg border px-3 py-2 outline-none focus:border-violet-500" />
      </label>
      <label className="flex items-center justify-between rounded-2xl border bg-white p-4 text-sm">
        <span className="font-medium">Pointery suggestions</span>
        <input type="checkbox" defaultChecked className="h-4 w-4 accent-violet-700" />
      </label>
      <p className="text-xs text-zinc-400">Pointery itself is configured via props + <code className="font-mono">pointery.config.json</code> — see <a className="underline" href="/pointery">/pointery</a>.</p>
    </div>
  );
}
