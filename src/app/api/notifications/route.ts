import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });

  const now = new Date();
  const soon = new Date(now.getTime() + 15 * 60 * 1000);
  const [reminders, newLeads] = await Promise.all([
    db.reminder.findMany({
      where: { userId: user.id, done: false, dueAt: { lte: soon }, lead: { tenantId: user.tenantId } },
      orderBy: { dueAt: "asc" },
      include: { lead: { select: { id: true, fullName: true } } },
      take: 20,
    }),
    db.lead.findMany({
      where: { tenantId: user.tenantId, assignedToId: user.id, status: "NEU" },
      orderBy: { receivedAt: "desc" },
      select: { id: true, fullName: true, receivedAt: true },
      take: 20,
    }),
  ]);

  const items = [
    ...reminders.map((r) => ({
      id: r.id,
      kind: "reminder" as const,
      title: `Rückruf: ${r.lead.fullName ?? "Lead"}`,
      subtitle: `${r.dueAt < now ? "Überfällig seit" : "Fällig um"} ${formatDateTime(r.dueAt)}`,
      href: `/leads/${r.lead.id}`,
      overdue: r.dueAt < now,
    })),
    ...newLeads.map((l) => ({
      id: l.id,
      kind: "lead" as const,
      title: `Neuer Lead: ${l.fullName ?? "Unbekannt"}`,
      subtitle: `Eingang ${formatDateTime(l.receivedAt)}`,
      href: `/leads/${l.id}`,
    })),
  ];
  return Response.json({ count: items.length, items });
}
