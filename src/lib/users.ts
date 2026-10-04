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
