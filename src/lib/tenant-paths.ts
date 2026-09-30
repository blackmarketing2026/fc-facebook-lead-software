/** Produktname, den der Plattform-Mandant (Function Concept) im Kopf und Titel zeigt. */
export const PRODUCT_NAME = "Function Concept - Facebook Lead Software";

/** Slug des Plattform-Mandanten, dem alle bisherigen Daten gehören. */
export const PLATFORM_TENANT_SLUG = "function-concept";

/** Header, über den der Server den Mandanten der Anfrage kennt (setzt der Proxy aus dem Pfad). */
export const TENANT_HEADER = "x-tenant-slug";

/** Kürzel, die als erste Pfad-Ebene schon belegt sind und kein Mandant sein dürfen. */
export const RESERVED_SLUGS = new Set(["api", "_next", "login", "platform", "settings", "static", "public", "favicon.ico", "sw.js"]);

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug) && !RESERVED_SLUGS.has(slug);
}

/** Pfad innerhalb eines Mandanten: tenantPath("martin", "/leads") -> "/martin/leads". */
export function tenantPath(slug: string, path = "/dashboard"): string {
  return `/${slug}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Erste Pfad-Ebene = Mandanten-Kürzel ("/martin/leads" -> "martin"). */
export function slugFromPath(pathname: string): string | null {
  const first = pathname.split("/")[1];
  return first && !RESERVED_SLUGS.has(first) ? decodeURIComponent(first).toLowerCase() : null;
}
