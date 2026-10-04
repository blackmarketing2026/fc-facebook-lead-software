import { after } from "next/server";
import { leadScope, seesAllTenants } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDateTime, formatTime } from "@/lib/format";
import { REMINDER_LEAD_MINUTES, reminderIcon, reminderLabel } from "@/lib/reminder-types";
import { getCurrentUser } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";
import { checkReminders } from "@/worker/reminders";

/** Neue Leads erscheinen so lange in der Glocke, bis sie bearbeitet sind – höchstens aber 7 Tage. */
const NEW_LEAD_DAYS = 7;

// Termin-Erinnerungen (Push/E-Mail) auch ohne externen Cron auslösen, solange jemand die App offen hat –
// höchstens einmal pro Minute und Server-Instanz.
let lastReminderCheck = 0;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });

  if (Date.now() - lastReminderCheck > 60_000) {
    lastReminderCheck = Date.now();
    after(() => checkReminders().catch((err) => console.error("[reminders]", err)));
  }

  const now = new Date();
  const soon = new Date(now.getTime() + REMINDER_LEAD_MINUTES * 60 * 1000);
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
      icon: reminderIcon(r.type),
      title: `${reminderLabel(r.type)}: ${r.lead.fullName ?? "Lead"}`,
      subtitle: r.dueAt < now ? `Überfällig seit ${formatDateTime(r.dueAt)}` : `Um ${formatTime(r.dueAt)} Uhr`,
      href: tenantPath(user.tenant.slug, `/leads/${r.lead.id}`),
      overdue: r.dueAt < now,
      dueAt: r.dueAt.toISOString(),
    })),
    ...newLeads.map((l) => ({
      id: l.id,
      kind: "lead" as const,
      icon: "✨",
      title: `Neuer Lead: ${l.fullName ?? "Unbekannt"}`,
      subtitle: `${allTenants ? `${l.tenant.name} · ` : ""}Eingang ${formatDateTime(l.receivedAt)}`,
      href: tenantPath(user.tenant.slug, `/leads/${l.id}`),
    })),
  ];
  return Response.json({ count: reminders.length + newLeadCount, items });
}
