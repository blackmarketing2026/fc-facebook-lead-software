/** Server-side emergency lock. The DB's active/status flags remain authoritative. */
export const ACCESS_DENIED_MESSAGE = "Zugriff verweigert";
const BLOCKED_NAMES = new Set(["martin", "selina", "frances", "francis"]);
const BLOCKED_TENANT = /(^|[^a-z])(engels?|guido)(?=$|[^a-z])/i;
export function isRestrictedUser(user: { username: string | null; displayName: string | null; isPlatformAdmin?: boolean }): boolean {
  if (user.isPlatformAdmin) return false; // Function Concept master stays available.
  const username = (user.username ?? "").trim().toLowerCase();
  const firstName = (user.displayName ?? "").trim().toLowerCase().split(/[\s._-]+/)[0];
  return BLOCKED_NAMES.has(username) || BLOCKED_NAMES.has(firstName);
}
export function isRestrictedTenant(tenant: { slug: string; name: string }): boolean {
  return BLOCKED_TENANT.test(tenant.slug) || BLOCKED_TENANT.test(tenant.name);
}
export function isTenantLocked(tenant: { slug: string; name: string }): boolean {
  return isRestrictedTenant(tenant);
}
