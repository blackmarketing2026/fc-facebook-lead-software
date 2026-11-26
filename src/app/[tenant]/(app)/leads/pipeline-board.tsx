"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { createStage, deleteLead, deleteStage, moveLeadToStage, moveStage, renameStage, setDefaultStage } from "@/app/actions/pipeline";

export type BoardStage = { id: string; name: string; isDefault: boolean };
export type BoardLead = { id: string; fullName: string | null; phone: string | null; email: string | null; receivedAt: string; stageId: string | null; optOut: boolean };

type Op = { type: "move"; id: string; stageId: string } | { type: "delete"; id: string };

const ACCENTS = ["#2563eb", "#d97706", "#7c3aed", "#059669", "#db2777", "#0891b2", "#65a30d", "#dc2626"];

function initials(name: string | null) {
  const parts = (name ?? "?").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
}

export function PipelineBoard({ stages, leads, base, isAdmin }: { stages: BoardStage[]; leads: BoardLead[]; base: string; isAdmin: boolean }) {
  const [, startTransition] = useTransition();
  const [optimistic, apply] = useOptimistic(leads, (current, op: Op) =>
    op.type === "move" ? current.map((l) => (l.id === op.id ? { ...l, stageId: op.stageId } : l)) : current.filter((l) => l.id !== op.id),
  );
  const [menu, setMenu] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Menü schließen bei Klick daneben oder Escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("click", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", key);
    };
  }, [menu]);

  function run(op: Op | null, action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      if (op) apply(op);
      const res = await action();
      if (res.error) setError(res.error);
    });
  }

  const move = (leadId: string, stageId: string) => {
    const lead = optimistic.find((l) => l.id === leadId);
    if (!lead || lead.stageId === stageId) return;
    run({ type: "move", id: leadId, stageId }, () => moveLeadToStage(leadId, stageId));
  };

  const remove = (lead: BoardLead) => {
    if (!confirm(`„${lead.fullName ?? "Unbekannt"}“ endgültig löschen? Notizen, Termine und Verlauf gehen verloren.`)) return;
    run({ type: "delete", id: lead.id }, () => deleteLead(lead.id));
  };

  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name;
  const defaultId = stages.find((s) => s.isDefault)?.id;

  return (
    <div className="space-y-3">
      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
      {/* Mobil: Sprungleiste zu den Phasen */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden" aria-label="Phasen">
        {stages.map((stage) => {
          const count = optimistic.filter((l) => (l.stageId ?? defaultId) === stage.id).length;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => document.getElementById(`stage-col-${stage.id}`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" })}
              className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200"
            >
              {stage.name} <span className="tabular-nums text-slate-400">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="flex snap-x snap-mandatory items-start gap-3 overflow-x-auto pb-4 md:snap-none md:gap-4">
        {stages.map((stage, index) => {
          const cards = optimistic.filter((l) => (l.stageId ?? defaultId) === stage.id);
          const accent = ACCENTS[index % ACCENTS.length];
          return (
            <section
              key={stage.id}
              id={`stage-col-${stage.id}`}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOverStage(stage.id);
              }}
              onDragLeave={() => setOverStage((current) => (current === stage.id ? null : current))}
              onDrop={(e) => {
                e.preventDefault();
                setOverStage(null);
                if (dragId) move(dragId, stage.id);
                setDragId(null);
              }}
              className={`flex min-h-[12rem] w-[84vw] max-w-sm shrink-0 snap-start flex-col md:max-h-[calc(100dvh-15rem)] md:min-h-[16rem] md:w-72 rounded-xl bg-slate-100/80 ring-1 transition ${overStage === stage.id ? "ring-2 ring-blue-500" : "ring-slate-200"}`}
            >
              <header className="flex items-center gap-2 border-t-4 px-3 py-3" style={{ borderColor: accent, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                {renaming === stage.id ? (
                  <form
                    className="flex flex-1 gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setRenaming(null);
                      run(null, () => renameStage(stage.id, renameValue));
                    }}
                  >
                    <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="input !py-1 text-sm" maxLength={80} />
                    <button className="btn-primary !px-2 !py-1 text-xs">OK</button>
                  </form>
                ) : (
                  <h2 className="min-w-0 flex-1 truncate text-sm font-semibold" title={stage.name}>
                    {stage.name}
                    {stage.isDefault && <span className="ml-1 text-xs font-normal text-slate-400" title="Hier landen neue Leads">★</span>}
                  </h2>
                )}
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">{cards.length}</span>
                {isAdmin && (
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button type="button" aria-label="Phase-Menü" className="rounded px-2.5 py-1 text-lg leading-none text-slate-500 hover:bg-white md:px-1.5 md:py-0 md:text-base" onClick={() => setMenu(menu === `s-${stage.id}` ? null : `s-${stage.id}`)}>
                      ⋯
                    </button>
                    {menu === `s-${stage.id}` && (
                      <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg bg-white p-1 text-sm shadow-lg ring-1 ring-slate-200">
                        <button className="menu-item" onClick={() => { setMenu(null); setRenameValue(stage.name); setRenaming(stage.id); }}>Umbenennen</button>
                        {index > 0 && <button className="menu-item" onClick={() => { setMenu(null); run(null, () => moveStage(stage.id, -1)); }}>← Nach links</button>}
                        {index < stages.length - 1 && <button className="menu-item" onClick={() => { setMenu(null); run(null, () => moveStage(stage.id, 1)); }}>→ Nach rechts</button>}
                        {!stage.isDefault && <button className="menu-item" onClick={() => { setMenu(null); run(null, () => setDefaultStage(stage.id)); }}>Für neue Leads verwenden</button>}
                        {!stage.isDefault && (
                          <button
                            className="menu-item text-red-700"
                            onClick={() => {
                              setMenu(null);
                              if (confirm(`Phase „${stage.name}“ löschen? Die Leads darin wandern in „${stages.find((s) => s.isDefault)?.name}“.`)) run(null, () => deleteStage(stage.id));
                            }}
                          >
                            Phase löschen
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </header>

              <div className="flex-1 space-y-2 px-2 pb-2 md:overflow-y-auto">
                {cards.map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(lead.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", lead.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStage(null);
                    }}
                    className={`cursor-grab rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200 active:cursor-grabbing ${dragId === lead.id ? "opacity-40" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{initials(lead.fullName)}</span>
                      <div className="min-w-0 flex-1">
                        <Link href={`${base}/${lead.id}`} className="block truncate text-sm font-semibold hover:underline" draggable={false}>
                          {lead.fullName || "Unbekannt"}
                        </Link>
                        <div className="text-xs text-slate-500">{formatDate(lead.receivedAt)}</div>
                      </div>
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button type="button" aria-label="Lead-Menü" className="rounded px-2.5 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100 md:px-1.5 md:py-0 md:text-base" onClick={() => setMenu(menu === `l-${lead.id}` ? null : `l-${lead.id}`)}>
                          ⋮
                        </button>
                        {menu === `l-${lead.id}` && (
                          <div className="absolute right-0 z-20 mt-1 max-h-[60vh] w-60 overflow-y-auto rounded-lg bg-white p-1 text-sm shadow-lg ring-1 ring-slate-200">
                            <Link href={`${base}/${lead.id}`} className="menu-item block">Lead öffnen</Link>
                            <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-slate-400">Verschieben nach</div>
                            {stages.filter((s) => s.id !== (lead.stageId ?? defaultId)).map((s) => (
                              <button key={s.id} className="menu-item" onClick={() => { setMenu(null); move(lead.id, s.id); }}>{s.name}</button>
                            ))}
                            <div className="my-1 border-t border-slate-100" />
                            <button className="menu-item text-red-700" onClick={() => { setMenu(null); remove(lead); }}>🗑 Löschen (Müll)</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {lead.optOut && <div className="mt-2"><span className="badge bg-red-50 text-red-700" title="Hat sich vom E-Mail-Verteiler abgemeldet">✉ abgemeldet</span></div>}
                    {(lead.phone || lead.email) && (
                      <div className="mt-2 space-y-0.5 text-xs text-slate-600">
                        {lead.phone && <div className="truncate">📱 {lead.phone}</div>}
                        {lead.email && <div className="truncate">✉️ {lead.email}</div>}
                      </div>
                    )}
                  </article>
                ))}
                {cards.length === 0 && (
                  <p className="px-2 py-8 text-center text-xs text-slate-400">
                    Keine Leads in „{stageName(stage.id)}“.<br />Ziehe einen Lead hierher.
                  </p>
                )}
              </div>
            </section>
          );
        })}

        {isAdmin && (
          <div className="w-[84vw] max-w-sm shrink-0 snap-start md:w-72">
            {adding ? (
              <form
                className="space-y-2 rounded-xl bg-slate-100/80 p-3 ring-1 ring-slate-200"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newName;
                  setNewName("");
                  setAdding(false);
                  run(null, () => createStage(name));
                }}
              >
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name der Phase" className="input" maxLength={80} />
                <div className="flex gap-2">
                  <button className="btn-primary">Hinzufügen</button>
                  <button type="button" className="btn-secondary" onClick={() => { setAdding(false); setNewName(""); }}>Abbrechen</button>
                </div>
              </form>
            ) : (
              <button type="button" className="btn-secondary w-full" onClick={() => setAdding(true)}>+ Eigene Phase hinzufügen</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
