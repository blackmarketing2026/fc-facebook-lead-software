"use client";

import { useActionState } from "react";
import { setPlatformGrants } from "@/app/actions/platform";

export function PlatformGrantForm({
  userId,
  selected,
  tenants,
}: {
  userId: string;
  selected: string[];
  tenants: { id: string; name: string; code: string }[];
}) {
  const [state, action, pending] = useActionState(setPlatformGrants.bind(null, userId), undefined);
  return (
    <details className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer font-medium">Stufe-2-Admin: Plattformen auswählen</summary>
      <form action={action} className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {tenants.map((tenant) => (
            <label key={tenant.id} className="flex items-center gap-2">
              <input type="checkbox" name="tenantId" value={tenant.id} defaultChecked={selected.includes(tenant.id)} className="h-4 w-4" />
              {tenant.name} <span className="text-slate-500">({tenant.code})</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500">Ohne Auswahl werden alle Stufe-2-Rechte entzogen.</p>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green-700">{state.ok}</p>}
        <button disabled={pending} className="btn-secondary px-3 py-1.5 text-xs">Rechte speichern</button>
      </form>
    </details>
  );
}
