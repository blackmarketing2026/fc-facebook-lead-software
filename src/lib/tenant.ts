import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { isPlatformHost, normalizeHost, PLATFORM_TENANT_SLUG, PRODUCT_NAME } from "./hosts";

export type CurrentTenant = NonNullable<Awaited<ReturnType<typeof getTenant>>>;

/** Host der aktuellen Anfrage, z. B. "leads.martin.de" oder "localhost:3000". */
export const getHost = cache(async () => normalizeHost((await headers()).get("host")));

/** Mandant anhand der aufgerufenen Domain; null bei unbekannter Domain. */
export const getTenant = cache(async () => {
  const host = await getHost();
  const domain = await db.tenantDomain.findUnique({ where: { hostname: host }, include: { tenant: true } });
  if (domain) return domain.tenant;
  if (isPlatformHost(host)) return getPlatformTenant();
  return null;
});

export const getPlatformTenant = cache(async () => {
  return db.tenant.findUniqueOrThrow({ where: { slug: PLATFORM_TENANT_SLUG } });
});

/** Mandant der Anfrage oder 404 (unbekannte Domain). */
export async function requireTenant() {
  const tenant = await getTenant();
  if (!tenant) notFound();
  return tenant;
}

/** Anzeigename im Kopf und Seitentitel: Kunden sehen ihren eigenen Namen. */
export function displayName(tenant: { slug: string; name: string } | null): string {
  if (!tenant || tenant.slug === PLATFORM_TENANT_SLUG) return PRODUCT_NAME;
  return tenant.name;
}

/** Werte aus den Plattform-Einstellungen, die Kunden in ihrem DNS eintragen. */
export async function getDnsTarget() {
  const rows = await db.setting.findMany({ where: { key: { in: ["platform.cnameTarget", "platform.aRecord"] } } });
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  return {
    cnameTarget: get("platform.cnameTarget") || "cname.vercel-dns.com",
    aRecord: get("platform.aRecord") || "76.76.21.21",
  };
}
