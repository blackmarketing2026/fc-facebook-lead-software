import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { leadListFilters, leadListWhere } from "@/lib/lead-filters";
import { getCurrentUser } from "@/lib/session";

function csvCell(value: string | null | undefined): string {
  const v = value ?? "";
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV-Export der gefilterten Lead-Liste. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  if (user.role !== "ADMIN") {
    return new Response("Nur für Admins", { status: 403 });
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const leads = await db.lead.findMany({
    where: leadListWhere(user, leadListFilters(params)),
    orderBy: { receivedAt: "desc" },
    include: { assignedTo: { select: { displayName: true } }, stage: { select: { name: true } } },
    take: 10_000,
  });

  const header = ["Eingang", "Name", "Telefon", "E-Mail", "Sprache", "Phase", "Zugewiesen"];
  const rows = leads.map((l) =>
    [
      formatDateTime(l.receivedAt),
      l.fullName,
      l.phone,
      l.email,
      l.language,
      l.stage?.name,
      l.assignedTo?.displayName,
    ].map(csvCell),
  );
  // Semikolon + BOM, damit Excel (deutsch) die Datei direkt richtig öffnet.
  const csv = "﻿" + [header, ...rows].map((r) => r.join(";")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
    },
  });
}
