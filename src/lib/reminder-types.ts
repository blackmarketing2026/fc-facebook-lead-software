import type { ReminderType } from "@prisma/client";

/** Arten von Terminen / Aufgaben zu einem Lead – Reihenfolge = Reihenfolge im Formular. */
export const REMINDER_TYPES: Record<ReminderType, { label: string; icon: string; duration: number; setTermin: boolean }> = {
  RUECKRUF: { label: "Rückruf", icon: "📞", duration: 15, setTermin: true },
  ANRUF: { label: "Anrufen", icon: "☎️", duration: 15, setTermin: false },
  WHATSAPP: { label: "WhatsApp schreiben", icon: "💬", duration: 15, setTermin: false },
  EMAIL: { label: "E-Mail schreiben", icon: "✉️", duration: 15, setTermin: false },
  TERMIN: { label: "Termin", icon: "📅", duration: 60, setTermin: true },
  VERTRAG: { label: "Vertrag", icon: "📝", duration: 30, setTermin: false },
  RUECKMELDUNG: { label: "Rückmeldung abwarten", icon: "⏳", duration: 15, setTermin: false },
  SONSTIGES: { label: "Sonstiges", icon: "📌", duration: 15, setTermin: false },
};

export const REMINDER_TYPE_KEYS = Object.keys(REMINDER_TYPES) as ReminderType[];

export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export function reminderLabel(type: ReminderType): string {
  return REMINDER_TYPES[type]?.label ?? "Termin";
}

export function reminderIcon(type: ReminderType): string {
  return REMINDER_TYPES[type]?.icon ?? "📅";
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} Min.`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
}
