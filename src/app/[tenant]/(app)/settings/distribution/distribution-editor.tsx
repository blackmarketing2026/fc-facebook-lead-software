"use client";

import { useMemo, useState, useTransition } from "react";
import { saveDistribution, type SettingsState } from "@/app/actions/settings";
import { previewSequence } from "@/lib/distribution";
import { evenSplit, maxShare, normalize, setShare, toPercents } from "@/lib/percent-split";

type User = { id: string; displayName: string; active: boolean; distWeight: number; distPaused: boolean };
type Row = User & { percent: number; locked: boolean };

const eligibleOf = (rows: Row[]) => rows.map((r) => r.active && !r.distPaused);
const lockedOf = (rows: Row[]) => rows.map((r) => r.locked);
const withPercents = (rows: Row[], percents: number[]) => rows.map((r, i) => ({ ...r, percent: percents[i] }));

export function DistributionEditor({ users }: { users: User[] }) {
  const [rows, setRows] = useState<Row[]>(() => {
    const base = users.map((u) => ({ ...u, percent: 0, locked: false }));
    // Gespeicherte Gewichte (auch alte 1/2/3-Werte) als Prozent anzeigen.
    return withPercents(base, toPercents(base.map((r) => r.distWeight), eligibleOf(base)));
  });
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [state, setState] = useState<SettingsState>();
  const [pending, start] = useTransition();

  const change = (next: Row[]) => {
    setRows(next);
    setState(undefined);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length || from === to) return;
    const next = [...rows];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    change(next);
  };
  const setPercent = (i: number, value: number) =>
    change(withPercents(rows, setShare(rows.map((r) => r.percent), eligibleOf(rows), lockedOf(rows), i, value)));
  const toggleLock = (i: number) => change(rows.map((r, idx) => (idx === i ? { ...r, locked: !r.locked } : r)));
  const togglePause = (i: number, paused: boolean) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, distPaused: paused, locked: false } : r));
    const eligible = eligibleOf(next);
    const values = next.map((r) => r.percent);
    if (paused) return change(withPercents(next, normalize(values, eligible, lockedOf(next))));
    // Zurück aus der Pause: fairer Anteil, die anderen machen anteilig Platz.
    const fair = Math.round(100 / eligible.filter(Boolean).length);
    change(withPercents(next, setShare(values, eligible, lockedOf(next), i, fair)));
  };
  const splitEvenly = () => change(withPercents(rows, evenSplit(rows.map((r) => r.percent), eligibleOf(rows), lockedOf(rows))));

  // Vorschau mit frischen Zählern, genau so wie nach dem Speichern.
  const preview = useMemo(() => {
    const candidates = rows
      .map((r, i) => ({ id: r.id, distOrder: i, distWeight: r.percent, distCurrent: 0, eligible: r.active && !r.distPaused }))
      .filter((c) => c.eligible);
    const names = new Map(rows.map((r) => [r.id, r.displayName]));
    return previewSequence(candidates, 12).map((id) => names.get(id) ?? "?");
  }, [rows]);

  const eligible = eligibleOf(rows);
  const total = rows.reduce((s, r, i) => (eligible[i] ? s + r.percent : s), 0);

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
              <th className="w-1/2 px-4 py-3">Anteil der Leads</th>
              <th className="px-4 py-3">Pausiert</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => {
              const max = maxShare(rows.map((x) => x.percent), eligible, lockedOf(rows), i);
              const fixed = !eligible[i] || r.locked || rows.every((x, j) => j === i || !eligible[j] || x.locked);
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
                  className={`${dragIndex === i ? "bg-blue-50" : ""} ${eligible[i] ? "" : "text-slate-400"}`}
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
                  <td className="whitespace-nowrap px-4 py-3 font-medium">
                    {r.displayName}
                    {!r.active && <span className="ml-2 text-xs font-normal">(deaktiviert)</span>}
                  </td>
                  <td className="px-4 py-3">
                    {eligible[i] ? (
                      <div className="flex min-w-64 items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={r.percent}
                          disabled={fixed}
                          onChange={(e) => setPercent(i, Number(e.target.value))}
                          className="h-2 flex-1 cursor-pointer accent-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Anteil ${r.displayName}`}
                          title={r.locked ? "Gesperrt" : `0–${max} % möglich`}
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={r.percent}
                            disabled={fixed}
                            onChange={(e) => setPercent(i, Number(e.target.value) || 0)}
                            className="input w-16 px-2 py-1 text-right tabular-nums"
                            aria-label={`Anteil ${r.displayName} in Prozent`}
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleLock(i)}
                          className={`rounded-md px-2 py-1 text-base ${r.locked ? "bg-amber-100" : "hover:bg-slate-100"}`}
                          title={r.locked ? "Entsperren" : "Anteil festhalten – wird beim Verschieben der anderen nicht verändert"}
                          aria-label={r.locked ? `${r.displayName} entsperren` : `${r.displayName} sperren`}
                          aria-pressed={r.locked}
                        >
                          {r.locked ? "🔒" : "🔓"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs">{r.active ? "Pausiert – bekommt keine Leads" : "Deaktiviert – bekommt keine Leads"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={r.distPaused}
                      onChange={(e) => togglePause(i, e.target.checked)}
                      className="h-4 w-4"
                      aria-label={`${r.displayName} pausieren`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50 text-sm">
            <tr>
              <td colSpan={2} className="px-4 py-3">
                <button type="button" onClick={splitEvenly} className="btn-secondary py-1">
                  Gleichmäßig verteilen
                </button>
              </td>
              <td className="px-4 py-3 font-medium tabular-nums">
                Summe: {eligible.some(Boolean) ? `${total} %` : "–"}
              </td>
              <td />
            </tr>
          </tfoot>
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
              setState(
                await saveDistribution(
                  // Pausierte/deaktivierte behalten ihr altes Gewicht; alle anderen speichern ihren Prozentwert.
                  rows.map((r, i) => ({ id: r.id, weight: eligible[i] ? r.percent : r.distWeight, paused: r.distPaused })),
                ),
              );
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
