"use client";

import { useActionState, useState } from "react";
import { login } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form action={action} className="login-form">
      <label className="block">
        <span className="label">E-Mail-Adresse</span>
        <input name="email" type="text" inputMode="email" autoComplete="username" required className="input" placeholder="name@beispiel.de" autoFocus />
      </label>
      <div><label htmlFor="login-password" className="label">Passwort</label><div className="login-password-wrap"><input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required className="input" placeholder="Dein Passwort" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"} aria-pressed={showPassword}>{showPassword ? "Verbergen" : "Anzeigen"}</button></div></div>
      {state?.error && <p role="alert" className="login-error">{state.error}</p>}
      <button type="submit" disabled={pending} className="login-submit">
        {pending ? "Anmeldung läuft …" : "Jetzt anmelden"}<span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
