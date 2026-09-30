import "server-only";
import { promises as dns } from "node:dns";
import { dnsRecordFor, type DnsTarget } from "./hosts";

/**
 * Domains der Kunden-Dashboards im Vercel-Projekt verwalten.
 * Ohne VERCEL_TOKEN/VERCEL_PROJECT_ID wird die Domain nur per DNS-Abfrage geprüft
 * und muss im Vercel-Dashboard von Hand hinzugefügt werden.
 */
export function vercelConfigured(): boolean {
  return Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
}

async function vercelFetch(path: string, init?: RequestInit) {
  const url = new URL(`https://api.vercel.com${path}`);
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set("teamId", process.env.VERCEL_TEAM_ID);
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

const project = () => encodeURIComponent(process.env.VERCEL_PROJECT_ID ?? "");

/** Fügt die Domain dem Vercel-Projekt hinzu (bereits vorhanden gilt als Erfolg). */
export async function addDomainToVercel(hostname: string): Promise<{ ok: boolean; message?: string }> {
  if (!vercelConfigured()) return { ok: false, message: "Vercel-API nicht konfiguriert – Domain bitte im Vercel-Dashboard hinzufügen." };
  const res = await vercelFetch(`/v10/projects/${project()}/domains`, { method: "POST", body: JSON.stringify({ name: hostname }) });
  if (res.ok || res.body?.error?.code === "domain_already_in_use_by_project" || res.status === 409) return { ok: true };
  return { ok: false, message: res.body?.error?.message ?? `Vercel-Fehler ${res.status}` };
}

export async function removeDomainFromVercel(hostname: string): Promise<void> {
  if (!vercelConfigured()) return;
  await vercelFetch(`/v9/projects/${project()}/domains/${encodeURIComponent(hostname)}`, { method: "DELETE" });
}

export type DomainCheck = { connected: boolean; message: string };

/** Prüft, ob die Domain korrekt auf das Dashboard zeigt. */
export async function checkDomain(hostname: string, target: DnsTarget): Promise<DomainCheck> {
  const bare = hostname.split(":")[0];
  if (bare === "localhost" || bare.endsWith(".localhost")) return { connected: true, message: "Lokale Domain" };

  if (vercelConfigured()) {
    const [domain, config] = await Promise.all([
      vercelFetch(`/v9/projects/${project()}/domains/${encodeURIComponent(bare)}`),
      vercelFetch(`/v6/domains/${encodeURIComponent(bare)}/config`),
    ]);
    if (!domain.ok) return { connected: false, message: "Domain ist noch nicht im Vercel-Projekt eingetragen." };
    if (domain.body?.verified === false) return { connected: false, message: "Vercel wartet auf die Verifizierung der Domain." };
    if (config.body?.misconfigured) return { connected: false, message: "DNS-Eintrag fehlt oder zeigt noch nicht auf Vercel." };
    return { connected: true, message: "Verbunden (Vercel)" };
  }

  // Ohne Vercel-API: DNS direkt mit der Vorgabe aus den Plattform-Einstellungen vergleichen.
  const record = dnsRecordFor(bare, target);
  try {
    if (record.type === "CNAME") {
      const values = await dns.resolveCname(bare);
      const ok = values.some((v) => v.replace(/\.$/, "").toLowerCase() === record.value.toLowerCase());
      return ok
        ? { connected: true, message: "CNAME zeigt korrekt auf das Dashboard." }
        : { connected: false, message: `CNAME zeigt auf ${values.join(", ")} statt auf ${record.value}.` };
    }
    const values = await dns.resolve4(bare);
    return values.includes(record.value)
      ? { connected: true, message: "A-Eintrag zeigt korrekt auf das Dashboard." }
      : { connected: false, message: `A-Eintrag zeigt auf ${values.join(", ")} statt auf ${record.value}.` };
  } catch {
    return { connected: false, message: `Kein ${record.type}-Eintrag gefunden.` };
  }
}
