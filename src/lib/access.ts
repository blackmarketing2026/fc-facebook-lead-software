import "server-only";
import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { db } from "./db";
import type { getCurrentUser } from "./session";

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Vertriebler sehen nur ihre eigenen Leads, der Admin sieht alle. */
export function leadScope(user: CurrentUser): Prisma.LeadWhereInput {
  return user.role === "ADMIN" ? {} : { assignedToId: user.id };
}

/** Lädt einen Lead nur, wenn der Benutzer Zugriff hat – sonst 404. */
export async function getAccessibleLeadOr404(user: CurrentUser, leadId: string) {
  const lead = await db.lead.findFirst({ where: { id: leadId, ...leadScope(user) }, select: { id: true } });
  if (!lead) notFound();
  return lead;
}
