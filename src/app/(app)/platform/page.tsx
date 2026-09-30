import Link from "next/link";
import { openTenant } from "@/app/actions/platform";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import { CreateTenantForm } from "./platform-forms";

export const metadata = { title: "Plattform" };

export default async function PlatformPage() {
  const admin = await requirePlatformAdmin();
  const tenants = await db.tenant.findMany({
    orderBy: [{ isDevelopment: "desc" }, { createdAt: "asc" }],
    include: { domains: { orderBy: { createdAt: "asc" } }, _count: { select: { leads: true, users: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Plattform</h1>
          <p className="text-sm text-slate-500">Alle Kunden-Dashboards. Von hier aus anlegen, öffnen, sperren und einstellen.</p>
        </div>
        <Link href="/platform/settings" className="btn-secondary">
          Plattform-Einstellungen
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Dashboard</th>
              <th className="px-4 py-3">Domains</th>
              <th className="px-4 py-3 text-right">Leads</th>
              <th className="px-4 py-3 text-right">Nutzer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map((t) => (
              <tr key={t.id} className="align-top">
                <td className="px-4 py-3">
                  <Link href={`/platform/tenants/${t.id}`} className="font-medium text-blue-700 hover:underline">
                    {t.name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {t.slug}
                    {t.isDevelopment && <span className="badge ml-2 bg-violet-100 text-violet-800">Entwicklung</span>}
                    {t.id === admin.tenantId && <span className="badge ml-2 bg-slate-900 text-white">Plattform</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {t.domains.length === 0 && <span className="text-slate-400">–</span>}
                  {t.domains.map((d) => (
                    <div key={d.id} className="whitespace-nowrap">
                      <span className={d.verified ? "text-green-700" : "text-amber-700"}>{d.verified ? "●" : "○"}</span> {d.hostname}
                    </div>
                  ))}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{t._count.leads}</td>
                <td className="px-4 py-3 text-right tabular-nums">{t._count.users}</td>
                <td className="px-4 py-3">
                  {t.status === "ACTIVE" ? (
                    <span className="badge bg-green-100 text-green-800">aktiv</span>
                  ) : (
                    <span className="badge bg-red-100 text-red-700">gesperrt</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {(t.domains.length > 0 || t.id === admin.tenantId) && (
                    <form action={openTenant.bind(null, t.id)}>
                      <button className="btn-primary px-2 py-1 text-xs">Öffnen</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Neues Dashboard anlegen</h2>
        <CreateTenantForm />
      </section>
    </div>
  );
}
