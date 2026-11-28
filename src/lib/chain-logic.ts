import { createHmac, timingSafeEqual } from "node:crypto";
import type { WaitUnit } from "@prisma/client";
import { parseBerlinLocal, TIMEZONE } from "./format";

export const WAIT_UNIT_LABELS: Record<WaitUnit, string> = { MINUTES: "Minuten", HOURS: "Stunden", DAYS: "Tage" };
export const MAX_WAIT_DAYS = 365;

/** Absender-Angaben, die klein unter jeder automatischen E-Mail stehen (neben dem Abmelde-Link). */
export const SENDER_LINES = ["Function Concept", "c/o MDC Management#169", "Welserstraße 3", "87463 Dietmannsried", "E-Mail: support@function-concept.de"];

const UNIT_MS: Record<WaitUnit, number> = { MINUTES: 60_000, HOURS: 3_600_000, DAYS: 86_400_000 };

/** Wartezeit in Millisekunden. */
export function waitMs(value: number, unit: WaitUnit): number {
  return Math.max(0, Math.round(value)) * UNIT_MS[unit];
}

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Ist die Wartezeit erlaubt? Ohne Uhrzeit: 1 Minute bis 365 Tage.
 * Mit Uhrzeit (nur Einheit „Tage“): 0 bis 365 Kalendertage, Uhrzeit im Format HH:MM.
 */
export function validWait(value: number, unit: WaitUnit, time?: string | null): boolean {
  if (!Number.isInteger(value)) return false;
  if (time) return unit === "DAYS" && TIME_RE.test(time) && value >= 0 && value <= MAX_WAIT_DAYS;
  const ms = waitMs(value, unit);
  return value >= 1 && ms >= 60_000 && ms <= MAX_WAIT_DAYS * UNIT_MS.DAYS;
}

/** Kalendertag in Berlin als YYYY-MM-DD. */
function berlinDay(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TIMEZONE }).format(d);
}

function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Zeitpunkt, an dem es nach einem Wartezeit-Schritt weitergeht.
 * Ohne Uhrzeit: jetzt + Dauer. Mit Uhrzeit: der Kalendertag „heute + N Tage“ um HH:MM Uhr (Berlin) – also nicht „24 Stunden warten und dann zur nächsten Uhrzeit“.
 * Liegt dieser Zeitpunkt nicht in der Zukunft (nur bei 0 Tagen), gilt der nächste Tag.
 */
export function waitTarget(now: Date, value: number, unit: WaitUnit, time?: string | null): Date {
  if (!time || unit !== "DAYS" || !TIME_RE.test(time)) return new Date(now.getTime() + waitMs(value, unit));
  const day = berlinDay(now);
  let target = parseBerlinLocal(`${addDays(day, Math.max(0, value))}T${time}`);
  if (target.getTime() <= now.getTime()) target = parseBerlinLocal(`${addDays(day, Math.max(0, value) + 1)}T${time}`);
  return target;
}

/** „2 Tage“, „1 Stunde“ … für die Anzeige. */
export function describeWait(value: number, unit: WaitUnit, time?: string | null): string {
  const singular: Record<WaitUnit, string> = { MINUTES: "Minute", HOURS: "Stunde", DAYS: "Tag" };
  const base = `${value} ${value === 1 ? singular[unit] : WAIT_UNIT_LABELS[unit]}`;
  return time && unit === "DAYS" ? `${base}, dann um ${time} Uhr` : base;
}

export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

export type TemplateVars = { vorname: string; name: string; email: string };

/** Ersetzt {{vorname}}, {{name}} und {{email}}; unbekannte Platzhalter werden entfernt. */
export function renderTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_m, key: string) => (vars as Record<string, string>)[key.toLowerCase()] ?? "");
}

export function varsForLead(lead: { fullName: string | null; email: string | null }): TemplateVars {
  return { vorname: firstName(lead.fullName), name: (lead.fullName ?? "").trim(), email: lead.email ?? "" };
}

export { textToHtml, linksToPlainText } from "./email-format";

function secret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen");
  return secret;
}

function sign(leadId: string): string {
  return createHmac("sha256", secret()).update(`unsubscribe:${leadId}`).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Signatur für Tracking-Links („open“ oder „click“, optional mit Ziel-URL), damit niemand fremde Links oder Zähler fälschen kann. */
export function trackToken(purpose: "open" | "click", sendId: string, extra = ""): string {
  return createHmac("sha256", secret()).update(`${purpose}:${sendId}:${extra}`).digest("hex").slice(0, 32);
}

export function verifyTrack(purpose: "open" | "click", sendId: string, extra: string, token: string): boolean {
  try {
    return safeEqualHex(trackToken(purpose, sendId, extra), token);
  } catch {
    return false;
  }
}

export function encodeUrl(url: string): string {
  return Buffer.from(url, "utf8").toString("base64url");
}

export function decodeUrl(value: string): string | null {
  try {
    const url = Buffer.from(value, "base64url").toString("utf8");
    return /^https?:\/\//i.test(url) ? url : null;
  } catch {
    return null;
  }
}

/** Schreibt alle http(s)-Links in `href="…"` um; Links, für die `skip` true liefert (z. B. Abmelden), bleiben unberührt. */
export function rewriteLinks(html: string, wrap: (url: string) => string, skip: (url: string) => boolean = () => false): string {
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (m, url: string) => {
    const plain = url.replace(/&amp;/g, "&");
    return skip(plain) ? m : `href="${wrap(plain)}"`;
  });
}

/** Geheimer Teil des Abmelde-Links eines Leads. */
export function unsubscribeToken(leadId: string): string {
  return sign(leadId);
}

export function verifyUnsubscribe(leadId: string, token: string): boolean {
  try {
    return safeEqualHex(sign(leadId), token);
  } catch {
    return false;
  }
}
