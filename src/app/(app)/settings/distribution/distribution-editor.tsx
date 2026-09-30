"use client";

import { useMemo, useState, useTransition } from "react";
import { saveDistribution, type SettingsState } from "@/app/actions/settings";
import { previewSequence } from "@/lib/distribution";

type Row = { id: string; displayName: string; active: boolean; distWeight: number; distPaused: boolean };

export function DistributionEditor({ users }: { users: Row[] }) {
  const [rows, setRows] = useState(users.map((u) => ({ ...u })));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [state, setState] = useState<SettingsState>();
  const [pending, start] = useTransition();

  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length || from === to) return;
    const next = [...rows];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setRows(next);
    setState(undefined);
  };
  const update = (i: number, patch: Partial<Row>) => {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setState(undefined);
  };

  // Vorschau mit frischen Zählern, genau so wie nach dem Speichern.
  const preview = useMemo(() => {
    const candidates = rows
      .map((r, i) => ({ id: r.id, distOrder: i, distWeight: r.distWeight, distCurrent: 0, eligible: r.active && !r.distPaused }))
      .filter((c) => c.eligible);
    const names = new Map(rows.map((r) => [r.id, r.displayName]));
    return previewSequence(candidates, 12).map((id) => names.get(id) ?? "?");
  }, [rows]);

  const totalWeight = rows.filter((r) => r.active && !r.distPaused).reduce((s, r) => s + r.distWeight, 0);

  if (rows.length === 0) {
    return <p className="card p-5 text-sm text-slate-500">Noch keine Vertriebler angelegt. Lege sie unter „Mitglieder“ an.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Reihenfolge</th>
              <th className="px-4 py-3">Vertriebler</th>
              <th className="px-4 py-3">Gewicht</th>
              <th className="px-4 py-3">Anteil</th>
              <th className="px-4 py-3">Pausiert</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => {
              const eligible = r.active && !r.distPaused;
              return (
                <tr
                  key={r.id}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) move(dragIndex, i);
                    setDragIndex(null);
                  }}
                  className={`${dragIndex === i ? "bg-blue-50" : ""} ${eligible ? "" : "text-slate-400"}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="cursor-grab select-none px-1 text-slate-400" title="Ziehen zum Sortieren">
                        ⠿
                      </span>
                      <span className="w-5 tabular-nums">{i + 1}.</span>
                      <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="btn-secondary px-2 py-0.5" aria-label="Nach oben">
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, i + 1)}
                        disabled={i === rows.length - 1}
                        className="btn-secondary px-2 py-0.5"
                        aria-label="Nach unten"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {r.displayName}
                    {!r.active && <span className="ml-2 text-xs font-normal">(deaktiviert)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={r.distWeight}
                      onChange={(e) => update(i, { distWeight: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
                      className="input w-20"
                    />
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {eligible && totalWeight > 0 ? `${Math.round((r.distWeight / totalWeight) * 100)} %` : "–"}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={r.distPaused}
                      onChange={(e) => update(i, { distPaused: e.target.checked })}
                      className="h-4 w-4"
                      aria-label={`${r.displayName} pausieren`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="card p-5">
        <h2 className="mb-2 font-semibold">Vorschau: die nächsten 12 Leads</h2>
        {preview.length === 0 ? (
          <p className="text-sm text-amber-700">⚠️ Kein Vertriebler aktiv, neue Leads bleiben unzugewiesen.</p>
        ) : (
          <ol className="flex flex-wrap gap-2">
            {preview.map((name, i) => (
              <li key={i} className="badge bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {i + 1}. {name}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="btn-primary"
          onClick={() =>
            start(async () => {
              setState(await saveDistribution(rows.map((r) => ({ id: r.id, weight: r.distWeight, paused: r.distPaused }))));
            })
          }
        >
          {pending ? "Speichern …" : "Verteilung speichern"}
        </button>
        {state?.ok && <span className="text-sm text-green-700">{state.ok}</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </div>
  );
}
