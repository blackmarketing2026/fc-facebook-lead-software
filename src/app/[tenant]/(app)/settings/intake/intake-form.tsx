"use client";

import { useActionState } from "react";
import { saveSubjectKeywords } from "@/app/actions/settings";

export function IntakeForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState(saveSubjectKeywords, undefined);
  return (
    <form action={action} className="space-y-3">
      <label htmlFor="keywords" className="label">
        Stichwörter im Betreff
      </label>
      <textarea id="keywords" name="keywords" rows={4} defaultValue={initial} placeholder="Neuer Lead" className="input" />
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
