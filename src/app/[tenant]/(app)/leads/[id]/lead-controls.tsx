"use client";

import type { LeadStatus, ReminderType } from "@prisma/client";
import { useParams, useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addNote,
  closeLead,
  completeReminder,
  createReminder,
  deleteReminder,
  reassignLead,
  trackContact,
  transferLead,
  updateStatus,
  type FormState,
} from "@/app/actions/leads";
import { formatEuro } from "@/lib/commission";
import { STATUS_LABELS, STATUSES } from "@/lib/labels";
import { DURATION_OPTIONS, formatDuration, REMINDER_LEAD_MINUTES, REMINDER_TYPE_KEYS, REMINDER_TYPES } from "@/lib/reminder-types";

/** Status-Auswahl; "Abgeschlossen" fragt die Provisionseinnahme ab (Pflicht). */
export function StatusSelect({ leadId, status, commission }: { leadId: string; status: LeadStatus; commission: number | null }) {
  const [pending, start] = useTransition();
  const [closing, setClosing] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openCommission() {
    setAmount(commission === null ? "" : commission.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setError(null);
    setClosing(true);
  }

  function saveCommission(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const result = await closeLead(leadId, amount);
      if (result.error) setError(result.error);
      else setClosing(false);
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <select
        className="input w-auto"
        value={closing ? "ABGESCHLOSSEN" : status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as LeadStatus;
          if (next === "ABGESCHLOSSEN") return openCommission();
          setClosing(false);
          start(() => updateStatus(leadId, next));
        }}
        aria-label="Status"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {status === "ABGESCHLOSSEN" && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Provision:</span>
          <span className="font-medium">{commission === null ? "nicht eingetragen" : formatEuro(commission)}</span>
          <button type="button" className="text-blue-700 hover:underline" onClick={openCommission}>
            {commission === null ? "eintragen" : "ändern"}
          </button>
        </div>
      )}
      {closing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={saveCommission}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`commission-title-${leadId}`}
            className="card w-full max-w-sm p-6 text-left shadow-xl"
          >
            <div className="mb-1 text-3xl">🎉</div>
            <h2 id={`commission-title-${leadId}`} className="text-lg font-semibold">
              {status === "ABGESCHLOSSEN" ? "Provision ändern" : "Abschluss – bitte die Einnahme eingeben"}
            </h2>
            <p className="mb-4 text-sm text-slate-500">Wie hoch ist die Provisionseinnahme für diesen Lead?</p>
            <label className="block">
              <span className="label">Provision in €</span>
              <input
                className="input text-lg"
                inputMode="decimal"
                placeholder="1.500,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
            </label>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setClosing(false)} disabled={pending}>
                Abbrechen
              </button>
              <button disabled={pending} className="btn-primary">
                {pending ? "Speichern …" : status === "ABGESCHLOSSEN" ? "Speichern" : "Abschluss speichern"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function ReassignSelect({
  leadId,
  assignedToId,
  users,
}: {
  leadId: string;
  assignedToId: string | null;
  users: { id: string; displayName: string }[];
}) {
  const [pending, start] = useTransition();
  return (
    <select
      className="input w-auto"
      value={assignedToId ?? ""}
      disabled={pending}
      onChange={(e) => e.target.value && start(() => reassignLead(leadId, e.target.value))}
      aria-label="Zugewiesen an"
    >
      {!assignedToId && <option value="">Nicht zugewiesen</option>}
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.displayName}
        </option>
      ))}
    </select>
  );
}

export function TransferLeadControls({ leadId, currentOwnerId, users, isAdmin }: { leadId: string; currentOwnerId: string; users: { id: string; displayName: string }[]; isAdmin: boolean }) {
  const router = useRouter();
  const { tenant } = useParams<{ tenant: string }>();
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const colleagues = users.filter((item) => item.id !== currentOwnerId);

  function submit() {
    if (!target) return setError("Bitte einen Mitarbeiter oder den Pool auswählen.");
    if (target === "pool" && !window.confirm("Lead in den freien Pool legen? Offene Termine für diesen Lead werden entfernt.")) return;
    setError("");
    start(async () => {
      const result = await transferLead(leadId, target === "pool" ? null : target);
      if (result.error) return setError(result.error);
      if (isAdmin) router.refresh();
      else router.push(`/${tenant}/leads`);
    });
  }

  return <div className="w-full rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] p-3 text-left sm:w-80">
    <label htmlFor={`transfer-${leadId}`} className="label">Lead übergeben</label>
    <p className="mb-2 text-xs text-slate-600">An einen Kollegen geben oder in den freien Pool legen.</p>
    <select id={`transfer-${leadId}`} value={target} onChange={(event) => setTarget(event.target.value)} className="input mb-2"><option value="">Bitte auswählen …</option>{colleagues.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}<option value="pool">Zurück in den Pool</option></select>
    <button type="button" disabled={pending} onClick={submit} className="btn-primary w-full">{pending ? "Übergabe läuft …" : "Lead übergeben"}</button>
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </div>;
}

type ContactProps = {
  leadId: string;
  telHref: string | null;
  whatsappHref: string | null;
  mailHref: string | null;
};

export function ContactButtons({ leadId, telHref, whatsappHref, mailHref }: ContactProps) {
  // Das Protokollieren läuft im Hintergrund, der Link öffnet sich sofort.
  const track = (channel: "call" | "whatsapp" | "email") => () => {
    void trackContact(leadId, channel);
  };
  const disabled = "btn pointer-events-none border border-slate-200 bg-slate-100 text-slate-400";
  return (
    <div className="flex flex-wrap gap-2">
      {telHref ? (
        <a href={telHref} onClick={track("call")} className="btn bg-emerald-600 text-white hover:bg-emerald-700">
          📞 Anrufen
        </a>
      ) : (
        <span className={disabled}>📞 Keine Nummer</span>
      )}
      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={track("whatsapp")}
          className="btn bg-[#25D366] text-white hover:brightness-95"
        >
          💬 WhatsApp
        </a>
      ) : (
        <span className={disabled}>💬 WhatsApp</span>
      )}
      {mailHref ? (
        <a href={mailHref} onClick={track("email")} className="btn bg-blue-600 text-white hover:bg-blue-700">
          ✉️ E-Mail
        </a>
      ) : (
        <span className={disabled}>✉️ Keine E-Mail</span>
      )}
    </div>
  );
}

function useResetOnSuccess(state: FormState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

export function NoteForm({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState(addNote.bind(null, leadId), undefined);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <textarea
        name="text"
        rows={3}
        required
        placeholder="Gesprächsnotiz, z. B. „Kunde möchte Angebot per Mail, Rückruf Donnerstag“"
        className="input"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="btn-primary">
        {pending ? "Speichern …" : "Notiz speichern"}
      </button>
    </form>
  );
}

export function ReminderForm({ leadId, defaultDue }: { leadId: string; defaultDue: string }) {
  const [state, action, pending] = useActionState(createReminder.bind(null, leadId), undefined);
  const ref = useResetOnSuccess(state);
  const [type, setType] = useState<ReminderType>("RUECKRUF");
  const [duration, setDuration] = useState(REMINDER_TYPES.RUECKRUF.duration);
  const [setTermin, setSetTermin] = useState(REMINDER_TYPES.RUECKRUF.setTermin);
  const choose = (t: ReminderType) => {
    setType(t);
    setDuration(REMINDER_TYPES[t].duration);
    setSetTermin(REMINDER_TYPES[t].setTermin);
  };
  return (
    <form ref={ref} action={action} className="space-y-3">
      <div>
        <span className="label">Was steht an?</span>
        <input type="hidden" name="type" value={type} />
        <div className="flex flex-wrap gap-1.5">
          {REMINDER_TYPE_KEYS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => choose(t)}
              aria-pressed={type === t}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                type === t ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {REMINDER_TYPES[t].icon} {REMINDER_TYPES[t].label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Datum & Uhrzeit</span>
          <input type="datetime-local" name="dueAt" required defaultValue={defaultDue} className="input" />
        </label>
        <label className="block">
          <span className="label">Dauer</span>
          <select name="durationMinutes" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="input">
            {DURATION_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {formatDuration(m)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label">Titel (optional)</span>
        <input name="title" placeholder={REMINDER_TYPES[type].label} className="input" />
      </label>
      <label className="block">
        <span className="label">Kommentar (optional)</span>
        <input name="comment" className="input" />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="setTermin"
          checked={setTermin}
          onChange={(e) => setSetTermin(e.target.checked)}
          className="h-4 w-4"
        />
        Status auf „Termin“ setzen
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-700">{state.message ?? "Gespeichert."} Du wirst {REMINDER_LEAD_MINUTES} Minuten vorher erinnert.</p>}
      <button disabled={pending} className="btn-primary">
        {pending ? "Speichern …" : `${REMINDER_TYPES[type].label} planen`}
      </button>
    </form>
  );
}

export function ReminderActions({ reminderId, done, googleUrl }: { reminderId: string; done: boolean; googleUrl?: string }) {
  const { tenant } = useParams<{ tenant: string }>();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {googleUrl && !done && (
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary px-2 py-1 text-xs">
          📆 Google Kalender
        </a>
      )}
      <a href={`/${tenant}/api/reminders/${reminderId}/ics`} className="btn-secondary px-2 py-1 text-xs">
        📅 Outlook / .ics
      </a>
      {!done && (
        <button
          disabled={pending}
          onClick={() => start(() => completeReminder(reminderId))}
          className="btn-secondary px-2 py-1 text-xs"
        >
          ✓ Erledigt
        </button>
      )}
      <button
        disabled={pending}
        onClick={() => confirm("Termin löschen?") && start(() => deleteReminder(reminderId))}
        className="btn-danger px-2 py-1 text-xs"
      >
        Löschen
      </button>
    </div>
  );
}
