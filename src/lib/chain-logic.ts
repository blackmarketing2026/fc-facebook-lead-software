import { createHmac, timingSafeEqual } from "node:crypto";
import type { WaitUnit } from "@prisma/client";

export const WAIT_UNIT_LABELS: Record<WaitUnit, string> = { MINUTES: "Minuten", HOURS: "Stunden", DAYS: "Tage" };
export const MAX_WAIT_DAYS = 365;

/** Absender-Angaben, die klein unter jeder automatischen E-Mail stehen (neben dem Abmelde-Link). */
export const SENDER_LINES = ["Function Concept", "c/o MDC Management#169", "Welserstraße 3", "87463 Dietmannsried", "E-Mail: support@function-concept.de"];

const UNIT_MS: Record<WaitUnit, number> = { MINUTES: 60_000, HOURS: 3_600_000, DAYS: 86_400_000 };

/** Wartezeit in Millisekunden. */
export function waitMs(value: number, unit: WaitUnit): number {
  return Math.max(0, Math.round(value)) * UNIT_MS[unit];
}

/** Ist die Wartezeit erlaubt (1 Minute bis 365 Tage)? */
export function validWait(value: number, unit: WaitUnit): boolean {
  const ms = waitMs(value, unit);
  return Number.isInteger(value) && value >= 1 && ms >= 60_000 && ms <= MAX_WAIT_DAYS * UNIT_MS.DAYS;
}

/** „2 Tage“, „1 Stunde“ … für die Anzeige. */
export function describeWait(value: number, unit: WaitUnit): string {
  const singular: Record<WaitUnit, string> = { MINUTES: "Minute", HOURS: "Stunde", DAYS: "Tag" };
  return `${value} ${value === 1 ? singular[unit] : WAIT_UNIT_LABELS[unit]}`;
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Reintext → einfaches HTML: Absätze, Zeilenumbrüche und anklickbare Links. */
export function textToHtml(text: string): string {
  const linkify = (escaped: string) => escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => `<a href="${url}">${url}</a>`);
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 14px">${linkify(escapeHtml(para)).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function sign(leadId: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen");
  return createHmac("sha256", secret).update(`unsubscribe:${leadId}`).digest("hex");
}

/** Geheimer Teil des Abmelde-Links eines Leads. */
export function unsubscribeToken(leadId: string): string {
  return sign(leadId);
}

export function verifyUnsubscribe(leadId: string, token: string): boolean {
  try {
    const a = Buffer.from(sign(leadId));
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
