"use client";

import { useState, useTransition } from "react";

type State = { error?: string; ok?: string } | undefined;

/** "Mitglied entfernen" mit Sicherheitsabfrage; die Server-Action ist schon an das Mitglied gebunden. */
export function RemoveMemberButton({ action, name }: { action: () => Promise<State>; name: string }) {
  const [state, setState] = useState<State>(undefined);
  const [pending, startTransition] = useTransition();
  function remove() {
    const ok = window.confirm(
      `${name} wirklich entfernen?\n\nDas Mitglied hat danach keinen Zugang mehr zum Dashboard. Seine Leads werden freigegeben (nicht zugewiesen), seine Termine gelöscht. Notizen bleiben erhalten.`,
    );
    if (!ok) return;
    startTransition(async () => setState(await action()));
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        {pending ? "Entfernen …" : "Mitglied entfernen"}
      </button>
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state?.ok && <span className="text-sm text-green-700">{state.ok}</span>}
    </div>
  );
}
