"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">
        <span className="label">E-Mail</span>
        <input name="email" inputMode="email" autoComplete="username" required className="input" autoFocus />
      </label>
      <label className="block">
        <span className="label">Passwort</span>
        <input name="password" type="password" autoComplete="current-password" required className="input" />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Anmelden …" : "Anmelden"}
      </button>
    </form>
  );
}
