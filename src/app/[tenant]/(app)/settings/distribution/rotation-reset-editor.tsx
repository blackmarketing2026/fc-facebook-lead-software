"use client";

import { useState, useTransition } from "react";
import { resetDistributionRotation, type SettingsState } from "@/app/actions/settings";
import { previewSequence, rotationStartState } from "@/lib/distribution";

type Member = { id: string; tenantId: string; displayName: string; active: boolean; distPaused: boolean; distWeight: number; distOrder: number };
type Tenant = { id: string; name: string; distributionPaused: boolean };

export function RotationResetEditor({ tenants, members }: { tenants: Tenant[]; members: Member[] }) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [order, setOrder] = useState(() => members.filter((member) => member.tenantId === (tenants[0]?.id ?? "")).map((member) => member.id));
  const [firstId, setFirstId] = useState("");
  const [state, setState] = useState<SettingsState>();
  const [pending, start] = useTransition();
  const tenant = tenants.find((item) => item.id === tenantId);
  const byId = new Map(members.map((member) => [member.id, member]));
  const rows = order.map((id) => byId.get(id)).filter((item): item is Member => Boolean(item));
  const eligible = rows.filter((member) => member.active && !member.distPaused && member.distWeight > 0);
  const candidates = eligible.map((member, distOrder) => ({ id: member.id, distOrder, distWeight: member.distWeight, distCurrent: 0 }));
  const preview = previewSequence(rotationStartState(candidates, firstId || null), 8).map((id) => byId.get(id)?.displayName ?? "?");

  function move(index: number, direction: -1 | 1) {
    const next = [...order];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setState(undefined);
  }

  return <div className="space-y-4">
    {tenants.length > 1 && <label className="block max-w-md"><span className="label">Plattform</span><select className="input" value={tenantId} onChange={(event) => { const id = event.target.value; setTenantId(id); setOrder(members.filter((member) => member.tenantId === id).map((member) => member.id)); setFirstId(""); setState(undefined); }}>{tenants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {tenant?.distributionPaused && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Die Rotation dieser Plattform ist gestoppt. Die gewählte Startperson wird erst nach dem Starten der Rotation berücksichtigt.</p>}
    {rows.length === 0 ? <p className="text-sm text-slate-500">Für diese Plattform gibt es noch keine Vertriebler in der Verteilung.</p> : <>
      <div><h3 className="mb-2 text-sm font-semibold">Reihenfolge festlegen</h3><ol className="space-y-2">{rows.map((member, index) => <li key={member.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5"><span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-white text-sm font-semibold">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{member.displayName}<span className="ml-2 text-xs font-normal text-slate-500">{!member.active ? "deaktiviert" : member.distPaused ? "pausiert" : member.distWeight === 0 ? "0 %" : `${member.distWeight} %`}</span></span><button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="btn-secondary px-2 py-1" aria-label={`${member.displayName} nach oben`}>↑</button><button type="button" disabled={index === rows.length - 1} onClick={() => move(index, 1)} className="btn-secondary px-2 py-1" aria-label={`${member.displayName} nach unten`}>↓</button></li>)}</ol></div>
      <label className="block max-w-md"><span className="label">Wer bekommt den ersten Lead?</span><select className="input" value={firstId} onChange={(event) => { setFirstId(event.target.value); setState(undefined); }}><option value="">Automatisch nach Gewicht und Reihenfolge</option>{eligible.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label>
      <div className="rounded-xl bg-[var(--accent-soft)] p-4"><p className="mb-2 text-sm font-semibold">Vorschau der nächsten 8 Leads</p><div className="flex flex-wrap gap-2">{preview.map((name, index) => <span key={index} className="badge bg-white px-2.5 py-1">{index + 1}. {name}</span>)}{preview.length === 0 && <span className="text-sm text-slate-600">Niemand ist aktuell verfügbar.</span>}</div></div>
    </>}
    <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={pending || !tenantId} className="btn-primary" onClick={() => start(async () => setState(await resetDistributionRotation({ tenantId, orderIds: order, firstId: firstId || null })))}>{pending ? "Setze zurück …" : "Rotation zurücksetzen"}</button>{state?.ok && <span role="status" className="text-sm text-green-700">{state.ok}</span>}{state?.error && <span role="alert" className="text-sm text-red-700">{state.error}</span>}</div>
    <p className="text-xs text-slate-500">Setzt nur die Rotationszähler zurück und speichert die Reihenfolge. Vorhandene Leads, Termine und Verteilungsanteile bleiben erhalten.</p>
  </div>;
}
