import Link from "next/link";
import { openTenant } from "@/app/actions/platform";
import { db } from "@/lib/db";
import { requirePlatformManager } from "@/lib/session";
import { PLATFORM_TENANT_SLUG, tenantPath } from "@/lib/tenant-paths";
import { CreateTenantForm } from "./platform-forms";
import { LoginLink } from "./login-link";

export const metadata = { title: "Plattformen" };

export default async function PlatformPage() {
  const admin = await requirePlatformManager();
  const master = admin.isPlatformAdmin && admin.tenant.slug === PLATFORM_TENANT_SLUG;
  const tenants = await db.tenant.findMany({
    where: master ? {} : { id: { in: admin.platformGrants.map((grant) => grant.tenantId) } },
    orderBy: { code: "asc" },
    include: { _count: { select: { leads: true, users: true } } },
  });
  const active = tenants.filter((tenant) => tenant.status === "ACTIVE").length;

  return <div className="space-y-7">
    <section className="platform-hero">
      <div><span className="platform-hero-kicker">{master ? "DEIN LEITSTAND" : "DEINE PLATTFORMEN"}</span><h1>Alle Plattformen im Blick.</h1><p>Öffne eine Plattform, verwalte Mitglieder oder teile den Login-Link direkt von hier.</p></div>
      <div className="platform-hero-stats"><div><strong>{tenants.length}</strong><span>Plattformen</span></div><div><strong>{active}</strong><span>Aktiv</span></div><div><strong>{tenants.reduce((sum, tenant) => sum + tenant._count.leads, 0)}</strong><span>Leads gesamt</span></div></div>
    </section>

    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Plattformen</h2><p className="text-sm text-slate-500">Wähle die Plattform aus, die du bearbeiten möchtest.</p></div><span className="text-sm text-slate-500">{tenants.length} Einträge</span></div>
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {tenants.map((tenant) => <article key={tenant.id} className="card platform-card p-5">
        <div className="mb-5 flex items-start justify-between gap-3"><span className="platform-card-mark">{tenant.name.slice(0, 2).toUpperCase()}</span><span className={`badge ${tenant.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{tenant.status === "ACTIVE" ? "Aktiv" : "Gesperrt"}</span></div>
        <div className="flex items-center gap-2"><h3 className="text-lg font-semibold">{tenant.name}</h3>{tenant.isDevelopment && <span className="badge bg-violet-50 text-violet-700">Entwicklung</span>}</div>
        <p className="mt-1 font-mono text-xs text-slate-500">ID {tenant.code} · /{tenant.slug}</p>
        <div className="platform-card-stats"><span><strong>{tenant._count.leads}</strong> Leads</span><span><strong>{tenant._count.users}</strong> Mitglieder</span></div>
        {master && <div className="mb-4"><LoginLink slug={tenant.slug} /></div>}
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <form action={openTenant.bind(null, tenant.id)}><button className="btn-primary">Plattform öffnen →</button></form>
          {master && <Link href={tenantPath(admin.tenant.slug, `/platform/tenants/${tenant.id}`)} className="btn-secondary">Verwalten</Link>}
        </div>
      </article>)}
    </div>

    {master && <details className="card group p-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">Neue Plattform anlegen <span className="text-xl text-slate-400 group-open:rotate-45">＋</span></summary><div className="mt-5 border-t border-slate-100 pt-5"><CreateTenantForm /></div></details>}
  </div>;
}
