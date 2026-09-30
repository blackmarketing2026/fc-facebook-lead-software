import { db } from "@/lib/db";
import { getPlatformAdmin } from "@/lib/session";

/** Alle Daten eines Dashboards als JSON – für Archiv oder Umzug auf ein eigenes System. */
export async function GET(_request: Request, ctx: RouteContext<"/[tenant]/api/platform/tenants/[id]/export">) {
  const admin = await getPlatformAdmin();
  if (!admin) return new Response("Nicht gefunden", { status: 404 });
  const { id } = await ctx.params;

  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      leadRoutes: true,
      // Ohne Passwort-Hashes.
      users: {
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          role: true,
          active: true,
          distOrder: true,
          distWeight: true,
          distPaused: true,
          createdAt: true,
        },
      },
      leads: {
        orderBy: { receivedAt: "asc" },
        include: { answers: true, notes: true, reminders: true, activities: true },
      },
    },
  });
  if (!tenant) return new Response("Nicht gefunden", { status: 404 });

  const body = JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, tenant }, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dashboard-${tenant.slug}-${date}.json"`,
    },
  });
}
