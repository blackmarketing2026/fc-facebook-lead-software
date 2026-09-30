import { leadScope } from "@/lib/access";
import { db } from "@/lib/db";
import { buildIcs } from "@/lib/ics";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: Request, ctx: RouteContext<"/api/reminders/[id]/ics">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await ctx.params;

  const reminder = await db.reminder.findFirst({
    where: { id, lead: leadScope(user) },
    include: { lead: { select: { id: true, fullName: true, phone: true, email: true } } },
  });
  if (!reminder) return new Response("Nicht gefunden", { status: 404 });

  const baseUrl = process.env.APP_URL || new URL(request.url).origin;
  const leadUrl = `${baseUrl}/leads/${reminder.lead.id}`;
  const description = [
    reminder.title,
    reminder.comment,
    reminder.lead.phone && `Telefon: ${reminder.lead.phone}`,
    reminder.lead.email && `E-Mail: ${reminder.lead.email}`,
    `Lead: ${leadUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const ics = buildIcs({
    uid: reminder.id,
    start: reminder.dueAt,
    summary: `Rückruf: ${reminder.lead.fullName ?? "Lead"}`,
    description,
    url: leadUrl,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="rueckruf-${reminder.id}.ics"`,
    },
  });
}
