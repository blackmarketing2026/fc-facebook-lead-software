import { leadScope } from "@/lib/access";
import { db } from "@/lib/db";
import { buildIcs } from "@/lib/ics";
import { REMINDER_CALENDAR_SELECT, reminderEvent } from "@/lib/reminder-calendar";
import { getCurrentUser } from "@/lib/session";

export async function GET(_request: Request, ctx: RouteContext<"/[tenant]/api/reminders/[id]/ics">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await ctx.params;

  const reminder = await db.reminder.findFirst({
    where: { id, lead: leadScope(user) },
    select: REMINDER_CALENDAR_SELECT,
  });
  if (!reminder) return new Response("Nicht gefunden", { status: 404 });

  return new Response(buildIcs(reminderEvent(reminder, user.tenant.slug)), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="termin-${reminder.id}.ics"`,
    },
  });
}
