"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { contactDetails, type ContactDetails } from "@/app/actions/contacts";
import { deleteLead } from "@/app/actions/pipeline";

export type ContactSummary = {
  id: string;
  receivedAt: string;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  stage: string | null;
  optOut: boolean;
  optOutAt: string | null;
  notes: number;
};

const fmt = (iso: string) => new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });

export const ROW_GRID = "md:grid md:grid-cols-[24px_100px_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_32px_32px] md:items-center md:gap-3";

export function ContactRow({ c, leadHref, selected, onSelect }: { c: ContactSummary; leadHref: string; selected: boolean; onSelect: (selected: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<ContactDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function remove() {
    const name = c.name || c.email || c.phone || "Unbekannt";
    if (!confirm(`„${name}“ endgültig löschen? Notizen, Termine und Verlauf werden ebenfalls gelöscht; E-Mail-Ketten für diesen Kontakt werden beendet.`)) return;
    setDeleteError(null);
    startDelete(async () => {
      try {
        const result = await deleteLead(c.id);
        if (result.error) setDeleteError(result.error);
      } catch {
        setDeleteError("Der Kontakt konnte nicht gelöscht werden. Bitte versuche es erneut.");
      }
    });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !details) {
      start(async () => {
        try {
          setDetails(await contactDetails(c.id));
        } catch {
          setError("Details konnten nicht geladen werden.");
        }
      });
    }
  }

  return (
    <article className="border-b border-slate-100 last:border-0">
      <div className={`cursor-pointer space-y-1 px-4 py-3 hover:bg-slate-50 ${ROW_GRID}`} onClick={toggle} role="button" aria-expanded={open} tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())}>
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} aria-label={`${c.name || c.email || c.phone || "Kontakt"} auswählen`} className="h-4 w-4" />
        <div className="text-sm tabular-nums text-slate-600">{fmtDay(c.receivedAt)}</div>
        <div className="min-w-0">
          <Link href={leadHref} onClick={(e) => e.stopPropagation()} className="block truncate font-semibold text-blue-700 hover:underline">
            {c.name || "Unbekannt"}
          </Link>
        </div>
        <div className="min-w-0 text-sm text-slate-600">
          {c.email && <div className="truncate">✉️ {c.email}</div>}
          {c.phone && <div className="truncate">📱 {c.phone}</div>}
        </div>
        <div className="flex flex-wrap gap-1">
          {c.tags.length === 0 ? <span className="text-xs text-slate-400">–</span> : c.tags.map((t) => <span key={t} className="badge bg-blue-50 text-blue-800">{t}</span>)}
        </div>
        <div className="text-sm">{c.stage ? <span className="badge bg-slate-100 text-slate-700">{c.stage}</span> : <span className="text-xs text-slate-400">–</span>}</div>
        <div className="text-sm">
          {c.optOut ? (
            <span className="badge bg-red-50 text-red-700" title="Vom E-Mail-Verteiler abgemeldet">✉ abgemeldet{c.optOutAt ? ` ${fmtDay(c.optOutAt)}` : ""}</span>
          ) : c.email ? (
            <span className="text-xs text-green-700">✓ aktiv</span>
          ) : (
            <span className="text-xs text-slate-400">keine E-Mail</span>
          )}
        </div>
        <div className="hidden text-slate-400 md:block" aria-hidden="true">{open ? "▾" : "▸"}</div>
        <button type="button" disabled={deleting} onClick={(e) => { e.stopPropagation(); remove(); }} onKeyDown={(e) => e.stopPropagation()} aria-label={`${c.name || c.email || c.phone || "Kontakt"} löschen`} title="Kontakt löschen" className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-50">
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6m4-6v6M5 7l1 13h12l1-13M9 7V4h6v3" /></svg>
        </button>
      </div>
      {deleteError && <p role="alert" className="px-4 pb-3 text-sm text-red-700">{deleteError}</p>}

      {open && (
        <div className="grid gap-4 bg-slate-50 px-4 py-4 lg:grid-cols-3">
          {pending && !details && <p className="text-sm text-slate-500 lg:col-span-3">Lade …</p>}
          {error && <p className="text-sm text-red-600 lg:col-span-3">{error}</p>}
          {details && (
            <>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Eingang &amp; Status</h3>
                <dl className="space-y-1 text-sm">
                  <div><dt className="inline text-slate-500">Eingegangen: </dt><dd className="inline">{fmt(details.receivedAt)}</dd></div>
                  {details.language && <div><dt className="inline text-slate-500">Sprache: </dt><dd className="inline">{details.language}</dd></div>}
                  {details.source && (
                    <div><dt className="inline text-slate-500">Quelle: </dt><dd className="inline">{details.source.subject || details.source.from || "E-Mail"}</dd></div>
                  )}
                  <div>
                    <dt className="inline text-slate-500">E-Mail-Verteiler: </dt>
                    <dd className="inline">{c.optOut ? `abgemeldet${details.unsubscribedAt ? ` am ${fmt(details.unsubscribedAt)}` : ""}` : "angemeldet"}</dd>
                  </div>
                </dl>
                <h3 className="pt-2 text-sm font-semibold">Notizen ({details.notes.length})</h3>
                {details.notes.length === 0 ? (
                  <p className="text-sm text-slate-500">Keine Notizen.</p>
                ) : (
                  <ul className="space-y-2">
                    {details.notes.map((n) => (
                      <li key={n.id} className="rounded-lg bg-white p-2 text-sm ring-1 ring-slate-200">
                        <div className="whitespace-pre-wrap">{n.text}</div>
                        <div className="mt-1 text-xs text-slate-500">{fmt(n.at)}{n.by ? ` · ${n.by}` : ""}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Protokoll ({details.protocol.length})</h3>
                <ol className="max-h-80 space-y-2 overflow-y-auto border-l-2 border-slate-200 pl-3 text-sm">
                  {details.protocol.map((p) => (
                    <li key={p.id}>
                      <div>{p.text}</div>
                      <div className="text-xs text-slate-500">{fmt(p.at)}{p.by ? ` · ${p.by}` : ""}</div>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Facebook-Daten (Formular)</h3>
                {details.facebook.length === 0 ? (
                  <p className="text-sm text-slate-500">Keine Formulardaten.</p>
                ) : (
                  <dl className="space-y-1 text-sm">
                    {details.facebook.map((f, i) => (
                      <div key={i}>
                        <dt className="text-xs text-slate-500">{f.label}</dt>
                        <dd className="break-words">{f.values.join(", ") || "–"}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <details className="text-xs">
                  <summary className="cursor-pointer text-blue-700">Rohdaten (JSON)</summary>
                  <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-white p-2 ring-1 ring-slate-200">{details.rawJson}</pre>
                </details>
                <Link href={leadHref} className="inline-block pt-1 text-sm font-medium text-blue-700 hover:underline">Lead öffnen →</Link>
              </section>
            </>
          )}
        </div>
      )}
    </article>
  );
}
