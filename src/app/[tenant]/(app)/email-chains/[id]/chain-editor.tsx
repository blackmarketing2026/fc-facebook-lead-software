"use client";

import { useActionState, useState, useTransition } from "react";
import { addStep, deleteChain, deleteStep, moveStep, sendTestStep, setChainActive, updateChain, updateStep, type ChainState } from "@/app/actions/chains";

type Step = { id: string; type: "EMAIL" | "WAIT"; subject: string; body: string; waitValue: number; waitUnit: "MINUTES" | "HOURS" | "DAYS" };
type Chain = { id: string; name: string; active: boolean; tag: string };

const UNITS: Record<Step["waitUnit"], string> = { MINUTES: "Minuten", HOURS: "Stunden", DAYS: "Tage" };

function Status({ state }: { state: ChainState }) {
  return (
    <>
      {state?.ok && <span className="text-sm text-green-700">{state.ok}</span>}
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
    </>
  );
}

export function ChainEditor({ chain, steps, knownTags, testEmail }: { chain: Chain; steps: Step[]; knownTags: string[]; testEmail: string }) {
  const [settings, settingsAction, settingsPending] = useActionState(updateChain.bind(null, chain.id), undefined);
  const [busy, start] = useTransition();
  const [info, setInfo] = useState<ChainState>();
  const run = (fn: () => Promise<ChainState | void>) =>
    start(async () => {
      const res = await fn();
      setInfo(res ?? undefined);
    });

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{chain.name}</h1>
          <span className={`badge ${chain.active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>{chain.active ? "aktiv" : "pausiert"}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" disabled={busy} className={chain.active ? "btn-secondary" : "btn-primary"} onClick={() => run(() => setChainActive(chain.id, !chain.active))}>
              {chain.active ? "Pausieren" : "Kette aktivieren"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="btn-secondary text-red-700"
              onClick={() => confirm(`Kette „${chain.name}“ mit allen Läufen löschen?`) && run(() => deleteChain(chain.id))}
            >
              Löschen
            </button>
          </div>
        </div>
        <Status state={info} />
        <form action={settingsAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="label">Name</span>
            <input name="name" defaultValue={chain.name} required maxLength={120} className="input" />
          </label>
          <label className="block">
            <span className="label">Start-Tag</span>
            <input name="tag" defaultValue={chain.tag} required maxLength={80} list="chain-tags" className="input" />
            <datalist id="chain-tags">
              {knownTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
          <button disabled={settingsPending} className="btn-secondary">{settingsPending ? "…" : "Speichern"}</button>
          <div className="sm:col-span-3"><Status state={settings} /></div>
        </form>
        <p className="text-xs text-slate-500">
          Die Kette startet für Leads, die den Start-Tag ab dem Aktivieren bekommen – bereits getaggte Leads werden nicht nachträglich gestartet.
          Jeder Lead durchläuft die Kette nur einmal. In jeder Mail steht ein Abmelde-Link.
        </p>
      </section>

      {/* Grafische Schrittkette */}
      <section className="mx-auto flex w-full max-w-xl flex-col items-stretch">
        <div className="mx-auto flex items-center gap-2 rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow">
          ▶ Start · Tag „{chain.tag}“ wird vergeben
        </div>
        <Connector index={0} chainId={chain.id} />
        {steps.map((step, i) => (
          <div key={step.id} className="flex flex-col items-stretch">
            <StepCard step={step} index={i} total={steps.length} testEmail={testEmail} />
            <Connector index={i + 1} chainId={chain.id} />
          </div>
        ))}
        {steps.length === 0 && <p className="mb-2 text-center text-xs text-slate-400">Noch keine Schritte – füge mit „+“ eine E-Mail oder Wartezeit hinzu.</p>}
        <div className="mx-auto flex items-center gap-2 rounded-full bg-slate-800 px-5 py-2 text-sm font-semibold text-white shadow">■ Ende</div>
      </section>
    </div>
  );
}

function Connector({ index, chainId }: { index: number; chainId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const add = (type: "EMAIL" | "WAIT") => {
    setOpen(false);
    start(async () => void (await addStep(chainId, index, type)));
  };
  return (
    <div className="relative mx-auto flex h-14 w-full flex-col items-center">
      <div className="h-full w-px bg-slate-300" />
      <div className="absolute inset-0 flex items-center justify-center">
        {open ? (
          <div className="flex gap-2 rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200">
            <button type="button" className="btn-secondary !px-3 !py-1.5 text-sm" onClick={() => add("EMAIL")}>✉️ E-Mail</button>
            <button type="button" className="btn-secondary !px-3 !py-1.5 text-sm" onClick={() => add("WAIT")}>⏱ Wartezeit</button>
            <button type="button" aria-label="Abbrechen" className="px-2 text-slate-400" onClick={() => setOpen(false)}>✕</button>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            aria-label="Schritt hinzufügen"
            onClick={() => setOpen(true)}
            className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg font-semibold text-slate-500 shadow ring-1 ring-slate-300 hover:bg-slate-50 hover:text-slate-800"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}

function StepControls({ step, index, total }: { step: Step; index: number; total: number }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1 text-slate-500">
      <button type="button" disabled={pending || index === 0} aria-label="Nach oben" className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => start(async () => void (await moveStep(step.id, -1)))}>↑</button>
      <button type="button" disabled={pending || index === total - 1} aria-label="Nach unten" className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30" onClick={() => start(async () => void (await moveStep(step.id, 1)))}>↓</button>
      <button
        type="button"
        disabled={pending}
        aria-label="Schritt löschen"
        className="rounded px-2 py-1 text-red-600 hover:bg-red-50"
        onClick={() => confirm("Diesen Schritt löschen?") && start(async () => void (await deleteStep(step.id)))}
      >
        🗑
      </button>
    </div>
  );
}

function StepCard({ step, index, total, testEmail }: { step: Step; index: number; total: number; testEmail: string }) {
  const [state, action, pending] = useActionState(updateStep.bind(null, step.id), undefined);

  if (step.type === "WAIT") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-amber-900">⏱ Wartezeit</span>
          <StepControls step={step} index={index} total={total} />
        </div>
        <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-amber-900">Warte</span>
          <input name="waitValue" type="number" min={1} defaultValue={step.waitValue} className="input !w-24" aria-label="Dauer" />
          <select name="waitUnit" defaultValue={step.waitUnit} className="input !w-auto" aria-label="Einheit">
            {Object.entries(UNITS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button disabled={pending} className="btn-secondary !py-1.5 text-sm">{pending ? "…" : "Speichern"}</button>
          <Status state={state} />
        </form>
      </div>
    );
  }

  return <EmailCard step={step} index={index} total={total} testEmail={testEmail} state={state} action={action} pending={pending} />;
}

function EmailCard({ step, index, total, testEmail, state, action, pending }: { step: Step; index: number; total: number; testEmail: string; state: ChainState; action: (payload: FormData) => void; pending: boolean }) {
  const [open, setOpen] = useState(!step.subject);
  const [to, setTo] = useState(testEmail);
  const [testing, startTest] = useTransition();
  const [testState, setTestState] = useState<ChainState>();
  return (
    <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="text-sm font-semibold text-blue-900">✉️ E-Mail</span>
          <span className="block truncate text-sm text-slate-600">{step.subject || "Noch kein Betreff – zum Bearbeiten öffnen"}</span>
        </button>
        <StepControls step={step} index={index} total={total} />
      </div>
      {open && (
        <form action={action} className="mt-3 space-y-3">
          <label className="block">
            <span className="label">Betreff</span>
            <input name="subject" defaultValue={step.subject} maxLength={300} className="input" placeholder="Willkommen, {{vorname}}!" />
          </label>
          <label className="block">
            <span className="label">Text</span>
            <textarea name="body" defaultValue={step.body} rows={9} className="input font-mono text-sm" placeholder={"Hallo {{vorname}},\n\nvielen Dank für deine Anfrage …"} />
          </label>
          <p className="text-xs text-slate-500">Platzhalter: <code>{"{{vorname}}"}</code>, <code>{"{{name}}"}</code>, <code>{"{{email}}"}</code>. Der Abmelde-Link wird automatisch angehängt.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={pending} className="btn-primary">{pending ? "Speichern …" : "Speichern"}</button>
            <Status state={state} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} className="input !w-64 max-w-full" aria-label="Test-Empfänger" />
            <button type="button" disabled={testing} className="btn-secondary" onClick={() => startTest(async () => setTestState(await sendTestStep(step.id, to)))}>
              {testing ? "Sende …" : "Test-Mail senden"}
            </button>
            <Status state={testState} />
          </div>
        </form>
      )}
    </div>
  );
}
