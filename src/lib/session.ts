import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { PLATFORM_TENANT_SLUG } from "./hosts";
import { getTenant } from "./tenant";

const COOKIE = "lc_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 Tage

/** operator = Plattform-Admin, der per "Öffnen" in einem fremden Mandanten arbeitet. */
export type SessionPayload = { userId: string; tenantId: string; role: Role; operator?: boolean };

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen");
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, key(), { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

/**
 * Aktueller Benutzer aus der DB (deaktivierte Benutzer gelten als abgemeldet).
 * Die Session gilt nur für den Mandanten der aufgerufenen Domain.
 */
export const getCurrentUser = cache(async () => {
  const [session, tenant] = await Promise.all([readSession(), getTenant()]);
  if (!session || !tenant || session.tenantId !== tenant.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
      active: true,
      tenantId: true,
      isPlatformAdmin: true,
    },
  });
  if (!user?.active) return null;

  if (session.operator) {
    // Plattform-Zugriff: arbeitet als Admin im Ziel-Mandanten.
    if (!user.isPlatformAdmin) return null;
    return { ...user, role: "ADMIN" as Role, tenantId: tenant.id, operator: true, tenant };
  }
  if (user.tenantId !== tenant.id) return null;
  return { ...user, operator: false, tenant };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const tenant = await getTenant();
  if (!tenant) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Gesperrte Dashboards: nur der Plattform-Admin kommt noch hinein.
  if (tenant.status === "SUSPENDED" && !user.operator) redirect("/suspended");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

/** Plattform-Bereich: nur auf der Function-Concept-Domain und nur mit eigenem Login (nicht per "Öffnen"). */
export async function getPlatformAdmin() {
  const user = await getCurrentUser();
  if (!user || user.operator || !user.isPlatformAdmin || user.tenant.slug !== PLATFORM_TENANT_SLUG) return null;
  return user;
}

export async function requirePlatformAdmin() {
  await requireUser();
  const admin = await getPlatformAdmin();
  if (!admin) notFound();
  return admin;
}
