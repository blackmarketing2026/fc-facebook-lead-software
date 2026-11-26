"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { sendTestStep, updateStep, type ChainState } from "@/app/actions/chains";
import { StatsRow, type StepStatsData } from "../email-chains/[id]/chain-editor";

export type EmailItemData = {
  id: string;
  subject: string;
  body: string;
  chainId: string;
  chainName: string;
  chainActive: boolean;
  position: number;
  total: number;
  stats: StepStatsData;
};

function Status({ state }: { state: ChainState }) {
  return (
    <>
      {state?.ok && <span className="text-sm text-green-700">{state.ok}</span>}
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
    </>
  );
}

export function EmailItem({ item, chainHref, testEmail, tracking }: { item: EmailItemData; chainHref: string; testEmail: string; tracking: boolean }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(item.subject);
  const [state, setState] = useState<ChainState>();
  const [pending, start] = useTransition();
  const [to, setTo] = useState(testEmail);
  const [testing, startTest] = useTransition();
  const [testState, setTestState] = useState<ChainState>();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateStep(item.id, undefined, form);
      setState(res);
      if (res?.ok) setSubject(String(form.get("subject") ?? "").trim());
    });
  };

  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="block truncate font-semibold">{subject || "(ohne Betreff)"}</span>
          <span className="block text-xs text-slate-500">
            E-Mail {item.position} von {item.total} in der Kette „{item.chainName}“
          </span>
        </button>
        <span className={`badge ${item.chainActive ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>{item.chainActive ? "aktiv" : "pausiert"}</span>
        <Link href={chainHref} className="text-sm text-blue-700 hover:underline">In der Kette öffnen →</Link>
      </div>
      <StatsRow stats={item.stats} tracking={tracking} />
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <label className="block">
            <span className="label">Betreff</span>
            <input name="subject" defaultValue={item.subject} maxLength={300} className="input" />
          </label>
          <label className="block">
            <span className="label">Text</span>
            <textarea name="body" defaultValue={item.body} rows={10} className="input font-mono text-sm" />
          </label>
          <p className="text-xs text-slate-500">Platzhalter: <code>{"{{vorname}}"}</code>, <code>{"{{name}}"}</code>, <code>{"{{email}}"}</code>. Der Abmelde-Link wird automatisch angehängt.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={pending} className="btn-primary">{pending ? "Speichern …" : "Speichern"}</button>
            <Status state={state} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} className="input !w-64 max-w-full" aria-label="Test-Empfänger" />
            <button type="button" disabled={testing} className="btn-secondary" onClick={() => startTest(async () => setTestState(await sendTestStep(item.id, to)))}>
              {testing ? "Sende …" : "Test-Mail senden"}
            </button>
            <Status state={testState} />
          </div>
        </form>
      )}
    </article>
  );
}
