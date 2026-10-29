import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { PLATFORM_TENANT_SLUG, tenantLoginPath, tenantPath } from "./tenant-paths";
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

/**
 * Das Cookie gilt nur für /<slug>: So kann man gleichzeitig in mehreren Dashboards angemeldet sein
 * (z. B. als Plattform-Admin bei Function Concept und per "Öffnen" bei einem Kunden).
 */
export async function createSession(payload: SessionPayload, slug: string) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/${slug}`,
    maxAge: MAX_AGE,
  });
}

export async function deleteSession(slug: string) {
  (await cookies()).delete({ name: COOKIE, path: `/${slug}` });
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
      tenant: { select: { slug: true } },
      isPlatformAdmin: true,
      isTenantMaster: true,
      platformGrants: { select: { tenantId: true } },
    },
  });
  if (!user?.active) return null;

  if (session.operator) {
    // Jede Anfrage prüft die aktuelle Freigabe erneut, auch bei bestehender Session.
    const master = user.isPlatformAdmin && user.role === "ADMIN" && user.tenant.slug === PLATFORM_TENANT_SLUG;
    if (!master && !user.platformGrants.some((grant) => grant.tenantId === tenant.id)) return null;
    return { ...user, role: "ADMIN" as Role, tenantId: tenant.id, homeTenantSlug: user.tenant.slug, operator: true, tenant };
  }
  if (user.tenantId !== tenant.id) return null;
  const role = user.platformGrants.some((grant) => grant.tenantId === tenant.id) ? "ADMIN" as Role : user.role;
  return { ...user, role, homeTenantSlug: user.tenant.slug, operator: false, tenant };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const tenant = await getTenant();
  if (!tenant) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(tenantLoginPath(tenant.slug));
  // Gesperrte Dashboards: nur der Plattform-Admin kommt noch hinein.
  if (tenant.status === "SUSPENDED" && !user.operator) redirect(tenantPath(tenant.slug, "/suspended"));
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect(tenantPath(user.tenant.slug));
  return user;
}

/** Plattform-Bereich: nur unter /function-concept und nur mit eigenem Login (nicht per "Öffnen"). */
export async function getPlatformAdmin() {
  const user = await getCurrentUser();
  if (!user || user.operator || user.role !== "ADMIN" || !user.isPlatformAdmin || user.tenant.slug !== PLATFORM_TENANT_SLUG) return null;
  return user;
}

/** Master oder Mitglied mit mindestens einer zugewiesenen Plattform. */
export async function getPlatformManager() {
  const user = await getCurrentUser();
  if (!user || user.operator) return null;
  if (user.isPlatformAdmin && user.role === "ADMIN" && user.tenant.slug === PLATFORM_TENANT_SLUG) return user;
  return user.platformGrants.length > 0 ? user : null;
}

export async function requirePlatformManager() {
  await requireUser();
  const manager = await getPlatformManager();
  if (!manager) notFound();
  return manager;
}

export async function requirePlatformAdmin() {
  await requireUser();
  const admin = await getPlatformAdmin();
  if (!admin) notFound();
  return admin;
}
