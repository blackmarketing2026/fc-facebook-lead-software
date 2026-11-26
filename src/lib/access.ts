import "server-only";
import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { db } from "./db";
import type { CurrentUser } from "./session";

type ScopeUser = Pick<CurrentUser, "id" | "role" | "tenantId">;

/** Mandanten-Filter für Admin-Bereiche (Log, Postfach, Verteilungstest). */
export function tenantFilter(user: ScopeUser): { tenantId: string } {
  return { tenantId: user.tenantId };
}

/** Vertriebler sehen nur ihre eigenen Leads, Admins alle. */
export function leadScope(user: ScopeUser): Prisma.LeadWhereInput {
  return user.role === "ADMIN" ? { tenantId: user.tenantId } : { tenantId: user.tenantId, assignedToId: user.id };
}

/** Lädt einen Lead nur, wenn der Benutzer Zugriff hat – sonst 404. */
export async function getAccessibleLeadOr404(user: CurrentUser, leadId: string) {
  const lead = await db.lead.findFirst({ where: { id: leadId, ...leadScope(user) }, select: { id: true } });
  if (!lead) notFound();
  return lead;
}
