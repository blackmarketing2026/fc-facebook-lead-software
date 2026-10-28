"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { testDistribution } from "@/app/actions/settings";

type Props = {
  leads: { id: string; tenantId: string; label: string }[];
  sales: { id: string; tenantId: string; name: string }[];
  /** Wer in welchem Dashboard als Nächstes dran ist (Schlüssel: Mandanten-ID). */
  nextByTenant: Record<string, string | null>;
};

export function DistributionTestForm({ leads, sales, nextByTenant }: Props) {
  const [state, action, pending] = useActionState(testDistribution, undefined);
  const [leadId, setLeadId] = useState("");
  // Zugewiesen wird nur innerhalb des Dashboards, zu dem der Lead gehört.
  const tenantId = leads.find((l) => l.id === leadId)?.tenantId;
  const tenantSales = sales.filter((u) => u.tenantId === tenantId);
  const next = tenantId ? nextByTenant[tenantId] : null;
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="block">
          <span className="label">Lead</span>
          <select name="leadId" required className="input" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
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
          <select key={tenantId} name="target" className="input" defaultValue="auto">
            <option value="auto">Automatisch laut Verteilung{next ? ` (als Nächstes: ${next})` : ""}</option>
            {tenantSales.map((u) => (
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
