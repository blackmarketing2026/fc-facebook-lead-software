import type { ActivityType, ReminderType } from "@prisma/client";
import { formatDateTime } from "./format";
import { ACTIVITY_LABELS } from "./labels";
import { reminderLabel } from "./reminder-types";

/** Lesbarer Protokolltext zu einem Eintrag (Lead-Seite und Kontaktcloud). */
export function activityText(type: ActivityType, meta: unknown, users: Map<string, string> = new Map()): string {
  const m = (meta ?? {}) as Record<string, unknown>;
  switch (type) {
    case "STATUS_CHANGED":
      return `Phase: ${(m.fromStage as string) ?? "–"} → ${(m.toStage as string) ?? "–"}`;
    case "ASSIGNED":
      if (m.pool) return "Zurück in den freien Pool gegeben";
      return `Zugewiesen an ${users.get(m.toUserId as string) ?? "?"}${m.auto ? " (automatisch)" : ""}${m.test ? " – Verteilungstest" : ""}`;
    case "REMINDER_SET":
      return `${m.type ? reminderLabel(m.type as ReminderType) : "Rückruf"} geplant für ${m.dueAt ? formatDateTime(new Date(m.dueAt as string)) : "?"}`;
    case "TAG_ADDED":
      return `Tag vergeben: ${(m.tag as string) ?? "?"}`;
    case "TAG_REMOVED":
      return `Tag entfernt: ${(m.tag as string) ?? "?"}`;
    case "EMAIL_SENT":
      return `E-Mail verschickt: „${(m.subject as string) ?? "?"}“${m.chain ? ` (Kette ${m.chain as string})` : ""}`;
    case "EMAIL_BOUNCED":
      return `E-Mail nicht zustellbar${m.subject ? `: „${m.subject as string}“` : ""}${m.reason ? ` (${m.reason as string})` : ""}`;
    case "EMAIL_COMPLAINT":
      return `Hat die E-Mail${m.subject ? ` „${m.subject as string}“` : ""} als Spam gemeldet – automatisch abgemeldet`;
    case "UNSUBSCRIBED":
      if (m.via === "import") return "Ohne E-Mail-Einwilligung angelegt – kein E-Mail-Versand";
      return m.via === "link" ? "Hat sich über den Abmelde-Link abgemeldet" : "Vom E-Mail-Verteiler abgemeldet";
    default:
      return ACTIVITY_LABELS[type];
  }
}
