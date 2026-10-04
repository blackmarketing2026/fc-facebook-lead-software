import { describe, expect, it } from "vitest";
import { buildIcsCalendar, googleCalendarUrl } from "../src/lib/ics";

const start = new Date("2026-10-05T08:00:00Z"); // 10:00 Berliner Sommerzeit

describe("Kalender", () => {
  it("baut einen Google-Kalender-Link mit Start/Ende in UTC", () => {
    const url = new URL(googleCalendarUrl({ start, durationMinutes: 30, summary: "📞 Rückruf: Max", description: "Telefon: +49 170" }));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20261005T080000Z/20261005T083000Z");
    expect(url.searchParams.get("text")).toBe("📞 Rückruf: Max");
    expect(url.searchParams.get("details")).toBe("Telefon: +49 170");
  });

  it("schreibt mehrere Termine mit Dauer, Kalendername und Escaping", () => {
    const ics = buildIcsCalendar(
      [
        { uid: "a", start, durationMinutes: 60, summary: "Termin; Vertrag, Max", description: "Zeile 1\nZeile 2" },
        { uid: "b", start: new Date("2026-10-06T12:00:00Z"), summary: "Rückruf" },
      ],
      { name: "Leads – Engel" },
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("X-WR-CALNAME:Leads – Engel");
    expect(ics).toContain("DTEND:20261005T090000Z");
    expect(ics).toContain("DTEND:20261006T121500Z");
    expect(ics).toContain("SUMMARY:Termin\\; Vertrag\\, Max");
    expect(ics).toContain("DESCRIPTION:Zeile 1\\nZeile 2");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
