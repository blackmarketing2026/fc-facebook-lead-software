"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import {
  addRoute,
  addTenantAdmin,
  createTenant,
  renameTenant,
  setFeature,
  type PlatformState,
} from "@/app/actions/platform";
import { ROUTE_TYPE_LABELS } from "@/lib/lead-routing";

function Feedback({ state }: { state: PlatformState }) {
  if (state?.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-green-700">{state.ok}</p>;
  return null;
}

/** Setzt das Formular nach Erfolg zurück. */
function useResetOnOk(state: PlatformState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

function AdminFields({ optional = false }: { optional?: boolean }) {
  const required = !optional;
  return (
    <>
      <label className="block">
        <span className="label">Name des Admins</span>
        <input name="adminDisplayName" required={required} className="input" placeholder="Martin Mustermann" />
      </label>
      <label className="block">
        <span className="label">Benutzername</span>
        <input name="adminUsername" required={required} className="input" placeholder="martin" autoComplete="off" />
      </label>
      <label className="block">
        <span className="label">E-Mail</span>
        <input name="adminEmail" type="email" required={required} className="input" />
      </label>
      <label className="block">
        <span className="label">Startpasswort</span>
        <input name="adminPassword" type="password" required={required} minLength={8} className="input" autoComplete="new-password" />
      </label>
    </>
  );
}

export function CreateTenantForm() {
  const [state, action, pending] = useActionState(createTenant, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Name des Dashboards</span>
          <input name="name" required className="input" placeholder="Martin Versicherungsmakler" />
        </label>
        <label className="block">
          <span className="label">Kürzel (Adresse: /kürzel)</span>
          <input name="slug" required className="input" placeholder="martin" autoComplete="off" pattern="[a-z0-9-]+" />
        </label>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-700">Erster Admin (optional)</h3>
        <p className="text-xs text-slate-500">
          Leer lassen, um das Dashboard ohne eigenen Login anzulegen – du öffnest es über den Master-Login und kannst
          Admins später hinzufügen.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminFields optional />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="isDevelopment" className="h-4 w-4" />
        Entwicklungs-Mandant (alle Feature-Schalter automatisch aktiv)
      </label>
      <Feedback state={state} />
      <button disabled={pending} className="btn-primary">
        {pending ? "Anlegen …" : "Dashboard anlegen"}
      </button>
    </form>
  );
}

export function RenameTenantForm({ tenantId, name, isDevelopment }: { tenantId: string; name: string; isDevelopment: boolean }) {
  const [state, action, pending] = useActionState(renameTenant.bind(null, tenantId), undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="label">Name</span>
        <input name="name" required defaultValue={name} className="input" />
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
        <input type="checkbox" name="isDevelopment" defaultChecked={isDevelopment} className="h-4 w-4" />
        Entwicklungs-Mandant
      </label>
      <button disabled={pending} className="btn-secondary">
        Speichern
      </button>
      <Feedback state={state} />
    </form>
  );
}


export function AddRouteForm({ tenantId }: { tenantId: string }) {
  const [state, action, pending] = useActionState(addRoute.bind(null, tenantId), undefined);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[auto_1fr_6rem_auto]">
        <select name="type" className="input" defaultValue="RECIPIENT">
          {Object.entries(ROUTE_TYPE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <input name="pattern" required className="input" placeholder="martin@function-concept.com  oder  mandant=martin" />
        <input name="priority" type="number" defaultValue={0} className="input" aria-label="Priorität" title="Priorität" />
        <button disabled={pending} className="btn-secondary">
          Regel hinzufügen
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function AddAdminForm({ tenantId }: { tenantId: string }) {
  const [state, action, pending] = useActionState(addTenantAdmin.bind(null, tenantId), undefined);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminFields />
      </div>
      <Feedback state={state} />
      <button disabled={pending} className="btn-secondary">
        Admin anlegen
      </button>
    </form>
  );
}

export function FeatureToggle({ tenantId, featureKey, enabled, forced }: { tenantId: string; featureKey: string; enabled: boolean; forced: boolean }) {
  const [pending, start] = useTransition();
  return (
    <input
      type="checkbox"
      className="h-4 w-4"
      checked={forced || enabled}
      disabled={forced || pending}
      title={forced ? "Im Entwicklungs-Mandanten immer aktiv" : undefined}
      onChange={(e) => {
        const next = e.target.checked;
        start(() => setFeature(tenantId, featureKey, next));
      }}
    />
  );
}
