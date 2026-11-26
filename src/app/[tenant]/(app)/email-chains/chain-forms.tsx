"use client";

import { useActionState } from "react";
import { createChain, saveAutoTag } from "@/app/actions/chains";

export function NewChainForm({ existingTags, defaultTag }: { existingTags: string[]; defaultTag: string }) {
  const [state, action, pending] = useActionState(createChain, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="label">Name der Kette</span>
        <input name="name" required maxLength={120} placeholder="Willkommens-Kette" className="input" />
      </label>
      <label className="block">
        <span className="label">Start-Tag (Kette startet, wenn ein Lead diesen Tag bekommt)</span>
        <input name="tag" required maxLength={80} list="known-tags" defaultValue={defaultTag} className="input" />
        <datalist id="known-tags">
          {existingTags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="btn-primary">{pending ? "Anlegen …" : "Kette anlegen"}</button>
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export function AutoTagForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState(saveAutoTag, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="label">Tag</span>
        <input name="tag" defaultValue={initial} maxLength={80} className="input" />
      </label>
      <button disabled={pending} className="btn-secondary">{pending ? "Speichern …" : "Speichern"}</button>
      {state?.ok && <span className="text-sm text-green-700">{state.ok}</span>}
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
