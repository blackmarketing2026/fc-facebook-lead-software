"use client";

import type { LeadStatus } from "@prisma/client";
import { useActionState, useEffect, useRef, useTransition } from "react";
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
  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Datum & Uhrzeit</span>
          <input type="datetime-local" name="dueAt" required defaultValue={defaultDue} className="input" />
        </label>
        <label className="block">
          <span className="label">Titel</span>
          <input name="title" placeholder="Rückruf" className="input" />
        </label>
      </div>
      <label className="block">
        <span className="label">Kommentar (optional)</span>
        <input name="comment" className="input" />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="setTermin" defaultChecked className="h-4 w-4" />
        Status auf „Termin“ setzen
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-700">Rückruf gespeichert. Du wirst 5 Minuten vorher erinnert.</p>}
      <button disabled={pending} className="btn-primary">
        {pending ? "Speichern …" : "Rückruf planen"}
      </button>
    </form>
  );
}

export function ReminderActions({ reminderId, done }: { reminderId: string; done: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`/api/reminders/${reminderId}/ics`} className="btn-secondary px-2 py-1 text-xs">
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
        onClick={() => confirm("Rückruf löschen?") && start(() => deleteReminder(reminderId))}
        className="btn-danger px-2 py-1 text-xs"
      >
        Löschen
      </button>
    </div>
  );
}
