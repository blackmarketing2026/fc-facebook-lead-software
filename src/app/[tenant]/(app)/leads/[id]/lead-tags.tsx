"use client";

import { useState, useTransition } from "react";
import { addLeadTag, removeLeadTag, setLeadOptOut, type ChainState } from "@/app/actions/chains";

export function LeadTags({ leadId, tags, knownTags, optOut, hasEmail }: { leadId: string; tags: { id: string; name: string }[]; knownTags: string[]; optOut: boolean; hasEmail: boolean }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<ChainState>();
  const run = (fn: () => Promise<ChainState>) => start(async () => setInfo(await fn()));
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">Tags &amp; E-Mail-Ketten</h2>
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 && <span className="text-sm text-slate-500">Keine Tags.</span>}
        {tags.map((t) => (
          <span key={t.id} className="badge bg-blue-50 text-blue-800">
            {t.name}
            <button type="button" aria-label={`Tag ${t.name} entfernen`} disabled={pending} className="ml-1.5 text-blue-400 hover:text-blue-800" onClick={() => run(() => removeLeadTag(leadId, t.id))}>
              ✕
            </button>
          </span>
        ))}
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = name;
          setName("");
          run(() => addLeadTag(leadId, value));
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} list="lead-known-tags" placeholder="Tag hinzufügen …" maxLength={80} className="input !w-56 max-w-full" />
        <datalist id="lead-known-tags">
          {knownTags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button disabled={pending || !name.trim()} className="btn-secondary">Hinzufügen</button>
      </form>
      {info?.ok && <p className="text-sm text-green-700">{info.ok}</p>}
      {info?.error && <p className="text-sm text-red-600">{info.error}</p>}
      <div className="border-t border-slate-100 pt-3 text-sm text-slate-600">
        {!hasEmail && <p className="mb-1 text-amber-700">Dieser Lead hat keine E-Mail-Adresse – Ketten-Mails sind nicht möglich.</p>}
        {optOut ? (
          <p>
            Vom E-Mail-Verteiler abgemeldet.{" "}
            <button type="button" className="text-blue-700 hover:underline" disabled={pending} onClick={() => confirm("Lead wieder für E-Mails freigeben? Nur mit Einwilligung des Kontakts.") && run(() => setLeadOptOut(leadId, false))}>
              Wieder freigeben
            </button>
          </p>
        ) : (
          <button type="button" className="text-slate-500 hover:underline" disabled={pending} onClick={() => confirm("Lead vom E-Mail-Verteiler abmelden? Laufende Ketten werden beendet.") && run(() => setLeadOptOut(leadId, true))}>
            Vom E-Mail-Verteiler abmelden
          </button>
        )}
      </div>
    </section>
  );
}
