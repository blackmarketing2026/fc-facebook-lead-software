import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteRoute, openTenant, setTenantStatus } from "@/app/actions/platform";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";
import { formatDateTime } from "@/lib/format";
import { ROUTE_TYPE_LABELS } from "@/lib/lead-routing";
import { requirePlatformAdmin } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";
import { AddAdminForm, AddRouteForm, FeatureToggle, RenameTenantForm } from "../../platform-forms";

export const metadata = { title: "Dashboard verwalten" };

export default async function TenantDetailPage(props: PageProps<"/[tenant]/platform/tenants/[id]">) {
  const admin = await requirePlatformAdmin();
  const { id } = await props.params;
  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      leadRoutes: { orderBy: [{ priority: "desc" }, { createdAt: "asc" }] },
      users: {
        orderBy: [{ role: "asc" }, { displayName: "asc" }],
        select: { id: true, displayName: true, username: true, email: true, role: true, active: true },
      },
      _count: { select: { leads: true } },
    },
  });
  if (!tenant) notFound();
  const isPlatform = tenant.id === admin.tenantId;
  const platformPath = tenantPath(admin.tenant.slug, "/platform");

  return (
    <div className="space-y-6">
      <div>
        <Link href={platformPath} className="text-sm text-slate-500 hover:text-slate-800">
          ← Plattform
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{tenant.name}</h1>
          {tenant.isDevelopment && <span className="badge bg-violet-100 text-violet-800">Entwicklung</span>}
          {tenant.status === "SUSPENDED" && <span className="badge bg-red-100 text-red-700">gesperrt</span>}
          <span className="text-sm text-slate-500">
            <code>/{tenant.slug}</code> · {tenant._count.leads} Leads · angelegt {formatDateTime(tenant.createdAt)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={openTenant.bind(null, tenant.id)}>
            <button className="btn-primary">Dashboard öffnen</button>
          </form>
          <a href={tenantPath(admin.tenant.slug, `/api/platform/tenants/${tenant.id}/export`)} className="btn-secondary">
            Daten exportieren (JSON)
          </a>
          {!isPlatform &&
            (tenant.status === "ACTIVE" ? (
              <form action={setTenantStatus.bind(null, tenant.id, "SUSPENDED")}>
                <button className="btn-danger">Dashboard sperren</button>
              </form>
            ) : (
              <form action={setTenantStatus.bind(null, tenant.id, "ACTIVE")}>
                <button className="btn-secondary">Sperre aufheben</button>
              </form>
            ))}
        </div>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Allgemein</h2>
        <RenameTenantForm tenantId={tenant.id} name={tenant.name} isDevelopment={tenant.isDevelopment} />
      </section>


      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Lead-Zuordnung</h2>
        <p className="mb-4 max-w-3xl text-sm text-slate-500">
          Alle Leads kommen im zentralen Postfach an. Passt eine dieser Regeln, landet der Lead in diesem Dashboard
          (höhere Priorität zuerst). Leads ohne passende Regel gehen an Function Concept. Beispiele: Empfänger{" "}
          <code>martin@function-concept.com</code> (Alias/Weiterleitung ins zentrale Postfach), Betreff{" "}
          <code>Martin</code>, JSON-Feld <code>mandant=martin</code>.
        </p>
        {tenant.leadRoutes.length > 0 && (
          <ul className="mb-4 divide-y divide-slate-100 text-sm">
            {tenant.leadRoutes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="text-slate-500">{ROUTE_TYPE_LABELS[r.type]}</span>
                <code className="rounded bg-slate-100 px-1.5 py-0.5">{r.pattern}</code>
                <span className="text-xs text-slate-400">Priorität {r.priority}</span>
                <form action={deleteRoute.bind(null, r.id)} className="ml-auto">
                  <button className="btn-danger px-2 py-1 text-xs">Löschen</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <AddRouteForm tenantId={tenant.id} />
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Feature-Schalter</h2>
        <p className="mb-4 text-sm text-slate-500">
          Neue Funktionen erst im Entwicklungs-Mandanten testen, dann hier pro Dashboard freischalten.
        </p>
        <ul className="space-y-3">
          {FEATURES.map((f) => (
            <li key={f.key} className="flex items-start gap-3">
              <FeatureToggle
                tenantId={tenant.id}
                featureKey={f.key}
                enabled={tenant.features.includes(f.key)}
                forced={tenant.isDevelopment}
              />
              <div>
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-xs text-slate-500">{f.description}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Nutzer</h2>
        <ul className="mb-5 divide-y divide-slate-100 text-sm">
          {tenant.users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="font-medium">{u.displayName}</span>
              <span className="text-slate-500">@{u.username}</span>
              <span className={`badge ${u.role === "ADMIN" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>
                {u.role === "ADMIN" ? "Admin" : "Vertrieb"}
              </span>
              {!u.active && <span className="badge bg-red-100 text-red-700">deaktiviert</span>}
              <span className="ml-auto text-slate-500">{u.email}</span>
            </li>
          ))}
        </ul>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Weiteren Admin anlegen</h3>
        <AddAdminForm tenantId={tenant.id} />
      </section>
    </div>
  );
}
