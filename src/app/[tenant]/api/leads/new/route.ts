import { leadScope } from "@/lib/access";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";

/**
 * Neue Leads seit ?since=<ISO-Zeit> für die Live-Benachrichtigung (Vertriebler: nur eigene).
 * Ohne since nur die Serverzeit als Startpunkt.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });

  const now = new Date();
  const since = new Date(new URL(request.url).searchParams.get("since") ?? "");
  if (Number.isNaN(since.getTime())) return Response.json({ now: now.toISOString(), leads: [] });

  const leads = await db.lead.findMany({
    where: { ...leadScope(user), createdAt: { gt: since, lte: now } },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { id: true, fullName: true },
  });
  return Response.json({
    now: now.toISOString(),
    leads: leads.map((l) => ({ id: l.id, name: l.fullName, href: tenantPath(user.tenant.slug, `/leads/${l.id}`) })),
  });
}
