"use server";

import { randomBytes } from "node:crypto";
import { Prisma, type LeadRouteType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { FEATURE_KEYS } from "@/lib/features";
import { HANDOFF_TTL_MS } from "@/lib/handoff";
import { originFor, parseHostnameInput, PLATFORM_TENANT_SLUG } from "@/lib/hosts";
import { requirePlatformAdmin } from "@/lib/session";
import { getDnsTarget } from "@/lib/tenant";
import { addDomainToVercel, checkDomain, removeDomainFromVercel } from "@/lib/vercel";

export type PlatformState = { error?: string; ok?: string } | undefined;

function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "Ungültige Eingabe";
}

function isUniqueError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function refresh(tenantId?: string) {
  revalidatePath("/platform");
  if (tenantId) revalidatePath(`/platform/tenants/${tenantId}`);
}

const adminSchema = z.object({
  adminDisplayName: z.string().trim().min(1, "Name des Admins fehlt").max(60),
  adminUsername: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,32}$/, "Benutzername: 3–32 Zeichen, nur a–z, 0–9, Punkt, Minus, Unterstrich"),
  adminEmail: z.email("Ungültige E-Mail-Adresse des Admins"),
  adminPassword: z.string().min(8, "Passwort muss mindestens 8 Zeichen haben"),
});

const tenantSchema = z.object({
  name: z.string().trim().min(1, "Name fehlt").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, "Kürzel: 2–40 Zeichen, nur a–z, 0–9 und Minus"),
});

/** Neues Kunden-Dashboard mit erstem Admin (z. B. Martin) und optional eigener Domain. */
export async function createTenant(_prev: PlatformState, formData: FormData): Promise<PlatformState> {
  await requirePlatformAdmin();
  const data = Object.fromEntries(formData);
  const tenant = tenantSchema.safeParse(data);
  if (!tenant.success) return { error: firstError(tenant.error) };
  const admin = adminSchema.safeParse(data);
  if (!admin.success) return { error: firstError(admin.error) };

  const domainInput = String(formData.get("domain") ?? "").trim();
  const hostname = domainInput ? parseHostnameInput(domainInput) : null;
  if (domainInput && !hostname) return { error: "Ungültige Domain, z. B. leads.martin-versicherung.de" };

  let tenantId: string;
  try {
    const created = await db.tenant.create({
      data: {
        ...tenant.data,
        isDevelopment: formData.get("isDevelopment") === "on",
        domains: hostname ? { create: { hostname } } : undefined,
        users: {
          create: {
            username: admin.data.adminUsername,
            displayName: admin.data.adminDisplayName,
            email: admin.data.adminEmail,
            role: "ADMIN",
            passwordHash: await bcrypt.hash(admin.data.adminPassword, 12),
          },
        },
      },
    });
    tenantId = created.id;
  } catch (err) {
    if (isUniqueError(err)) return { error: "Kürzel oder Domain ist schon vergeben." };
    throw err;
  }

  if (hostname) await addDomainToVercel(hostname);
  refresh();
  redirect(`/platform/tenants/${tenantId}`);
}

export async function renameTenant(tenantId: string, _prev: PlatformState, formData: FormData): Promise<PlatformState> {
  await requirePlatformAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name fehlt" };
  await db.tenant.update({ where: { id: tenantId }, data: { name, isDevelopment: formData.get("isDevelopment") === "on" } });
  refresh(tenantId);
  return { ok: "Gespeichert." };
}

export async function setTenantStatus(tenantId: string, status: "ACTIVE" | "SUSPENDED") {
  await requirePlatformAdmin();
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  if (tenant.slug === PLATFORM_TENANT_SLUG) throw new Error("Das Plattform-Dashboard kann nicht gesperrt werden");
  await db.tenant.update({ where: { id: tenantId }, data: { status } });
  refresh(tenantId);
}

export async function setFeature(tenantId: string, key: string, enabled: boolean) {
  await requirePlatformAdmin();
  if (!FEATURE_KEYS.includes(key)) throw new Error("Unbekanntes Feature");
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { features: true } });
  const features = enabled ? [...new Set([...tenant.features, key])] : tenant.features.filter((f) => f !== key);
  await db.tenant.update({ where: { id: tenantId }, data: { features } });
  refresh(tenantId);
}

export async function addDomain(tenantId: string, _prev: PlatformState, formData: FormData): Promise<PlatformState> {
  await requirePlatformAdmin();
  const hostname = parseHostnameInput(String(formData.get("domain") ?? ""));
  if (!hostname) return { error: "Ungültige Domain, z. B. leads.martin-versicherung.de" };
  try {
    await db.tenantDomain.create({ data: { tenantId, hostname } });
  } catch (err) {
    if (isUniqueError(err)) return { error: "Diese Domain ist schon einem Dashboard zugeordnet." };
    throw err;
  }
  const vercel = await addDomainToVercel(hostname);
  refresh(tenantId);
  return vercel.ok ? { ok: "Domain hinzugefügt und in Vercel eingetragen." } : { ok: `Domain hinzugefügt. ${vercel.message}` };
}

export async function removeDomain(domainId: string) {
  await requirePlatformAdmin();
  const domain = await db.tenantDomain.delete({ where: { id: domainId } });
  await removeDomainFromVercel(domain.hostname);
  refresh(domain.tenantId);
}

export async function verifyDomain(domainId: string) {
  await requirePlatformAdmin();
  const domain = await db.tenantDomain.findUniqueOrThrow({ where: { id: domainId } });
  const result = await checkDomain(domain.hostname, await getDnsTarget());
  await db.tenantDomain.update({ where: { id: domainId }, data: { verified: result.connected, lastCheckedAt: new Date() } });
  refresh(domain.tenantId);
}

const routeSchema = z.object({
  type: z.enum(["RECIPIENT", "SUBJECT", "JSON_FIELD"]),
  pattern: z.string().trim().min(1, "Muster fehlt").max(200),
  priority: z.coerce.number().int().min(-100).max(100).default(0),
});

export async function addRoute(tenantId: string, _prev: PlatformState, formData: FormData): Promise<PlatformState> {
  await requirePlatformAdmin();
  const parsed = routeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (parsed.data.type === "JSON_FIELD" && !parsed.data.pattern.split("=")[0].trim()) {
    return { error: "JSON-Feld im Format feldname=wert angeben" };
  }
  await db.leadRoute.create({ data: { tenantId, ...parsed.data, type: parsed.data.type as LeadRouteType } });
  refresh(tenantId);
  return { ok: "Regel angelegt." };
}

export async function deleteRoute(routeId: string) {
  await requirePlatformAdmin();
  const route = await db.leadRoute.delete({ where: { id: routeId } });
  refresh(route.tenantId);
}

/** Weiteren Admin in einem Kunden-Dashboard anlegen (z. B. Martin als Hauptnutzer). */
export async function addTenantAdmin(tenantId: string, _prev: PlatformState, formData: FormData): Promise<PlatformState> {
  await requirePlatformAdmin();
  const admin = adminSchema.safeParse(Object.fromEntries(formData));
  if (!admin.success) return { error: firstError(admin.error) };
  try {
    await db.user.create({
      data: {
        tenantId,
        username: admin.data.adminUsername,
        displayName: admin.data.adminDisplayName,
        email: admin.data.adminEmail,
        role: "ADMIN",
        passwordHash: await bcrypt.hash(admin.data.adminPassword, 12),
      },
    });
  } catch (err) {
    if (isUniqueError(err)) return { error: "Dieser Benutzername ist in diesem Dashboard schon vergeben." };
    throw err;
  }
  refresh(tenantId);
  return { ok: "Admin angelegt." };
}

/** "Öffnen": Einmal-Link erzeugen und ohne Passwort ins Kunden-Dashboard springen. */
export async function openTenant(tenantId: string) {
  const admin = await requirePlatformAdmin();
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    include: { domains: { orderBy: [{ verified: "desc" }, { createdAt: "asc" }] } },
  });
  if (tenant.id === admin.tenantId) redirect("/dashboard");
  const domain = tenant.domains[0];
  if (!domain) throw new Error("Dieses Dashboard hat noch keine Domain");

  const token = randomBytes(32).toString("hex");
  await db.handoffToken.create({
    data: { id: token, userId: admin.id, tenantId: tenant.id, expiresAt: new Date(Date.now() + HANDOFF_TTL_MS) },
  });
  // Abgelaufene Tokens nebenbei aufräumen.
  await db.handoffToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  redirect(`${originFor(domain.hostname)}/auth/handoff?token=${token}`);
}

export async function savePlatformSettings(_prev: PlatformState, formData: FormData): Promise<PlatformState> {
  await requirePlatformAdmin();
  const cnameTarget = String(formData.get("cnameTarget") ?? "").trim().toLowerCase().replace(/\.$/, "");
  const aRecord = String(formData.get("aRecord") ?? "").trim();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cnameTarget)) return { error: "CNAME-Ziel muss ein Hostname sein, z. B. cname.vercel-dns.com" };
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(aRecord)) return { error: "A-Eintrag muss eine IPv4-Adresse sein, z. B. 76.76.21.21" };
  await db.$transaction([
    db.setting.upsert({ where: { key: "platform.cnameTarget" }, create: { key: "platform.cnameTarget", value: cnameTarget }, update: { value: cnameTarget } }),
    db.setting.upsert({ where: { key: "platform.aRecord" }, create: { key: "platform.aRecord", value: aRecord }, update: { value: aRecord } }),
  ]);
  revalidatePath("/platform", "layout");
  revalidatePath("/settings/domain");
  return { ok: "Gespeichert." };
}
