import { db } from "@/lib/db";
import { buildIcsCalendar } from "@/lib/ics";
import { REMINDER_CALENDAR_SELECT, reminderEvent } from "@/lib/reminder-calendar";
import { PLATFORM_TENANT_SLUG, PRODUCT_NAME } from "@/lib/tenant-paths";

const PAST_DAYS = 30;

/**
 * Persönlicher Kalender-Abo-Feed (Google Kalender "Per URL", Outlook, Apple). Ohne Login, geschützt
 * durch den geheimen Token im Link. Enthält die offenen Termine des Benutzers ab 30 Tagen zurück.
 */
export async function GET(_request: Request, ctx: RouteContext<"/[tenant]/api/calendar/[token]">) {
  const { token } = await ctx.params;
  const cleanToken = token.replace(/\.ics$/, "");
  if (!/^[a-f0-9]{48}$/.test(cleanToken)) return new Response("Nicht gefunden", { status: 404 });

  const user = await db.user.findUnique({
    where: { calendarToken: cleanToken },
    select: { id: true, active: true, displayName: true, tenant: { select: { slug: true, name: true, status: true } } },
  });
  // Der Token allein identifiziert den Benutzer; Links zeigen immer auf sein eigenes Dashboard.
  if (!user || !user.active || user.tenant.status !== "ACTIVE") {
    return new Response("Nicht gefunden", { status: 404 });
  }

  const reminders = await db.reminder.findMany({
    where: { userId: user.id, done: false, dueAt: { gte: new Date(Date.now() - PAST_DAYS * 24 * 60 * 60 * 1000) } },
    orderBy: { dueAt: "asc" },
    take: 1000,
    select: REMINDER_CALENDAR_SELECT,
  });

  const dashboard = user.tenant.slug === PLATFORM_TENANT_SLUG ? PRODUCT_NAME : user.tenant.name;
  const ics = buildIcsCalendar(
    reminders.map((r) => reminderEvent(r, user.tenant.slug)),
    { name: `Leads – ${dashboard} (${user.displayName})` },
  );
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="termine.ics"',
      "Cache-Control": "no-store",
    },
  });
}
