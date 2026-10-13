import { leadScope } from "@/lib/access";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";

type Kind = "new" | "assigned" | "unassigned";

/**
 * Änderungen seit ?since=<ISO-Zeit> für die Live-Benachrichtigung: neue Leads (Vertriebler: nur eigene) sowie
 * Leads, die jemand anderes dem Benutzer zugewiesen oder ihm weggenommen hat.
 * Ohne since nur die Serverzeit als Startpunkt.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });

  const now = new Date();
  const since = new Date(new URL(request.url).searchParams.get("since") ?? "");
  if (Number.isNaN(since.getTime())) return Response.json({ now: now.toISOString(), leads: [] });

  const window = { gt: since, lte: now };
  const [created, assignments] = await Promise.all([
    db.lead.findMany({
      where: { ...leadScope(user), createdAt: window },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { id: true, fullName: true },
    }),
    db.activity.findMany({
      where: { type: "ASSIGNED", createdAt: window, lead: { tenantId: user.tenantId }, NOT: { userId: user.id } },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { meta: true, lead: { select: { id: true, fullName: true } } },
    }),
  ]);

  const href = (id: string) => tenantPath(user.tenant.slug, `/leads/${id}`);
  const leads: { id: string; name: string | null; href: string; kind: Kind }[] = created.map((l) => ({
    id: l.id,
    name: l.fullName,
    href: href(l.id),
    kind: "new",
  }));
  const seen = new Set(leads.map((l) => l.id));
  for (const a of assignments) {
    const meta = (a.meta ?? {}) as { toUserId?: string; fromUserId?: string | null; auto?: boolean };
    // Automatische Zuweisung passiert beim Anlegen – die steht schon als neuer Lead in der Liste.
    if (meta.auto || seen.has(a.lead.id)) continue;
    const kind: Kind | null = meta.toUserId === user.id ? "assigned" : meta.fromUserId === user.id ? "unassigned" : null;
    if (!kind) continue;
    seen.add(a.lead.id);
    leads.push({ id: a.lead.id, name: a.lead.fullName, href: href(a.lead.id), kind });
  }

  return Response.json({ now: now.toISOString(), leads });
}
