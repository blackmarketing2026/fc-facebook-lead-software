import { describe, expect, it } from "vitest";
import { hasFeature } from "@/lib/features";
import { handoffError } from "@/lib/handoff";
import { dnsRecordFor, isPlatformHost, normalizeHost, originFor, parseHostnameInput } from "@/lib/hosts";
import { parseLeadText } from "@/lib/lead-parser";
import { resolveTenantId, type RouteRule } from "@/lib/lead-routing";

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

describe("hosts", () => {
  it("normalisiert Hosts und Eingaben", () => {
    expect(normalizeHost("Leads.Martin.DE.")).toBe("leads.martin.de");
    expect(parseHostnameInput("https://Leads.Martin.de/login")).toBe("leads.martin.de");
    expect(parseHostnameInput("martin.localhost:3000")).toBe("martin.localhost:3000");
    expect(parseHostnameInput("kein host")).toBeNull();
  });

  it("erkennt die Plattform-Domain", () => {
    const env = { APP_URL: "https://leads.function-concept.com", PLATFORM_HOSTS: "admin.function-concept.com" };
    expect(isPlatformHost("leads.function-concept.com", env)).toBe(true);
    expect(isPlatformHost("admin.function-concept.com", env)).toBe(true);
    expect(isPlatformHost("localhost:3000", env)).toBe(true);
    expect(isPlatformHost("fc-facebook-lead-software.vercel.app", env)).toBe(true);
    expect(isPlatformHost("leads.martin.de", env)).toBe(false);
    expect(isPlatformHost("dev.localhost:3000", env)).toBe(false);
  });

  it("gibt den passenden DNS-Eintrag vor", () => {
    const target = { cnameTarget: "cname.vercel-dns.com", aRecord: "76.76.21.21" };
    expect(dnsRecordFor("leads.martin.de", target)).toEqual({ type: "CNAME", name: "leads", value: "cname.vercel-dns.com" });
    expect(dnsRecordFor("martin.de", target)).toEqual({ type: "A", name: "@", value: "76.76.21.21" });
  });

  it("nutzt lokal http, sonst https", () => {
    expect(originFor("dev.localhost:3000")).toBe("http://dev.localhost:3000");
    expect(originFor("leads.martin.de")).toBe("https://leads.martin.de");
  });
});

describe("Feature-Schalter", () => {
  it("Entwicklungs-Mandant hat alles, andere nur Freigeschaltetes", () => {
    expect(hasFeature({ isDevelopment: true, features: [] }, "leads-csv-export")).toBe(true);
    expect(hasFeature({ isDevelopment: false, features: [] }, "leads-csv-export")).toBe(false);
    expect(hasFeature({ isDevelopment: false, features: ["leads-csv-export"] }, "leads-csv-export")).toBe(true);
  });
});

describe("Handoff-Token", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  const valid = { tenantId: "t1", expiresAt: new Date(now.getTime() + 30_000), usedAt: null };

  it("akzeptiert gültige Tokens", () => {
    expect(handoffError(valid, "t1", now)).toBeNull();
  });

  it("lehnt benutzte, abgelaufene und fremde Tokens ab", () => {
    expect(handoffError(null, "t1", now)).not.toBeNull();
    expect(handoffError({ ...valid, usedAt: now }, "t1", now)).toMatch(/bereits/);
    expect(handoffError({ ...valid, expiresAt: new Date(now.getTime() - 1) }, "t1", now)).toMatch(/abgelaufen/);
    expect(handoffError(valid, "t2", now)).toMatch(/anderen/);
  });
});
