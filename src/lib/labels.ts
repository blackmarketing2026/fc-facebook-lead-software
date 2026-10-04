import type { ActivityType, LeadStatus } from "@prisma/client";

export const STATUS_LABELS: Record<LeadStatus, string> = {
  NEU: "Neu",
  KONTAKTIERT: "Kontaktiert",
  NICHT_ERREICHT: "Nicht erreicht",
  TERMIN: "Termin",
  ABGESCHLOSSEN: "Abgeschlossen",
  VERLOREN: "Verloren",
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  NEU: "bg-blue-100 text-blue-800",
  KONTAKTIERT: "bg-indigo-100 text-indigo-800",
  NICHT_ERREICHT: "bg-amber-100 text-amber-800",
  TERMIN: "bg-purple-100 text-purple-800",
  ABGESCHLOSSEN: "bg-green-100 text-green-800",
  VERLOREN: "bg-gray-200 text-gray-700",
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  CREATED: "Lead eingegangen",
  ASSIGNED: "Zugewiesen",
  STATUS_CHANGED: "Status geändert",
  CALL_CLICKED: "Anruf gestartet",
  WHATSAPP_CLICKED: "WhatsApp geöffnet",
  EMAIL_CLICKED: "E-Mail geöffnet",
  NOTE_ADDED: "Notiz hinzugefügt",
  REMINDER_SET: "Termin geplant",
  REMINDER_DONE: "Termin erledigt",
};

export const STATUSES = Object.keys(STATUS_LABELS) as LeadStatus[];
