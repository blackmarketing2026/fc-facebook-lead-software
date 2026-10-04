"use client";

import { useActionState, useState, useTransition } from "react";
import { saveLeadNotifyEmails, sendTestLeadMail, type SettingsState } from "@/app/actions/settings";

export function NotifyEmailsForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState(saveLeadNotifyEmails, undefined);
  return (
    <form action={action} className="space-y-3">
      <label htmlFor="emails" className="label">
        Empfänger
      </label>
      <textarea
        id="emails"
        name="emails"
        rows={3}
        defaultValue={initial}
        placeholder="vertrieb@firma.de"
        className="input"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-primary">
          {pending ? "Speichern …" : "Speichern"}
        </button>
        {state?.ok && <span className="text-sm text-green-700">{state.ok}</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export function TestMailButton({ disabled }: { disabled: boolean }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<SettingsState>();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => start(async () => setState(await sendTestLeadMail()))}
        className="btn-secondary"
      >
        {pending ? "Senden …" : "Test-Mail senden"}
      </button>
      {state?.ok && <span className="text-sm text-green-700">{state.ok}</span>}
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
    </div>
  );
}
