import type { Prisma } from "@prisma/client";
import { leadScope } from "./access";
import { parseBerlinLocal } from "./format";
import type { CurrentUser } from "./session";

export type LeadListFilters = { q: string; stage: string; from: string; to: string };

type Params = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}

export function leadListFilters(sp: Params): LeadListFilters {
  return {
    q: str(sp.q).trim(),
    stage: str(sp.phase),
    from: str(sp.from),
    to: str(sp.to),
  };
}

/** Filter der Lead-Liste; gilt auch für den CSV-Export. */
export function leadListWhere(user: CurrentUser, f: LeadListFilters): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { ...leadScope(user) };
  if (f.stage) where.stageId = f.stage;
  if (f.from || f.to) {
    where.receivedAt = {
      ...(f.from ? { gte: parseBerlinLocal(`${f.from}T00:00`) } : {}),
      ...(f.to ? { lt: new Date(parseBerlinLocal(`${f.to}T00:00`).getTime() + 24 * 60 * 60 * 1000) } : {}),
    };
  }
  if (f.q) {
    // Die MySQL-Sortierung (utf8mb4_unicode_ci) ignoriert Groß-/Kleinschreibung bereits.
    where.OR = [
      { fullName: { contains: f.q } },
      { email: { contains: f.q } },
      { phone: { contains: f.q.replace(/\s/g, "") } },
    ];
  }
  return where;
}
