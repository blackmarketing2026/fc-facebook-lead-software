/** Produktname, den der Plattform-Mandant (Function Concept) im Kopf und Titel zeigt. */
export const PRODUCT_NAME = "Function Concept - Facebook Lead Software";

/** Slug des Plattform-Mandanten, dem alle bisherigen Daten gehören. */
export const PLATFORM_TENANT_SLUG = "function-concept";

/** "Leads.Martin.de." -> "leads.martin.de"; Port bleibt erhalten (lokal wichtig). */
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/\.$/, "");
}

/** Hostname aus einer Eingabe wie "https://leads.martin.de/login" oder "leads.martin.de". */
export function parseHostnameInput(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  try {
    const host = new URL(raw.includes("://") ? raw : `https://${raw}`).host;
    return /^[a-z0-9.-]+(:\d+)?$/.test(host) && host.includes(".") ? normalizeHost(host) : null;
  } catch {
    return null;
  }
}

/**
 * Domains, unter denen der Plattform-Mandant erreichbar ist, auch ohne Eintrag in TenantDomain:
 * PLATFORM_HOSTS (kommagetrennt), der Host aus APP_URL, localhost und Vercel-Deployment-URLs.
 */
export function isPlatformHost(host: string, env: Record<string, string | undefined> = process.env): boolean {
  const h = normalizeHost(host);
  if (!h) return false;
  const configured = (env.PLATFORM_HOSTS ?? "").split(",").map(normalizeHost).filter(Boolean);
  if (env.APP_URL) {
    try {
      configured.push(normalizeHost(new URL(env.APP_URL).host));
    } catch {
      // ungültige APP_URL ignorieren
    }
  }
  return configured.includes(h) || h === "localhost:3000" || h === "localhost" || h.endsWith(".vercel.app");
}

/** Lokale Domains (localhost) laufen ohne HTTPS. */
export function originFor(hostname: string): string {
  const bare = hostname.split(":")[0];
  const local = bare === "localhost" || bare.endsWith(".localhost");
  return `${local ? "http" : "https"}://${hostname}`;
}

/** Hauptdomain ohne Subdomain (z. B. "martin.de")? Dann braucht es einen A-Eintrag statt CNAME. */
export function isApexDomain(hostname: string): boolean {
  return hostname.split(":")[0].split(".").length <= 2;
}

export type DnsTarget = { cnameTarget: string; aRecord: string };

export type DnsRecord = { type: "A" | "CNAME"; name: string; value: string };

/** Der DNS-Eintrag, den der Kunde bei seinem Domain-Anbieter setzen muss. */
export function dnsRecordFor(hostname: string, target: DnsTarget): DnsRecord {
  const bare = hostname.split(":")[0];
  if (isApexDomain(bare)) return { type: "A", name: "@", value: target.aRecord };
  const labels = bare.split(".");
  return { type: "CNAME", name: labels.slice(0, -2).join("."), value: target.cnameTarget };
}
