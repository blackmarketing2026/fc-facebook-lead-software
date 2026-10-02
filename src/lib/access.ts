import "server-only";
import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { db } from "./db";
import type { CurrentUser } from "./session";
import { PLATFORM_TENANT_SLUG } from "./tenant-paths";

type ScopeUser = Pick<CurrentUser, "id" | "role" | "tenantId" | "isPlatformAdmin" | "operator"> & { tenant: { slug: string } };

/** Hauptaccount: Plattform-Admin mit eigenem Login im Plattform-Dashboard sieht die Leads aller Dashboards. */
export function seesAllTenants(user: ScopeUser): boolean {
  return user.role === "ADMIN" && user.isPlatformAdmin && !user.operator && user.tenant.slug === PLATFORM_TENANT_SLUG;
}

/** Nur Leads des eigenen Mandanten; Vertriebler sehen davon nur ihre eigenen, der Admin alle. */
export function leadScope(user: ScopeUser): Prisma.LeadWhereInput {
  if (seesAllTenants(user)) return {};
  return user.role === "ADMIN" ? { tenantId: user.tenantId } : { tenantId: user.tenantId, assignedToId: user.id };
}

/** Lädt einen Lead nur, wenn der Benutzer Zugriff hat – sonst 404. */
export async function getAccessibleLeadOr404(user: CurrentUser, leadId: string) {
  const lead = await db.lead.findFirst({ where: { id: leadId, ...leadScope(user) }, select: { id: true } });
  if (!lead) notFound();
  return lead;
}
