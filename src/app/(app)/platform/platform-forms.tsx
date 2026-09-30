"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import {
  addDomain,
  addRoute,
  addTenantAdmin,
  createTenant,
  renameTenant,
  savePlatformSettings,
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

function AdminFields() {
  return (
    <>
      <label className="block">
        <span className="label">Name des Admins</span>
        <input name="adminDisplayName" required className="input" placeholder="Martin Mustermann" />
      </label>
      <label className="block">
        <span className="label">Benutzername</span>
        <input name="adminUsername" required className="input" placeholder="martin" autoComplete="off" />
      </label>
      <label className="block">
        <span className="label">E-Mail</span>
        <input name="adminEmail" type="email" required className="input" />
      </label>
      <label className="block">
        <span className="label">Startpasswort</span>
        <input name="adminPassword" type="password" required minLength={8} className="input" autoComplete="new-password" />
      </label>
    </>
  );
}

export function CreateTenantForm() {
  const [state, action, pending] = useActionState(createTenant, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="label">Name des Dashboards</span>
          <input name="name" required className="input" placeholder="Martin Versicherungsmakler" />
        </label>
        <label className="block">
          <span className="label">Kürzel</span>
          <input name="slug" required className="input" placeholder="martin" autoComplete="off" />
        </label>
        <label className="block">
          <span className="label">Domain (optional)</span>
          <input name="domain" className="input" placeholder="leads.martin-versicherung.de" autoComplete="off" />
        </label>
      </div>
      <h3 className="text-sm font-semibold text-slate-700">Erster Admin (Hauptnutzer des Kunden)</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminFields />
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

export function AddDomainForm({ tenantId }: { tenantId: string }) {
  const [state, action, pending] = useActionState(addDomain.bind(null, tenantId), undefined);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input name="domain" required className="input max-w-sm" placeholder="leads.martin-versicherung.de" autoComplete="off" />
        <button disabled={pending} className="btn-secondary">
          Domain hinzufügen
        </button>
      </div>
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

export function PlatformSettingsForm({ cnameTarget, aRecord }: { cnameTarget: string; aRecord: string }) {
  const [state, action, pending] = useActionState(savePlatformSettings, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">CNAME-Ziel (für Subdomains wie leads.kunde.de)</span>
          <input name="cnameTarget" required defaultValue={cnameTarget} className="input font-mono" />
        </label>
        <label className="block">
          <span className="label">A-Eintrag (für Hauptdomains wie kunde.de)</span>
          <input name="aRecord" required defaultValue={aRecord} className="input font-mono" />
        </label>
      </div>
      <Feedback state={state} />
      <button disabled={pending} className="btn-primary">
        {pending ? "Speichern …" : "Speichern"}
      </button>
    </form>
  );
}
