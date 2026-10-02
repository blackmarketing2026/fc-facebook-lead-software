import type { LeadRouteType } from "@prisma/client";
import type { ParsedAnswer } from "./lead-parser";

export type RouteRule = { tenantId: string; type: LeadRouteType; pattern: string; priority: number };

export type RoutableMail = { to?: string | null; subject?: string | null };

export const ROUTE_TYPE_LABELS: Record<LeadRouteType, string> = {
  RECIPIENT: "Empfänger enthält",
  SUBJECT: "Betreff enthält",
  JSON_FIELD: "JSON-Feld (feld=wert)",
};

/** Der Parser macht aus "martin_mayer" "Martin mayer" – daher tolerant vergleichen. */
function norm(value: string): string {
  return value.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function matches(rule: RouteRule, mail: RoutableMail, answers: ParsedAnswer[]): boolean {
  const pattern = rule.pattern.trim().toLowerCase();
  if (!pattern) return false;
  switch (rule.type) {
    case "RECIPIENT":
      return (mail.to ?? "").toLowerCase().includes(pattern);
    case "SUBJECT":
      return (mail.subject ?? "").toLowerCase().includes(pattern);
    case "JSON_FIELD": {
      const [key, ...rest] = pattern.split("=");
      const value = norm(rest.join("="));
      const field = answers.find((a) => norm(a.questionKey) === norm(key));
      if (!field) return false;
      // Ohne "=wert" reicht es, dass das Feld vorhanden ist.
      return !value || field.answers.some((a) => norm(a) === value);
    }
  }
}

/**
 * Findet den Mandanten für eine Lead-Mail aus dem zentralen Postfach.
 * Höhere Priorität zuerst; null = keine Regel passt (dann gilt der Standard-Mandant).
 */
export function resolveTenantId(rules: RouteRule[], mail: RoutableMail, answers: ParsedAnswer[] = []): string | null {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  return sorted.find((r) => matches(r, mail, answers))?.tenantId ?? null;
}

/** Zweistellige Dashboard-ID: "00" (Plattform) bis "99". */
export function isValidTenantCode(code: string): boolean {
  return /^\d{2}$/.test(code);
}

/** Nächste freie ID für ein neues Dashboard (01–99), null wenn alle vergeben sind. */
export function nextFreeTenantCode(used: Iterable<string>): string | null {
  const taken = new Set(used);
  for (let n = 1; n <= 99; n++) {
    const code = String(n).padStart(2, "0");
    if (!taken.has(code)) return code;
  }
  return null;
}

/**
 * Sucht die Dashboard-ID im Betreff. Bevorzugt ausdrücklich markierte IDs ("ID 12", "ID: 12", "#12", "[12]"),
 * sonst die erste alleinstehende zweistellige Zahl, die zu einem Dashboard gehört. Zahlen in Datum/Uhrzeit
 * ("02.10.", "14:30") oder längere Zahlen zählen nicht.
 */
export function tenantCodeFromSubject(subject: string | null | undefined, codes: Iterable<string>): string | null {
  if (!subject) return null;
  const known = new Set(codes);
  const marked = [...subject.matchAll(/(?:\bID\s*[:#-]?\s*|#|\[\s*)(\d{2})(?!\d)/gi)].map((m) => m[1]);
  const plain = [...subject.matchAll(/(?<![\d.:/])(\d{2})(?![\d.:/])/g)].map((m) => m[1]);
  return [...marked, ...plain].find((c) => known.has(c)) ?? null;
}
