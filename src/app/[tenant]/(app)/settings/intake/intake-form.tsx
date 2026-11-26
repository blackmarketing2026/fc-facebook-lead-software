"use client";

import { useActionState, useState, useTransition } from "react";
import { copyImapFromSmtp, resetImapSettings, saveImapSettings, saveIntakeRules, testImap, type SettingsState } from "@/app/actions/settings";

function Status({ state }: { state: SettingsState }) {
  return (
    <>
      {state?.ok && <span className="text-sm text-green-700">{state.ok}</span>}
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
    </>
  );
}

export function IntakeRulesForm({ subject, recipient }: { subject: string; recipient: string }) {
  const [state, action, pending] = useActionState(saveIntakeRules, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">Im Betreff muss stehen</span>
        <textarea name="subject" rows={3} defaultValue={subject} placeholder="Neuer Lead" className="input" />
      </label>
      <label className="block">
        <span className="label">Empfängeradresse (An/Cc) muss enthalten</span>
        <textarea name="recipient" rows={2} defaultValue={recipient} placeholder="kundenservice@function-concept.de" className="input" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "Speichern …" : "Speichern"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

type Initial = { host: string; port: number; secure: boolean; user: string; hasPassword: boolean };

export function ImapForm({ initial, source, hasStored }: { initial: Initial; source: "app" | "env"; hasStored: boolean }) {
  const [state, action, pending] = useActionState(saveImapSettings, undefined);
  const [busy, start] = useTransition();
  const [other, setOther] = useState<SettingsState>();
  const run = (fn: () => Promise<SettingsState>) => start(async () => setOther(await fn()));
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Aktuell wirksam: {initial.host ? `${initial.host}:${initial.port}` : "nichts eingerichtet"} ·{" "}
        {source === "app" ? "in der App gespeichert" : "aus den Server-Variablen"}
      </p>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Server (IMAP-Host)</span>
          <input name="host" required defaultValue={initial.host} placeholder="imap.example.com" className="input" autoComplete="off" />
        </label>
        <label className="block">
          <span className="label">Port</span>
          <input name="port" type="number" required defaultValue={initial.port} className="input" />
        </label>
        <label className="block">
          <span className="label">Benutzer (Postfach)</span>
          <input name="user" required defaultValue={initial.user} className="input" autoComplete="off" />
        </label>
        <label className="block">
          <span className="label">Passwort</span>
          <input name="password" type="password" className="input" autoComplete="new-password" placeholder={initial.hasPassword ? "•••••••• (unverändert lassen)" : ""} />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="secure" defaultChecked={initial.secure} className="h-4 w-4" />
          Verschlüsselte Verbindung (SSL/TLS, üblich bei Port 993)
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button disabled={pending} className="btn-primary">{pending ? "Speichern …" : "Speichern"}</button>
          <Status state={state} />
        </div>
      </form>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <button type="button" disabled={busy} className="btn-secondary" onClick={() => run(testImap)}>Verbindung testen</button>
        <button type="button" disabled={busy} className="btn-secondary" onClick={() => run(copyImapFromSmtp)}>Zugang vom SMTP übernehmen</button>
        {hasStored && (
          <button
            type="button"
            disabled={busy}
            className="btn-secondary"
            onClick={() => confirm("Gespeicherte Werte löschen und wieder die Server-Variablen verwenden?") && run(resetImapSettings)}
          >
            Auf Server-Variablen zurücksetzen
          </button>
        )}
        <Status state={other} />
      </div>
    </div>
  );
}
