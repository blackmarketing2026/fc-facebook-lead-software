import Link from "next/link";
import { openTenant, removeTenantMember } from "@/app/actions/platform";
import { RemoveMemberButton } from "@/components/remove-member-button";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import { PLATFORM_TENANT_SLUG, tenantPath } from "@/lib/tenant-paths";
import { PlatformGrantForm } from "./platform-grant-form";

export const metadata = { title: "Mitglieder Plattformen" };

export default async function PlatformMembersPage() {
  const admin = await requirePlatformAdmin();
  const tenants = await db.tenant.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      slug: true,
      status: true,
      isDevelopment: true,
      users: {
        orderBy: [{ role: "asc" }, { displayName: "asc" }],
        select: { id: true, displayName: true, email: true, role: true, active: true, isPlatformAdmin: true, platformGrants: { select: { tenantId: true } } },
      },
    },
  });
  const grantableTenants = tenants
    .filter((tenant) => tenant.slug !== PLATFORM_TENANT_SLUG)
    .map((tenant) => ({ id: tenant.id, name: tenant.name, code: tenant.code }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mitglieder Plattformen</h1>
        <p className="text-sm text-slate-500">
          Alle Mitglieder je Dashboard. Entfernte Mitglieder haben sofort keinen Zugang mehr.
        </p>
      </div>

      {tenants.length > 1 && (
        <nav className="flex flex-wrap gap-2 text-sm">
          {tenants.map((t) => (
            <a key={t.id} href={`#${t.slug}`} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50">
              {t.name} <span className="text-slate-400">({t.users.length})</span>
            </a>
          ))}
        </nav>
      )}

      {tenants.map((t) => (
        <section key={t.id} id={t.slug} className="card scroll-mt-24 p-5">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">Mitglieder Plattform {t.name}</h2>
            <span className="text-sm text-slate-500">
              ID <code>{t.code}</code> · <code>/{t.slug}</code>
            </span>
            {t.isDevelopment && <span className="badge bg-violet-100 text-violet-800">Entwicklung</span>}
            {t.status === "SUSPENDED" && <span className="badge bg-red-100 text-red-700">gesperrt</span>}
            <div className="ml-auto flex items-center gap-2">
              <Link href={tenantPath(admin.tenant.slug, `/platform/tenants/${t.id}`)} className="btn-secondary px-2 py-1 text-xs">
                Verwalten
              </Link>
              <form action={openTenant.bind(null, t.id)}>
                <button className="btn-primary px-2 py-1 text-xs">Öffnen</button>
              </form>
            </div>
          </div>

          {t.users.length === 0 ? (
            <p className="text-sm text-slate-500">Noch keine Mitglieder.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {t.users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="font-medium">{u.displayName}</span>
                  <span className={`badge ${u.role === "ADMIN" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>
                    {u.role === "ADMIN" ? "Admin" : "Vertrieb"}
                  </span>
                  {u.isPlatformAdmin && <span className="badge bg-amber-100 text-amber-800">Master</span>}
                  {u.platformGrants.length > 0 && <span className="badge bg-blue-100 text-blue-800">Stufe 2 · {u.platformGrants.length}</span>}
                  {!u.active && <span className="badge bg-red-100 text-red-700">deaktiviert</span>}
                  <span className="text-slate-500">{u.email}</span>
                  <div className="ml-auto">
                    {u.id !== admin.id && !u.isPlatformAdmin && (
                      <RemoveMemberButton action={removeTenantMember.bind(null, t.id, u.id)} name={u.displayName} />
                    )}
                  </div>
                  {!u.isPlatformAdmin && (
                    <PlatformGrantForm
                      userId={u.id}
                      selected={u.platformGrants.map((grant) => grant.tenantId)}
                      tenants={grantableTenants}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
