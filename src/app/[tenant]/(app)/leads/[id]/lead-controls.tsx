"use client";

import type { LeadStatus, ReminderType } from "@prisma/client";
import { useParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addNote,
  completeReminder,
  createReminder,
  deleteReminder,
  reassignLead,
  trackContact,
  updateStatus,
  type FormState,
} from "@/app/actions/leads";
import { STATUS_LABELS, STATUSES } from "@/lib/labels";
import { DURATION_OPTIONS, formatDuration, REMINDER_LEAD_MINUTES, REMINDER_TYPE_KEYS, REMINDER_TYPES } from "@/lib/reminder-types";

export function StatusSelect({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [pending, start] = useTransition();
  return (
    <select
      className="input w-auto"
      value={status}
      disabled={pending}
      onChange={(e) => start(() => updateStatus(leadId, e.target.value as LeadStatus))}
      aria-label="Status"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
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
        📅 .ics
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
