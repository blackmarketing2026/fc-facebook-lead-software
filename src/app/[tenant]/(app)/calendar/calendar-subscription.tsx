"use client";

import { useState, useTransition } from "react";
import { resetCalendarToken } from "@/app/actions/leads";

/** Persönlicher Abo-Link für Google Kalender (bzw. Outlook/Apple) mit Kopieren-Button und Anleitung. */
export function CalendarSubscription({ feedUrl }: { feedUrl: string | null }) {
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const url = feedUrl ?? "";

  return (
    <section className="card p-5">
      <h2 className="mb-1 font-semibold">📆 Mit Google Kalender verbinden</h2>
      <p className="mb-4 text-sm text-slate-500">
        Mit deinem persönlichen Abo-Link erscheinen alle deine Termine automatisch in Google Kalender, Outlook oder auf dem
        iPhone – inklusive Telefonnummer, E-Mail und Link zum Lead-Profil. Zusätzlich bekommst du zu jedem neuen Termin eine
        E-Mail mit dem Button „Zu Google Kalender hinzufügen“.
      </p>

      {feedUrl ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly value={url} onFocus={(e) => e.target.select()} className="input font-mono text-xs" aria-label="Abo-Link" />
            <button
              type="button"
              className="btn-primary whitespace-nowrap"
              disabled={!url}
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "✓ Kopiert" : "Link kopieren"}
            </button>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>
              <a href="https://calendar.google.com/calendar/r/settings/addbyurl" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                Google Kalender → „Per URL hinzufügen“
              </a>{" "}
              öffnen (am Computer).
            </li>
            <li>Den kopierten Link einfügen und auf „Kalender hinzufügen“ klicken.</li>
            <li>Fertig – der Kalender erscheint links unter „Weitere Kalender“ und auch in der Google-Kalender-App am Handy.</li>
          </ol>
          <p className="text-xs text-slate-500">
            Google aktualisiert abonnierte Kalender selbst, meist alle paar Stunden – ganz neue Termine kommen deshalb zuerst
            per E-Mail. Den Link nicht weitergeben: Wer ihn hat, sieht deine Termine.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              confirm("Neuen Link erzeugen? Der alte Link funktioniert danach nicht mehr und muss im Kalender ersetzt werden.") &&
              start(() => resetCalendarToken())
            }
            className="btn-secondary text-xs"
          >
            Neuen Link erzeugen
          </button>
        </div>
      ) : (
        <button type="button" disabled={pending} onClick={() => start(() => resetCalendarToken())} className="btn-primary">
          {pending ? "Erstellen …" : "Abo-Link erstellen"}
        </button>
      )}
    </section>
  );
}
