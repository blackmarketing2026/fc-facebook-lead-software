import { db } from "../lib/db";
import { formatTime } from "../lib/format";
import { sendPushToUser } from "../lib/push";
import { reminderLabel } from "../lib/reminder-types";
import { tenantPath } from "../lib/tenant-paths";

const LEAD_TIME_MS = 5 * 60 * 1000; // 5 Minuten vorher erinnern

/** Schickt Push-Erinnerungen für fällige Rückrufe (einmal pro Termin). */
export async function checkReminders(): Promise<void> {
  const due = await db.reminder.findMany({
    where: { done: false, notifiedAt: null, dueAt: { lte: new Date(Date.now() + LEAD_TIME_MS) } },
    include: { lead: { select: { id: true, fullName: true, tenant: { select: { slug: true } } } } },
    take: 100,
  });
  for (const r of due) {
    // Erst markieren, dann senden: lieber eine Erinnerung verlieren als doppelt schicken.
    const claimed = await db.reminder.updateMany({ where: { id: r.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
    if (claimed.count === 0) continue;
    await sendPushToUser(r.userId, {
      title: `${reminderLabel(r.type)} fällig`,
      body: `${reminderLabel(r.type)}: ${r.lead.fullName ?? "Lead"} um ${formatTime(r.dueAt)}${r.title && r.title !== reminderLabel(r.type) ? ` – ${r.title}` : ""}`,
      url: tenantPath(r.lead.tenant.slug, `/leads/${r.lead.id}`),
      tag: `reminder-${r.id}`,
    });
  }
}
