import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { PLATFORM_TENANT_SLUG, PRODUCT_NAME, TENANT_HEADER } from "./tenant-paths";

export type CurrentTenant = NonNullable<Awaited<ReturnType<typeof getTenant>>>;

/** Mandant der Anfrage anhand der ersten Pfad-Ebene (/<slug>/…); null bei unbekanntem Kürzel. */
export const getTenant = cache(async () => {
  const slug = (await headers()).get(TENANT_HEADER);
  if (!slug) return null;
  return db.tenant.findUnique({ where: { slug } });
});

/** Mandant der Anfrage oder 404 (unbekanntes Kürzel). */
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
