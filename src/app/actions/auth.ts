"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, deleteSession, readSession } from "@/lib/session";
import { isRestrictedUser, isTenantLocked } from "@/lib/access-lock";
import { getTenant } from "@/lib/tenant";
import { tenantLoginPath, tenantPath } from "@/lib/tenant-paths";

export type LoginState = { error?: string } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const login = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!login || !password) return { error: "Bitte E-Mail und Passwort eingeben." };

  // Benutzer gelten pro Dashboard: angemeldet wird im Mandanten aus dem Pfad (/<slug>/login).
  const tenant = await getTenant();
  if (!tenant) return { error: "Unbekanntes Dashboard." };
  if (isTenantLocked(tenant)) redirect(tenantPath(tenant.slug, "/denied"));

  // Anmeldung mit E-Mail; Benutzernamen aus der Zeit vor der Umstellung funktionieren weiterhin.
  const user = login.includes("@")
    ? await db.user.findFirst({ where: { tenantId: tenant.id, email: login } })
    : await db.user.findUnique({ where: { tenantId_username: { tenantId: tenant.id, username: login } } });
  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) return { error: "E-Mail oder Passwort ist falsch." };
  if (!user.active || isRestrictedUser(user)) redirect(tenantPath(tenant.slug, "/denied"));

  await createSession({ userId: user.id, tenantId: tenant.id, role: user.role }, tenant.slug);
  redirect(tenantPath(tenant.slug));
}

export async function logout() {
  const tenant = await getTenant();
  if (!tenant) redirect("/");
  const session = await readSession();
  const account = session?.tenantId === tenant.id
    ? await db.user.findUnique({ where: { id: session.userId }, select: { active: true, username: true, displayName: true, isPlatformAdmin: true } })
    : null;
  const denied = isTenantLocked(tenant) || Boolean(account && (!account.active || isRestrictedUser(account)));
  await deleteSession(tenant.slug);
  redirect(denied ? tenantPath(tenant.slug, "/denied") : tenantLoginPath(tenant.slug));
}
