"use client";

import Link from "next/link";
import { useActionState } from "react";
import { testDistribution } from "@/app/actions/settings";

type Props = {
  leads: { id: string; label: string }[];
  sales: { id: string; name: string }[];
  next: string | null;
};

export function DistributionTestForm({ leads, sales, next }: Props) {
  const [state, action, pending] = useActionState(testDistribution, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="block">
          <span className="label">Lead</span>
          <select name="leadId" required className="input" defaultValue="">
            <option value="" disabled>
              Lead auswählen …
            </option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Zuweisen an</span>
          <select name="target" className="input" defaultValue="auto">
            <option value="auto">Automatisch laut Verteilung{next ? ` (als Nächstes: ${next})` : ""}</option>
            {sales.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button disabled={pending} className="btn-primary">
        {pending ? "Zuweisen …" : "Zuweisen & benachrichtigen"}
      </button>

      {state?.ok === false && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && (
        <div className="space-y-1 rounded-lg bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
          <p className="font-medium text-green-700">
            ✓ Zugewiesen an {state.assignedTo}
            {state.auto ? " (automatisch laut Verteilung)" : " (manuell gewählt)"}
          </p>
          <p className={state.mailSent ? "text-green-700" : "text-amber-700"}>
            {state.mailSent ? "✓" : "⚠️"} {state.mail}
          </p>
          <p className="text-slate-600">
            {state.push > 0 ? `✓ Push an ${state.push} Gerät(e) geschickt.` : "Kein Push (für diesen Vertriebler ist kein Browser registriert)."}
          </p>
          <Link href={state.leadHref} className="text-blue-700 underline">
            Lead öffnen
          </Link>
        </div>
      )}
    </form>
  );
}
