"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import { getTenant } from "@/lib/tenant";

export type LoginState = { error?: string } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Bitte Benutzername und Passwort eingeben." };

  // Benutzernamen gelten pro Dashboard: angemeldet wird im Mandanten der aufgerufenen Domain.
  const tenant = await getTenant();
  if (!tenant) return { error: "Unbekanntes Dashboard." };
  if (tenant.status === "SUSPENDED") redirect("/suspended");

  const user = await db.user.findUnique({ where: { tenantId_username: { tenantId: tenant.id, username } } });
  const valid = user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) return { error: "Benutzername oder Passwort ist falsch." };

  await createSession({ userId: user.id, tenantId: tenant.id, role: user.role });
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
