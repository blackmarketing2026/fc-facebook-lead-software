"use client";

import type { Role } from "@prisma/client";
import { useActionState, useEffect, useRef } from "react";
import { createUser, updateUser, type SettingsState } from "@/app/actions/settings";

type UserData = { id: string; username: string; email: string; displayName: string; role: Role; active: boolean };

function Feedback({ state }: { state: SettingsState }) {
  if (state?.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-green-700">{state.ok}</p>;
  return null;
}

function Fields({ user, passwordRequired }: { user?: UserData; passwordRequired: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block">
        <span className="label">Anzeigename</span>
        <input name="displayName" required defaultValue={user?.displayName} className="input" placeholder="Martin" />
      </label>
      <label className="block">
        <span className="label">Benutzername</span>
        <input name="username" required defaultValue={user?.username} className="input" placeholder="martin" autoComplete="off" />
      </label>
      <label className="block">
        <span className="label">E-Mail</span>
        <input name="email" type="email" required defaultValue={user?.email} className="input" />
      </label>
      <label className="block">
        <span className="label">{passwordRequired ? "Passwort" : "Neues Passwort (leer = unverändert)"}</span>
        <input
          name="password"
          type="password"
          required={passwordRequired}
          minLength={8}
          className="input"
          autoComplete="new-password"
        />
      </label>
      <label className="block">
        <span className="label">Rolle</span>
        <select name="role" defaultValue={user?.role ?? "SALES"} className="input">
          <option value="SALES">Vertrieb</option>
          <option value="ADMIN">Admin</option>
        </select>
      </label>
    </div>
  );
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-4">
      <Fields passwordRequired />
      <Feedback state={state} />
      <button disabled={pending} className="btn-primary">
        {pending ? "Anlegen …" : "Mitglied anlegen"}
      </button>
    </form>
  );
}

export function EditUserForm({ user, isSelf }: { user: UserData; isSelf: boolean }) {
  const [state, action, pending] = useActionState(updateUser.bind(null, user.id), undefined);
  return (
    <form action={action} className="space-y-4">
      <Fields user={user} passwordRequired={false} />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="active" defaultChecked={user.active} disabled={isSelf} className="h-4 w-4" />
        Aktiv (kann sich anmelden und bekommt Leads)
        {isSelf && <input type="hidden" name="active" value="on" />}
      </label>
      <Feedback state={state} />
      <button disabled={pending} className="btn-primary">
        {pending ? "Speichern …" : "Speichern"}
      </button>
    </form>
  );
}
