"use client";

import { useState } from "react";
import { CONTACTS } from "@/lib/crm-data";

export default function ContactsPage() {
  const [q, setQ] = useState("");
  const [sent, setSent] = useState(false);
  const rows = CONTACTS.filter((c) => (c.name + c.email).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">{rows.length} people</p>
        </div>
        <button
          data-pointery="invite-button"
          onClick={() => { setSent(true); setTimeout(() => setSent(false), 3000); }}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Invite teammate
        </button>
      </div>
      {sent && <p className="rounded-xl bg-success/10 px-4 py-2.5 text-sm text-success">Invite sent (demo) - they’ll land here.</p>}
      <input
        data-pointery="search-contacts"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search contacts…"
        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary"
      />
      <ul className="divide-y overflow-hidden rounded-2xl border border-border bg-surface text-sm">
        {rows.map((c) => (
          <li key={c.email} className="flex items-center justify-between px-4 py-3">
            <span><span className="font-medium">{c.name}</span> <span className="text-muted-foreground">{c.email}</span></span>
            <span className="text-xs text-muted-foreground">{c.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
