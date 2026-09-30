"use client";

import { useActionState, useState, useTransition } from "react";
import { manualImport, reprocessInboundAction, type SettingsState } from "@/app/actions/settings";

const EXAMPLE = `[{"name":"Sprache","values":["Deutsch"]},{"name":"welche_bausteine_benötigst_du_für_deinen_rechtschutz?","values":["privatrechtsschutz"]},{"name":"email","values":["max@example.com"]},{"name":"full_name","values":["Max Mustermann"]},{"name":"phone_number","values":["+491701234567"]}]`;

export function ManualImportForm() {
  const [state, action, pending] = useActionState(manualImport, undefined);
  const [value, setValue] = useState("");
  return (
    <form action={action} className="space-y-3">
      <textarea
        name="json"
        rows={4}
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={EXAMPLE}
        className="input font-mono text-xs"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-primary">
          {pending ? "Importieren …" : "Importieren"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setValue(EXAMPLE)}>
          Beispiel einfügen
        </button>
        {state?.ok && <span className="text-sm text-green-700">{state.ok}</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export function ReprocessButton({ inboundId }: { inboundId: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<SettingsState>();
  return (
    <div className="space-y-1">
      <button
        disabled={pending}
        onClick={() => start(async () => setState(await reprocessInboundAction(inboundId)))}
        className="btn-secondary whitespace-nowrap px-2 py-1 text-xs"
      >
        Erneut verarbeiten
      </button>
      {state?.error && <div className="text-xs text-red-600">{state.error}</div>}
    </div>
  );
}
