"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import { getTenant } from "@/lib/tenant";
import { tenantPath } from "@/lib/tenant-paths";

export type LoginState = { error?: string } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const login = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!login || !password) return { error: "Bitte E-Mail und Passwort eingeben." };

  // Benutzer gelten pro Dashboard: angemeldet wird im Mandanten aus dem Pfad (/<slug>/login).
  const tenant = await getTenant();
  if (!tenant) return { error: "Unbekanntes Dashboard." };
  if (tenant.status === "SUSPENDED") redirect(tenantPath(tenant.slug, "/suspended"));

  // Anmeldung mit E-Mail; Benutzernamen aus der Zeit vor der Umstellung funktionieren weiterhin.
  const user = login.includes("@")
    ? await db.user.findFirst({ where: { tenantId: tenant.id, email: login, active: true } })
    : await db.user.findUnique({ where: { tenantId_username: { tenantId: tenant.id, username: login } } });
  const valid = user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) return { error: "E-Mail oder Passwort ist falsch." };

  await createSession({ userId: user.id, tenantId: tenant.id, role: user.role }, tenant.slug);
  redirect(tenantPath(tenant.slug));
}

export async function logout() {
  const tenant = await getTenant();
  if (!tenant) redirect("/");
  await deleteSession(tenant.slug);
  redirect(tenantPath(tenant.slug, "/login"));
}
