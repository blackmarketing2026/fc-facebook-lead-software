"use server";

import { Prisma, type LeadRouteType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { FEATURE_KEYS, parseFeatures, serializeFeatures } from "@/lib/features";
import { createSession, requirePlatformAdmin } from "@/lib/session";
import { isValidSlug, PLATFORM_TENANT_SLUG, tenantPath } from "@/lib/tenant-paths";

export type PlatformState = { error?: string; ok?: string } | undefined;

const PLATFORM = tenantPath(PLATFORM_TENANT_SLUG, "/platform");

function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "Ungültige Eingabe";
}

function isUniqueError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function refresh(tenantId?: string) {
  revalidatePath(PLATFORM);
  if (tenantId) revalidatePath(`${PLATFORM}/tenants/${tenantId}`);
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
    .refine(isValidSlug, "Kürzel: 1–40 Zeichen, nur a–z, 0–9 und Minus (nicht am Anfang/Ende); einige Wörter sind reserviert"),
});

/** Neues Kunden-Dashboard unter /<kürzel> mit erstem Admin (z. B. Martin). */
export async function createTenant(_prev: PlatformState, formData: FormData): Promise<PlatformState> {
  await requirePlatformAdmin();
  const data = Object.fromEntries(formData);
  const tenant = tenantSchema.safeParse(data);
  if (!tenant.success) return { error: firstError(tenant.error) };

  // Admin ist optional: alle Felder leer → Dashboard ohne Benutzer (Zugang über den Master-Login).
  const wantsAdmin = Object.keys(adminSchema.shape).some((k) => String(data[k] ?? "").trim() !== "");
  const admin = wantsAdmin ? adminSchema.safeParse(data) : null;
  if (admin && !admin.success) return { error: firstError(admin.error) };

  let tenantId: string;
  try {
    const created = await db.tenant.create({
      data: {
        ...tenant.data,
        isDevelopment: formData.get("isDevelopment") === "on",
        ...(admin?.success && {
          users: {
            create: {
              username: admin.data.adminUsername,
              displayName: admin.data.adminDisplayName,
              email: admin.data.adminEmail,
              role: "ADMIN",
              passwordHash: await bcrypt.hash(admin.data.adminPassword, 12),
            },
          },
        }),
      },
    });
    tenantId = created.id;
  } catch (err) {
    if (isUniqueError(err)) return { error: "Dieses Kürzel ist schon vergeben." };
    throw err;
  }

  refresh();
  redirect(`${PLATFORM}/tenants/${tenantId}`);
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
  const current = parseFeatures(tenant.features);
  const features = serializeFeatures(enabled ? [...current, key] : current.filter((f) => f !== key));
  await db.tenant.update({ where: { id: tenantId }, data: { features } });
  refresh(tenantId);
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

/** "Öffnen": ohne Passwort als Admin ins Kunden-Dashboard (Session gilt nur für dessen Pfad). */
export async function openTenant(tenantId: string) {
  const admin = await requirePlatformAdmin();
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  if (tenant.id !== admin.tenantId) {
    await createSession({ userId: admin.id, tenantId: tenant.id, role: "ADMIN", operator: true }, tenant.slug);
  }
  redirect(tenantPath(tenant.slug));
}
