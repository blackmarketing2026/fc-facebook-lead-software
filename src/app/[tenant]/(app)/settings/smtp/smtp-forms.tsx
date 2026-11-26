"use client";

import { useActionState, useState, useTransition } from "react";
import { resetSmtpSettings, saveSmtpSettings, testSmtp, type SettingsState } from "@/app/actions/settings";

type Initial = { host: string; port: number; secure: boolean; user: string; from: string; hasPassword: boolean };

function Status({ state }: { state: SettingsState }) {
  return (
    <>
      {state?.ok && <span className="text-sm text-green-700">{state.ok}</span>}
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
    </>
  );
}

export function SmtpForm({ initial }: { initial: Initial }) {
  const [state, action, pending] = useActionState(saveSmtpSettings, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="label">Server (Host)</span>
        <input name="host" required defaultValue={initial.host} placeholder="smtp.example.com" className="input" autoComplete="off" />
      </label>
      <label className="block">
        <span className="label">Port</span>
        <input name="port" type="number" required defaultValue={initial.port} className="input" />
      </label>
      <label className="block">
        <span className="label">Benutzer</span>
        <input name="user" required defaultValue={initial.user} className="input" autoComplete="off" />
      </label>
      <label className="block">
        <span className="label">Passwort</span>
        <input
          name="password"
          type="password"
          className="input"
          autoComplete="new-password"
          placeholder={initial.hasPassword ? "•••••••• (unverändert lassen)" : ""}
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="label">Absender (From)</span>
        <input name="from" defaultValue={initial.from} placeholder="Function Concept <leads@example.com>" className="input" />
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="secure" defaultChecked={initial.secure} className="h-4 w-4" />
        Verschlüsselte Verbindung von Anfang an (SSL/TLS, üblich bei Port 465)
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="btn-primary">
          {pending ? "Speichern …" : "Speichern"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function SmtpTestForm({ defaultTo }: { defaultTo: string }) {
  const [state, action, pending] = useActionState(testSmtp, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="label">Test-Mail an</span>
        <input name="to" type="email" defaultValue={defaultTo} className="input" />
      </label>
      <button disabled={pending} className="btn-secondary">
        {pending ? "Teste …" : "Testen"}
      </button>
      <Status state={state} />
    </form>
  );
}

export function ResetSmtpButton() {
  const [pending, start] = useTransition();
  const [state, setState] = useState<SettingsState>();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className="btn-secondary"
        onClick={() => confirm("Gespeicherte Werte löschen und wieder die Server-Variablen verwenden?") && start(async () => setState(await resetSmtpSettings()))}
      >
        Auf Server-Variablen zurücksetzen
      </button>
      <Status state={state} />
    </div>
  );
}
