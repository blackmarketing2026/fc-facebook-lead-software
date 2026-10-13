import { parseBerlinLocal, TIMEZONE } from "./format";

const euroFmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function formatEuro(value: number): string {
  return euroFmt.format(value);
}

/**
 * Liest einen eingegebenen Betrag: "1500", "1.500", "1.500,50", "1500,5", "1500.50", "1.500 €".
 * Gibt null zurück, wenn es keine gültige Zahl von 0 bis 9.999.999.999,99 ist.
 */
export function parseEuroAmount(input: string): number | null {
  let s = input.replace(/[\s€]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) && value < 1e10 ? value : null;
}

export type PeriodKind = "month" | "week";
export type Period = { kind: PeriodKind; key: string; label: string; from: Date; to: Date };

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Kalenderdatum in Berlin als UTC-Mitternacht (nur zum Rechnen mit Tagen). */
function berlinDay(d: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return new Date(`${parts}T00:00:00Z`);
}

function dayKey(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Berliner Mitternacht des Tages als echter Zeitpunkt. */
function berlinMidnight(day: Date): Date {
  return parseBerlinLocal(`${dayKey(day)}T00:00`);
}

function addDays(day: Date, n: number) {
  return new Date(day.getTime() + n * 86_400_000);
}

/** ISO-Kalenderwoche (Montag als Wochenbeginn) eines Kalendertags. */
function isoWeek(day: Date): { year: number; week: number; monday: Date } {
  const monday = addDays(day, -((day.getUTCDay() + 6) % 7));
  const thursday = addDays(monday, 3);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / (7 * 86_400_000)) + 1;
  return { year, week, monday };
}

function monthPeriod(year: number, month: number): Period {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    kind: "month",
    key: `${year}-${pad(month)}`,
    label: `${MONTHS[month - 1]} ${year}`,
    from: berlinMidnight(start),
    to: berlinMidnight(end),
  };
}

function weekPeriod(monday: Date): Period {
  const { year, week } = isoWeek(monday);
  const sunday = addDays(monday, 6);
  const short = (d: Date) => `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.`;
  return {
    kind: "week",
    key: `${year}-W${pad(week)}`,
    label: `KW ${week}/${year} (${short(monday)}–${short(sunday)})`,
    from: berlinMidnight(monday),
    to: berlinMidnight(addDays(monday, 7)),
  };
}

/** Zeitraum zu einem Schlüssel ("2026-10" bzw. "2026-W41"); null bei ungültiger Eingabe. */
export function parsePeriod(kind: PeriodKind, key: string): Period | null {
  if (kind === "month") {
    const m = /^(\d{4})-(\d{2})$/.exec(key);
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
    return monthPeriod(Number(m[1]), Number(m[2]));
  }
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  // Der 4. Januar liegt immer in KW 1.
  const firstMonday = isoWeek(new Date(Date.UTC(year, 0, 4))).monday;
  const monday = addDays(firstMonday, (week - 1) * 7);
  return week >= 1 && isoWeek(monday).year === year ? weekPeriod(monday) : null;
}

/** Die letzten `count` Monate bzw. Wochen, die aktuelle zuerst. */
export function recentPeriods(kind: PeriodKind, now: Date, count: number): Period[] {
  const today = berlinDay(now);
  const result: Period[] = [];
  if (kind === "month") {
    let year = today.getUTCFullYear();
    let month = today.getUTCMonth() + 1;
    for (let i = 0; i < count; i++) {
      result.push(monthPeriod(year, month));
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
    }
  } else {
    const { monday } = isoWeek(today);
    for (let i = 0; i < count; i++) result.push(weekPeriod(addDays(monday, -7 * i)));
  }
  return result;
}
