import Link from "next/link";
import { openTenant } from "@/app/actions/platform";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";
import { CreateTenantForm } from "./platform-forms";

export const metadata = { title: "Plattform" };

export default async function PlatformPage() {
  const admin = await requirePlatformAdmin();
  const tenants = await db.tenant.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { leads: true, users: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Plattform</h1>
        <p className="text-sm text-slate-500">
          Alle Dashboards inklusive Entwicklungsumgebung. Jedes Dashboard ist unter seinem eigenen Pfad erreichbar, z. B.{" "}
          <code>/martin</code>. Von hier aus anlegen, öffnen, sperren und einstellen.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Dashboard</th>
              <th className="px-4 py-3">Adresse</th>
              <th className="px-4 py-3 text-right">Leads</th>
              <th className="px-4 py-3 text-right">Nutzer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map((t) => (
              <tr key={t.id} className="align-top">
                <td className="px-4 py-3 font-mono font-semibold tabular-nums">{t.code}</td>
                <td className="px-4 py-3">
                  <Link href={tenantPath(admin.tenant.slug, `/platform/tenants/${t.id}`)} className="font-medium text-blue-700 hover:underline">
                    {t.name}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {t.isDevelopment && <span className="badge bg-violet-100 text-violet-800">Entwicklung</span>}
                    {t.id === admin.tenantId && <span className="badge bg-slate-900 text-white">Plattform</span>}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-slate-600">/{t.slug}</td>
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
                  <form action={openTenant.bind(null, t.id)}>
                    <button className="btn-primary px-2 py-1 text-xs">Öffnen</button>
                  </form>
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
