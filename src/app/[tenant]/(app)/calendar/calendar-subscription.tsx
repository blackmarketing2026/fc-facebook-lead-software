"use client";

import { useState, useTransition } from "react";
import { resetCalendarToken } from "@/app/actions/leads";

/** Ein persönlicher iCalendar-Feed kann in Google und Outlook abonniert werden. */
export function CalendarSubscription({ feedUrl }: { feedUrl: string | null }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [pending, start] = useTransition();

  async function copyUrl() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }

  return <section className="card space-y-5 p-5">
    <div><span className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">Kalender verbinden</span><h2 className="mt-1 text-xl font-semibold">Google Kalender oder Outlook</h2><p className="mt-2 max-w-2xl text-sm text-slate-600">Abonniere deine Termine einmalig. Neue oder geänderte Termine erscheinen danach automatisch im gewählten Kalender. Die Aktualisierung kann beim Kalenderanbieter verzögert sein.</p></div>

    {!feedUrl ? <div className="rounded-xl bg-[var(--accent-soft)] p-4"><p className="mb-3 text-sm">Erstelle zuerst deinen persönlichen Kalender-Link. Danach kannst du Google oder Outlook verbinden.</p><button type="button" disabled={pending} onClick={() => start(() => resetCalendarToken())} className="btn-primary">{pending ? "Erstellen …" : "Kalender-Link erstellen"}</button></div> : <>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><label htmlFor="calendar-feed-url" className="label">Dein persönlicher Abo-Link</label><div className="flex flex-col gap-2 sm:flex-row"><input id="calendar-feed-url" readOnly value={feedUrl} onFocus={(event) => event.currentTarget.select()} className="input min-w-0 flex-1 font-mono text-xs" /><button type="button" className="btn-primary whitespace-nowrap" onClick={copyUrl}>{copied ? "✓ Link kopiert" : "Link kopieren"}</button></div>{copyError && <p className="mt-2 text-sm text-red-700">Kopieren nicht möglich. Markiere und kopiere den Link aus dem Feld.</p>}</div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-5"><div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-xl">📅</span><div><h3 className="font-semibold">Google Kalender</h3><p className="text-xs text-slate-500">Kalender per URL hinzufügen</p></div></div><ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700"><li>Persönlichen Link oben kopieren.</li><li>Google Kalender am Computer öffnen und unter „Weitere Kalender“ → „Per URL“ wählen.</li><li>Link einfügen und „Kalender hinzufügen“ auswählen.</li></ol><a href="https://calendar.google.com/calendar/r/settings/addbyurl" target="_blank" rel="noopener noreferrer" className="btn-secondary mt-5 w-full">Google Kalender öffnen ↗</a></div>
        <div className="rounded-2xl border border-slate-200 p-5"><div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-xl">✉</span><div><h3 className="font-semibold">Outlook Kalender</h3><p className="text-xs text-slate-500">Online-Kalender abonnieren</p></div></div><ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700"><li>Persönlichen Link oben kopieren.</li><li>In Outlook „Kalender hinzufügen“ → „Aus dem Web abonnieren“ öffnen.</li><li>Link einfügen, einen Namen vergeben und „Importieren“ wählen.</li></ol><div className="mt-5 flex flex-wrap gap-2"><a href="https://outlook.live.com/calendar/" target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1">Outlook.com ↗</a><a href="https://outlook.office.com/calendar/" target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1">Outlook für Arbeit ↗</a></div></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="max-w-xl text-xs text-slate-500">Der Link enthält Zugriff auf deine Termine und Kontaktdaten. Gib ihn nur in deinem eigenen Kalenderkonto ein. Wenn du ihn erneuerst, musst du das Abo in Google oder Outlook mit dem neuen Link neu einrichten.</p><button type="button" disabled={pending} onClick={() => { if (confirm("Neuen Kalender-Link erzeugen? Der alte Link funktioniert danach nicht mehr und muss in Google oder Outlook ersetzt werden.")) start(() => resetCalendarToken()); }} className="btn-secondary">Link erneuern</button></div>
    </>}
  </section>;
}
