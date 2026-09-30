/** Gültigkeit eines Einmal-Links vom Plattform-Bereich in einen Mandanten. */
export const HANDOFF_TTL_MS = 60 * 1000;

export type HandoffRow = { tenantId: string; expiresAt: Date; usedAt: Date | null };

export function handoffError(row: HandoffRow | null, tenantId: string, now = new Date()): string | null {
  if (!row) return "Link ungültig";
  if (row.usedAt) return "Link wurde bereits benutzt";
  if (row.expiresAt < now) return "Link ist abgelaufen";
  if (row.tenantId !== tenantId) return "Link gehört zu einem anderen Dashboard";
  return null;
}
