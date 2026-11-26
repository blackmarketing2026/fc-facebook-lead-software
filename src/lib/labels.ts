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
  TAG_ADDED: "Tag vergeben",
  TAG_REMOVED: "Tag entfernt",
  EMAIL_SENT: "E-Mail verschickt",
  UNSUBSCRIBED: "Vom E-Mail-Verteiler abgemeldet",
  RESUBSCRIBED: "Wieder für E-Mails freigegeben",
  EMAIL_BOUNCED: "E-Mail nicht zustellbar (Bounce)",
  EMAIL_COMPLAINT: "Hat die E-Mail als Spam gemeldet",
};
