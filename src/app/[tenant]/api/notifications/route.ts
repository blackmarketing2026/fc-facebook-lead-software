import { leadScope, seesAllTenants } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";

/** Neue Leads erscheinen so lange in der Glocke, bis sie bearbeitet sind – höchstens aber 7 Tage. */
const NEW_LEAD_DAYS = 7;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });

  const now = new Date();
  const soon = new Date(now.getTime() + 15 * 60 * 1000);
  const allTenants = seesAllTenants(user);
  // Vertriebler: eigene Leads, Admin: alle des Dashboards, Hauptaccount: alle Dashboards.
  const newLeadWhere = {
    ...leadScope(user),
    status: "NEU" as const,
    createdAt: { gte: new Date(now.getTime() - NEW_LEAD_DAYS * 24 * 60 * 60 * 1000) },
  };
  const [reminders, newLeads, newLeadCount] = await Promise.all([
    db.reminder.findMany({
      where: { userId: user.id, done: false, dueAt: { lte: soon }, lead: { tenantId: user.tenantId } },
      orderBy: { dueAt: "asc" },
      include: { lead: { select: { id: true, fullName: true } } },
      take: 20,
    }),
    db.lead.findMany({
      where: newLeadWhere,
      orderBy: { createdAt: "desc" },
      select: { id: true, fullName: true, receivedAt: true, tenant: { select: { name: true } } },
      take: 30,
    }),
    db.lead.count({ where: newLeadWhere }),
  ]);

  const items = [
    ...reminders.map((r) => ({
      id: r.id,
      kind: "reminder" as const,
      title: `Rückruf: ${r.lead.fullName ?? "Lead"}`,
      subtitle: `${r.dueAt < now ? "Überfällig seit" : "Fällig um"} ${formatDateTime(r.dueAt)}`,
      href: tenantPath(user.tenant.slug, `/leads/${r.lead.id}`),
      overdue: r.dueAt < now,
    })),
    ...newLeads.map((l) => ({
      id: l.id,
      kind: "lead" as const,
      title: `Neuer Lead: ${l.fullName ?? "Unbekannt"}`,
      subtitle: `${allTenants ? `${l.tenant.name} · ` : ""}Eingang ${formatDateTime(l.receivedAt)}`,
      href: tenantPath(user.tenant.slug, `/leads/${l.id}`),
    })),
  ];
  return Response.json({ count: reminders.length + newLeadCount, items });
}
