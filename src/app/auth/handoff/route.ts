import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { handoffError } from "@/lib/handoff";
import { createSession } from "@/lib/session";
import { getTenant } from "@/lib/tenant";

/** Einmal-Link aus dem Plattform-Bereich: meldet den Plattform-Admin ohne Passwort in diesem Dashboard an. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const tenant = await getTenant();
  if (!tenant || !token) return new Response("Nicht gefunden", { status: 404 });

  const row = await db.handoffToken.findUnique({ where: { id: token } });
  const error = handoffError(row, tenant.id);
  if (error || !row) return new Response(error ?? "Link ungültig", { status: 403 });

  // Nur einmal nutzbar – auch bei zwei gleichzeitigen Aufrufen.
  const claimed = await db.handoffToken.updateMany({ where: { id: token, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count === 0) return new Response("Link wurde bereits benutzt", { status: 403 });

  const user = await db.user.findUnique({ where: { id: row.userId }, select: { active: true, isPlatformAdmin: true } });
  if (!user?.active || !user.isPlatformAdmin) return new Response("Kein Zugriff", { status: 403 });

  await createSession({ userId: row.userId, tenantId: tenant.id, role: "ADMIN", operator: true });
  redirect("/dashboard");
}
