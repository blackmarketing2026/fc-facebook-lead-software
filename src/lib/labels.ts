import type { ActivityType } from "@prisma/client";

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  CREATED: "Lead eingegangen",
  ASSIGNED: "Zugewiesen",
  STATUS_CHANGED: "Phase geändert",
  CALL_CLICKED: "Anruf gestartet",
  WHATSAPP_CLICKED: "WhatsApp geöffnet",
  EMAIL_CLICKED: "E-Mail geöffnet",
  NOTE_ADDED: "Notiz hinzugefügt",
  REMINDER_SET: "Termin geplant",
  REMINDER_DONE: "Termin erledigt",
};
