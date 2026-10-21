import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Mitglieder werden nur noch mit E-Mail angelegt. Die Spalte "username" bleibt für bestehende Logins
 * erhalten und wird intern aus der E-Mail erzeugt (eindeutig pro Dashboard).
 */
export async function usernameFromEmail(db: Db, tenantId: string, email: string): Promise<string> {
  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 28)
      .padEnd(3, "0") || "user";
  const taken = new Set(
    (await db.user.findMany({ where: { tenantId, username: { startsWith: base } }, select: { username: true } })).map(
      (u) => u.username,
    ),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** E-Mail ist der Login und muss deshalb pro Dashboard eindeutig sein. */
export async function emailTaken(db: Db, tenantId: string, email: string, exceptUserId?: string): Promise<boolean> {
  const existing = await db.user.findFirst({
    where: { tenantId, email, ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}) },
    select: { id: true },
  });
  return Boolean(existing);
}

/**
 * Entfernt ein Mitglied endgültig – es kann sich danach nicht mehr anmelden (bestehende Sessions laufen ins Leere).
 * Seine Leads werden freigegeben, Notizen bleiben ohne Autor erhalten, persönliche Termine werden gelöscht.
 */
export async function removeMember(
  db: PrismaClient,
  tenantId: string,
  userId: string,
  actorId: string,
): Promise<{ error: string } | { removed: string }> {
  if (userId === actorId) return { error: "Du kannst dich nicht selbst entfernen." };
  const target = await db.user.findFirst({
    where: { id: userId, tenantId },
    select: { id: true, displayName: true, isPlatformAdmin: true, platformGrants: { select: { tenantId: true } } },
  });
  if (!target) return { error: "Mitglied nicht gefunden." };
  if (target.isPlatformAdmin) return { error: "Der Master-Account kann nicht entfernt werden." };
  if (target.platformGrants.length > 0) {
    const actor = await db.user.findUnique({ where: { id: actorId }, select: { isPlatformAdmin: true } });
    if (!actor?.isPlatformAdmin) return { error: "Dieses Mitglied mit Plattformrechten kann nur der Master-Admin entfernen." };
  }

  await db.$transaction([
    db.user.delete({ where: { id: target.id } }),
    // Zähler zurücksetzen, damit die Verteilung ohne das Mitglied sauber weiterläuft.
    db.user.updateMany({ where: { tenantId }, data: { distCurrent: 0 } }),
  ]);
  return { removed: target.displayName };
}
