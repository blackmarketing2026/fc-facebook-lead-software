export const TIMEZONE = "Europe/Berlin";

const dateTimeFmt = new Intl.DateTimeFormat("de-DE", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("de-DE", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" });

export function formatDateTime(d: Date): string {
  return dateTimeFmt.format(d);
}

export function formatTime(d: Date): string {
  return timeFmt.format(d);
}

/** Normalisiert eine Telefonnummer für wa.me: nur Ziffern, 0049/0… -> 49… */
export function whatsappNumber(phone: string): string {
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "49" + digits.slice(1);
  return digits.replace(/\D/g, "");
}

export function telHref(phone: string): string {
  return "tel:" + phone.replace(/[^\d+]/g, "");
}

/** Wandelt einen <input type="datetime-local">-Wert (Berliner Zeit) in ein Date um. */
export function parseBerlinLocal(value: string): Date {
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  // Offset von Berlin zu diesem Zeitpunkt bestimmen (Sommer-/Winterzeit).
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(asUtc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const berlinAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(asUtc - (berlinAsUtc - asUtc));
}
