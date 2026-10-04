import { db } from "../lib/db";
import { formatTime } from "../lib/format";
import { sendPushToUser } from "../lib/push";
import { sendReminderMail } from "../lib/reminder-mail";
import { REMINDER_LEAD_MINUTES, reminderLabel } from "../lib/reminder-types";
import { tenantPath } from "../lib/tenant-paths";

const LEAD_TIME_MS = REMINDER_LEAD_MINUTES * 60 * 1000;
// Termine, die schon länger vorbei sind, nicht nachträglich melden (z. B. alte Einträge nach einem Update).
const MAX_LATE_MS = 60 * 60 * 1000;

/** Schickt Push und E-Mail für anstehende Termine – einmal pro Termin, 30 Minuten vorher. */
export async function checkReminders(): Promise<void> {
  const now = Date.now();
  const due = await db.reminder.findMany({
    where: { done: false, notifiedAt: null, dueAt: { gte: new Date(now - MAX_LATE_MS), lte: new Date(now + LEAD_TIME_MS) } },
    include: { lead: { select: { id: true, fullName: true, tenant: { select: { slug: true } } } } },
    take: 100,
  });
  for (const r of due) {
    // Erst markieren, dann senden: lieber eine Erinnerung verlieren als doppelt schicken.
    const claimed = await db.reminder.updateMany({ where: { id: r.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
    if (claimed.count === 0) continue;
    const label = reminderLabel(r.type);
    await Promise.all([
      sendPushToUser(r.userId, {
        title: `${label} um ${formatTime(r.dueAt)}`,
        body: `${label}: ${r.lead.fullName ?? "Lead"} um ${formatTime(r.dueAt)}${r.title && r.title !== label ? ` – ${r.title}` : ""}`,
        url: tenantPath(r.lead.tenant.slug, `/leads/${r.lead.id}`),
        tag: `reminder-${r.id}`,
      }).catch((err) => console.error("[push]", err)),
      sendReminderMail(r.id, null, true).catch((err) => console.error("[mail]", err)),
    ]);
  }
}
