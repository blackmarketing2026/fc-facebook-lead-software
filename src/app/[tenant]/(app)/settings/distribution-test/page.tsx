import Link from "next/link";
import { seesAllTenants, tenantFilter } from "@/lib/access";
import { db } from "@/lib/db";
import { previewSequence } from "@/lib/distribution";
import { formatDateTime } from "@/lib/format";
import { mailerConfigured } from "@/lib/mailer";
import { requireAdmin } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";
import { DistributionTestForm } from "./distribution-test-form";

export const metadata = { title: "Verteilungstest" };

export default async function DistributionTestPage() {
  const admin = await requireAdmin();
  const scope = tenantFilter(admin);
  const allTenants = seesAllTenants(admin);
  const [leads, sales] = await Promise.all([
    db.lead.findMany({
      where: scope,
      orderBy: { receivedAt: "desc" },
      take: 100,
      select: { id: true, tenantId: true, fullName: true, receivedAt: true, assignedTo: { select: { displayName: true } }, tenant: { select: { name: true } } },
    }),
    db.user.findMany({
      where: { ...scope, role: "SALES" },
      orderBy: { distOrder: "asc" },
      select: {
        id: true,
        tenantId: true,
        tenant: { select: { name: true } },
        displayName: true,
        email: true,
        active: true,
        distPaused: true,
        notifyNewLeadEmail: true,
        distOrder: true,
        distWeight: true,
        distCurrent: true,
      },
    }),
  ]);
  const inRotation = sales.filter((u) => u.active && !u.distPaused);
  // Wer als Nächstes dran wäre – mit den echten aktuellen Zählern, ohne etwas zu speichern. Pro Dashboard getrennt.
  const nextIds = new Map<string, string>();
  for (const tid of new Set(inRotation.map((u) => u.tenantId))) {
    const id = previewSequence(inRotation.filter((u) => u.tenantId === tid), 1)[0];
    if (id) nextIds.set(tid, id);
  }
  const nameOf = (id: string | undefined) => sales.find((u) => u.id === id)?.displayName ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Verteilungstest</h1>
        <p className="max-w-3xl text-sm text-slate-500">
          Wähle einen vorhandenen Lead und weise ihn automatisch laut Verteilung oder einem bestimmten Vertriebler zu. Mail
          und Push gehen dabei genau so raus wie bei einem echten neuen Lead – so kannst du die Benachrichtigungen testen.
        </p>
      </div>

      {!mailerConfigured() && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Der Mailversand ist auf dem Server nicht eingerichtet – der Test zeigt dann nur die Zuweisung.
        </div>
      )}

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Lead zuweisen & benachrichtigen</h2>
        {leads.length === 0 ? (
          <p className="text-sm text-slate-500">
            Noch keine Leads vorhanden. Lege unter{" "}
            <Link href={tenantPath(admin.tenant.slug, "/settings/mailbox")} className="text-blue-700 underline">
              Postfach
            </Link>{" "}
            einen Testlead per „Lead manuell importieren“ an.
          </p>
        ) : (
          <DistributionTestForm
            leads={leads.map((l) => ({
              id: l.id,
              tenantId: l.tenantId,
              label: `${allTenants ? `${l.tenant.name} · ` : ""}${l.fullName ?? "Unbekannt"} · ${formatDateTime(l.receivedAt)} · ${l.assignedTo?.displayName ?? "nicht zugewiesen"}`,
            }))}
            sales={inRotation.map((u) => ({ id: u.id, tenantId: u.tenantId, name: u.displayName }))}
            nextByTenant={Object.fromEntries([...nextIds].map(([tid, id]) => [tid, nameOf(id)]))}
          />
        )}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="px-5 pt-5 font-semibold">Vertriebler & Benachrichtigungen</h2>
        <table className="mt-3 min-w-full text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {allTenants && <th className="px-4 py-3">Plattform</th>}
              <th className="px-4 py-3">Vertriebler</th>
              <th className="px-4 py-3">E-Mail</th>
              <th className="px-4 py-3">In der Verteilung</th>
              <th className="px-4 py-3">E-Mail bei neuem Lead</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.length === 0 && (
              <tr>
                <td colSpan={allTenants ? 5 : 4} className="px-4 py-6 text-center text-slate-500">
                  Noch keine Vertriebler angelegt.
                </td>
              </tr>
            )}
            {sales.map((u) => (
              <tr key={u.id}>
                {allTenants && <td className="whitespace-nowrap px-4 py-3 text-slate-600">{u.tenant.name}</td>}
                <td className="px-4 py-3 font-medium">
                  {u.displayName}
                  {nextIds.get(u.tenantId) === u.id && <span className="badge ml-2 bg-blue-100 text-blue-800">als Nächstes dran</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  {!u.active ? (
                    <span className="text-red-700">deaktiviert</span>
                  ) : u.distPaused ? (
                    <span className="text-amber-700">pausiert</span>
                  ) : (
                    <span className="text-green-700">✓ ja</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.notifyNewLeadEmail ? (
                    <span className="text-green-700">✓ an</span>
                  ) : (
                    <Link href={tenantPath(admin.tenant.slug, allTenants ? "/platform/members" : "/settings/users")} className="text-amber-700 underline">
                      aus – unter Mitglieder einschalten
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
