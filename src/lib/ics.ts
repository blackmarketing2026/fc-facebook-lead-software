function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export type IcsEvent = {
  uid: string;
  start: Date;
  durationMinutes?: number;
  summary: string;
  description?: string;
  url?: string;
  /** Text der Erinnerung 5 Minuten vorher. */
  alarm?: string;
  /** Erledigte Termine bleiben im Abo sichtbar, aber als abgesagt markiert. */
  cancelled?: boolean;
};

function endOf(event: IcsEvent): Date {
  return new Date(event.start.getTime() + (event.durationMinutes ?? 15) * 60 * 1000);
}

function eventLines(e: IcsEvent, stamp: string): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${e.uid}@leadcenter`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsDate(e.start)}`,
    `DTEND:${icsDate(endOf(e))}`,
    `SUMMARY:${escapeText(e.summary)}`,
    ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    ...(e.cancelled ? ["STATUS:CANCELLED"] : []),
    ...(e.cancelled
      ? []
      : ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(e.alarm ?? e.summary)}`, "TRIGGER:-PT5M", "END:VALARM"]),
    "END:VEVENT",
  ];
}

/** Kalender mit beliebig vielen Terminen (Download oder Abo-Feed). */
export function buildIcsCalendar(events: IcsEvent[], opts: { name?: string } = {}): string {
  const stamp = icsDate(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Function Concept - Facebook Lead Software//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(opts.name ? [`X-WR-CALNAME:${escapeText(opts.name)}`, "X-WR-TIMEZONE:Europe/Berlin"] : []),
    ...events.flatMap((e) => eventLines(e, stamp)),
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

export function buildIcs(event: IcsEvent): string {
  return buildIcsCalendar([event]);
}

/** Link, der Google Kalender mit einem vorausgefüllten Termin öffnet ("Zu Google Kalender hinzufügen"). */
export function googleCalendarUrl(event: Pick<IcsEvent, "start" | "durationMinutes" | "summary" | "description">): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.summary,
    dates: `${icsDate(event.start)}/${icsDate(endOf(event as IcsEvent))}`,
    details: event.description ?? "",
    ctz: "Europe/Berlin",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
