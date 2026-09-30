import type { LeadStatus, Prisma } from "@prisma/client";
import { leadScope } from "./access";
import { parseBerlinLocal } from "./format";
import { STATUSES } from "./labels";
import type { CurrentUser } from "./session";

export type LeadListFilters = { q: string; status: LeadStatus | ""; assignee: string; from: string; to: string };

type Params = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}

export function leadListFilters(sp: Params): LeadListFilters {
  return {
    q: str(sp.q).trim(),
    status: str(sp.status) as LeadStatus | "",
    assignee: str(sp.assignee),
    from: str(sp.from),
    to: str(sp.to),
  };
}

/** Filter der Lead-Liste; gilt auch für den CSV-Export. */
export function leadListWhere(user: CurrentUser, f: LeadListFilters): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { ...leadScope(user) };
  if (f.status && STATUSES.includes(f.status)) where.status = f.status;
  if (user.role === "ADMIN" && f.assignee) where.assignedToId = f.assignee === "none" ? null : f.assignee;
  if (f.from || f.to) {
    where.receivedAt = {
      ...(f.from ? { gte: parseBerlinLocal(`${f.from}T00:00`) } : {}),
      ...(f.to ? { lt: new Date(parseBerlinLocal(`${f.to}T00:00`).getTime() + 24 * 60 * 60 * 1000) } : {}),
    };
  }
  if (f.q) {
    where.OR = [
      { fullName: { contains: f.q, mode: "insensitive" } },
      { email: { contains: f.q, mode: "insensitive" } },
      { phone: { contains: f.q.replace(/\s/g, "") } },
    ];
  }
  return where;
}
