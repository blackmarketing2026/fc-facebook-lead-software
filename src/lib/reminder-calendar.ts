import type { ReminderType } from "@prisma/client";
import { formatDateTime } from "./format";
import type { IcsEvent } from "./ics";
import { absoluteUrl } from "./lead-notify-mail";
import { reminderIcon, reminderLabel } from "./reminder-types";
import { tenantPath } from "./tenant-paths";

export type ReminderForCalendar = {
  id: string;
  type: ReminderType;
  title: string;
  comment: string | null;
  dueAt: Date;
  durationMinutes: number;
  done: boolean;
  lead: { id: string; fullName: string | null; phone: string | null; email: string | null };
};

/** Prisma-Auswahl, die reminderEvent() braucht. */
export const REMINDER_CALENDAR_SELECT = {
  id: true,
  type: true,
  title: true,
  comment: true,
  dueAt: true,
  durationMinutes: true,
  done: true,
  lead: { select: { id: true, fullName: true, phone: true, email: true } },
} as const;

export function leadProfileUrl(slug: string, leadId: string): string {
  return absoluteUrl(tenantPath(slug, `/leads/${leadId}`));
}

/** Kalendereintrag zu einem Termin – mit allen Kontaktdaten und dem Link zum Lead-Profil. */
export function reminderEvent(r: ReminderForCalendar, slug: string): IcsEvent {
  const name = r.lead.fullName ?? "Lead";
  const label = reminderLabel(r.type);
  const url = leadProfileUrl(slug, r.lead.id);
  const description = [
    `${label}${r.title && r.title !== label ? `: ${r.title}` : ""}`,
    r.comment,
    "",
    `Name: ${name}`,
    r.lead.phone && `Telefon: ${r.lead.phone}`,
    r.lead.email && `E-Mail: ${r.lead.email}`,
    "",
    `Lead-Profil: ${url}`,
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n");
  return {
    uid: r.id,
    start: r.dueAt,
    durationMinutes: r.durationMinutes,
    summary: `${reminderIcon(r.type)} ${label}: ${name}`,
    description,
    url,
    alarm: `${label}: ${name} um ${formatDateTime(r.dueAt)}`,
  };
}
