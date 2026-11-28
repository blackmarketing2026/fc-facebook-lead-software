"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { tagContacts } from "@/app/actions/contacts";
import { ContactRow, type ContactSummary } from "./contact-row";

export function ContactSelection({ rows, leadBase, knownTags, header }: {
  rows: ContactSummary[];
  leadBase: string;
  knownTags: string[];
  header: ReactNode;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [tag, setTag] = useState("");
  const [result, setResult] = useState<{ message: string; error?: boolean }>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const visibleIds = rows.map((row) => row.id);
  const selectedIds = selected.filter((id) => visibleIds.includes(id));
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    start(async () => {
      try {
        const response = await tagContacts(selectedIds, tag);
        setResult(response);
        if (!response.error) {
          setSelected([]);
          setTag("");
        }
      } catch {
        setResult({ error: true, message: "Der Tag konnte nicht vollständig vergeben werden. Bitte prüfe das Ergebnis." });
      }
      router.refresh();
    });
  }

  return (
    <>
      <form onSubmit={submit} className="card flex flex-wrap items-center gap-3 p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allSelected} disabled={!rows.length || pending} onChange={(e) => setSelected(e.target.checked ? visibleIds : [])} className="h-4 w-4" />
          Alle auf dieser Seite auswählen
        </label>
        <span className="text-sm text-slate-500">{selectedIds.length} ausgewählt</span>
        <input value={tag} onChange={(e) => setTag(e.target.value)} list="bulk-contact-tags" maxLength={80} placeholder="Tag auswählen oder eingeben" aria-label="Tag" className="input !w-64 max-w-full" />
        <datalist id="bulk-contact-tags">{knownTags.map((name) => <option key={name} value={name} />)}</datalist>
        <button className="btn-primary" disabled={pending || !selectedIds.length || !tag.trim()}>{pending ? "Wird vergeben …" : "Tag vergeben"}</button>
        <span role="status" className={`w-full text-sm ${result?.error ? "text-red-600" : "text-green-700"}`}>{result?.message}</span>
        <p className="w-full text-xs text-slate-500">Ein neuer Tag kann zugehörige aktive E-Mail-Ketten starten.</p>
      </form>
      <div className="card overflow-hidden">
        {header}
        {rows.length === 0 && <div className="p-8 text-center text-sm text-slate-500">Keine Kontakte gefunden.</div>}
        {rows.map((c) => <ContactRow key={c.id} c={c} leadHref={`${leadBase}/${c.id}`} selected={selectedIds.includes(c.id)} onSelect={(checked) => setSelected((old) => checked ? [...old, c.id] : old.filter((id) => id !== c.id))} />)}
      </div>
    </>
  );
}
