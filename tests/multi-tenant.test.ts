import { describe, expect, it } from "vitest";
import { hasFeature, parseFeatures, serializeFeatures } from "@/lib/features";
import { parseLeadText } from "@/lib/lead-parser";
import { nextFreeTenantCode, resolveTenantId, tenantCodeFromSubject, type RouteRule } from "@/lib/lead-routing";
import { isValidSlug, slugFromPath, tenantPath } from "@/lib/tenant-paths";

const rules: RouteRule[] = [
  { tenantId: "martin", type: "RECIPIENT", pattern: "martin@function-concept.com", priority: 0 },
  { tenantId: "anna", type: "SUBJECT", pattern: "Anna Immobilien", priority: 0 },
  { tenantId: "json", type: "JSON_FIELD", pattern: "mandant=mayer_versicherung", priority: 0 },
];

describe("resolveTenantId", () => {
  it("ordnet über den Empfänger zu (auch Delivered-To in einer Liste)", () => {
    expect(resolveTenantId(rules, { to: "paula@function-concept.com, Martin@Function-Concept.com" })).toBe("martin");
  });

  it("ordnet über den Betreff zu", () => {
    expect(resolveTenantId(rules, { subject: "Neuer Lead – anna immobilien" })).toBe("anna");
  });

  it("ordnet über ein JSON-Feld zu, auch wenn der Parser den Wert lesbar gemacht hat", () => {
    const parsed = parseLeadText(`[{"name":"mandant","values":["mayer_versicherung"]},{"name":"full_name","values":["Max"]}]`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(resolveTenantId(rules, {}, parsed.lead.answers)).toBe("json");
  });

  it("liefert null, wenn keine Regel passt (dann Standard-Mandant)", () => {
    expect(resolveTenantId(rules, { to: "paula@function-concept.com", subject: "Lead" })).toBeNull();
  });

  it("beachtet die Priorität", () => {
    const prio: RouteRule[] = [
      { tenantId: "low", type: "SUBJECT", pattern: "lead", priority: 0 },
      { tenantId: "high", type: "SUBJECT", pattern: "lead", priority: 5 },
    ];
    expect(resolveTenantId(prio, { subject: "Neuer Lead" })).toBe("high");
  });
});

describe("tenantCodeFromSubject", () => {
  const codes = ["00", "01", "02", "99"];

  it("erkennt die ID in verschiedenen Schreibweisen", () => {
    expect(tenantCodeFromSubject("01", codes)).toBe("01");
    expect(tenantCodeFromSubject("Neuer Lead 02", codes)).toBe("02");
    expect(tenantCodeFromSubject("Neuer Lead ID: 01", codes)).toBe("01");
    expect(tenantCodeFromSubject("Lead #02 Facebook", codes)).toBe("02");
    expect(tenantCodeFromSubject("[01] Neuer Lead", codes)).toBe("01");
  });

  it("ignoriert Datum, Uhrzeit, längere Zahlen und unbekannte IDs", () => {
    expect(tenantCodeFromSubject("Lead vom 01.02.2026 um 02:01", codes)).toBeNull();
    expect(tenantCodeFromSubject("Auftrag 1201", codes)).toBeNull();
    expect(tenantCodeFromSubject("Neuer Lead 42", codes)).toBeNull();
    expect(tenantCodeFromSubject(null, codes)).toBeNull();
  });

  it("bevorzugt die markierte ID vor anderen Zahlen", () => {
    expect(tenantCodeFromSubject("01 Leads – ID 02", codes)).toBe("02");
  });
});

describe("nextFreeTenantCode", () => {
  it("vergibt die kleinste freie ID ab 01", () => {
    expect(nextFreeTenantCode(["00", "99"])).toBe("01");
    expect(nextFreeTenantCode(["00", "01", "03"])).toBe("02");
  });
});

describe("Mandanten-Pfade", () => {
  it("baut Pfade mit Kürzel", () => {
    expect(tenantPath("martin")).toBe("/martin/dashboard");
    expect(tenantPath("martin", "/leads")).toBe("/martin/leads");
    expect(tenantPath("martin", "leads/1")).toBe("/martin/leads/1");
  });

  it("liest das Kürzel aus dem Pfad", () => {
    expect(slugFromPath("/martin/leads/1")).toBe("martin");
    expect(slugFromPath("/Function-Concept")).toBe("function-concept");
    expect(slugFromPath("/")).toBeNull();
    expect(slugFromPath("/api/cron/mailbox")).toBeNull();
  });

  it("prüft Kürzel und reservierte Wörter", () => {
    expect(isValidSlug("martin")).toBe(true);
    expect(isValidSlug("mayer-versicherung")).toBe(true);
    expect(isValidSlug("-martin")).toBe(false);
    expect(isValidSlug("Martin")).toBe(false);
    expect(isValidSlug("api")).toBe(false);
    expect(isValidSlug("platform")).toBe(false);
  });
});

describe("Feature-Schalter", () => {
  it("Entwicklungs-Mandant hat alles, andere nur Freigeschaltetes", () => {
    expect(hasFeature({ isDevelopment: true, features: "" }, "leads-csv-export")).toBe(true);
    expect(hasFeature({ isDevelopment: false, features: "" }, "leads-csv-export")).toBe(false);
    expect(hasFeature({ isDevelopment: false, features: "andere,leads-csv-export" }, "leads-csv-export")).toBe(true);
    expect(serializeFeatures(parseFeatures(" a, b ,,a"))).toBe("a,b");
  });
});
