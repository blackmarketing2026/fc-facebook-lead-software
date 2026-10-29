import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/features";
import { formatDateTime } from "@/lib/format";
import { STATUS_LABELS, STATUSES, statusesForTenant } from "@/lib/labels";
import { seesAllTenants } from "@/lib/access";
import { leadListFilters, leadListWhere } from "@/lib/lead-filters";
import { requireUser } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";
import { PoolClaimButton } from "./pool-claim-button";

export const metadata = { title: "Leads" };

const PAGE_SIZE = 50;

export default async function LeadsPage(props: PageProps<"/[tenant]/leads">) {
  const user = await requireUser();
  const base = tenantPath(user.tenant.slug, "/leads");
  const sp = await props.searchParams;
  const filters = leadListFilters(sp);
  const { q, status, assignee, from, to } = filters;
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  if (user.role === "SALES" && sp.pool === "1") {
    const where = { tenantId: user.tenantId, assignedToId: null };
    const [poolLeads, poolTotal] = await Promise.all([
      db.lead.findMany({ where, orderBy: { receivedAt: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: { id: true, fullName: true, phone: true, email: true, receivedAt: true, status: true } }),
      db.lead.count({ where }),
    ]);
    const poolPages = Math.max(1, Math.ceil(poolTotal / PAGE_SIZE));
    return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Freier Lead-Pool</h1><p className="text-sm text-slate-500">Leads ohne zuständigen Mitarbeiter. Übernimm einen Lead, um ihn vollständig zu bearbeiten.</p></div><Link href={base} className="btn-secondary">← Meine Leads</Link></div><div className="grid gap-3 md:grid-cols-2">{poolLeads.map((lead) => <article key={lead.id} className="card space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div><h2 className="font-semibold">{lead.fullName ?? "Unbekannt"}</h2><p className="text-xs text-slate-500">Eingang {formatDateTime(lead.receivedAt)}</p></div><StatusBadge status={lead.status} /></div><div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">{lead.phone && <span>{lead.phone}</span>}{lead.email && <span>{lead.email}</span>}</div><PoolClaimButton leadId={lead.id} /></article>)}{poolLeads.length === 0 && <div className="card p-8 text-center text-sm text-slate-500">Zurzeit sind keine Leads im Pool.</div>}</div>{poolPages > 1 && <div className="flex items-center justify-center gap-3 text-sm">{page > 1 && <Link href={`${base}?pool=1&page=${page - 1}`} className="btn-secondary">← Zurück</Link>}<span>Seite {page} von {poolPages}</span>{page < poolPages && <Link href={`${base}?pool=1&page=${page + 1}`} className="btn-secondary">Weiter →</Link>}</div>}</div>;
  }
  const where = leadListWhere(user, filters);
  const allTenants = seesAllTenants(user);

  const [leads, total, salesUsers, poolCount] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { assignedTo: { select: { displayName: true } }, tenant: { select: { name: true, code: true } } },
    }),
    db.lead.count({ where }),
    user.role === "ADMIN"
      ? db.user.findMany({ where: { tenantId: user.tenantId, OR: [{ role: "SALES" }, { role: "ADMIN", salesEnabled: true }] }, orderBy: { distOrder: "asc" }, select: { id: true, displayName: true } })
      : Promise.resolve([]),
    user.role === "SALES" ? db.lead.count({ where: { tenantId: user.tenantId, assignedToId: null } }) : Promise.resolve(0),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterParams = () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, status, assignee, from, to })) if (v) params.set(k, v);
    return params;
  };
  const pageHref = (p: number) => {
    const params = filterParams();
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `${base}?${s}` : base;
  };
  const canExport = user.role === "ADMIN" && hasFeature(user.tenant, "leads-csv-export");

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <span className="text-sm text-slate-500">{total} gesamt</span>
      </div>
      {user.role === "SALES" && <nav className="flex flex-wrap gap-2"><span className="btn-primary">Meine Leads</span><Link href={`${base}?pool=1`} className="btn-secondary">Freier Lead-Pool ({poolCount})</Link></nav>}

      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <input name="q" defaultValue={q} placeholder="Name, E-Mail, Telefon …" className="input lg:col-span-2" />
        <select name="status" defaultValue={status} className="input">
          <option value="">Alle Status</option>
          {(allTenants ? STATUSES : statusesForTenant(user.tenant.slug)).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {user.role === "ADMIN" && (
          <select name="assignee" defaultValue={assignee} className="input">
            <option value="">Alle Vertriebler</option>
            {salesUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
            <option value="none">Nicht zugewiesen</option>
          </select>
        )}
        <input type="date" name="from" defaultValue={from} className="input" aria-label="Von" />
        <input type="date" name="to" defaultValue={to} className="input" aria-label="Bis" />
        <div className="flex gap-2 lg:col-span-6">
          <button className="btn-primary">Filtern</button>
          <Link href={base} className="btn-secondary">
            Zurücksetzen
          </Link>
          {canExport && (
            <a href={tenantPath(user.tenant.slug, `/api/leads/export?${filterParams()}`)} className="btn-secondary ml-auto">
              CSV exportieren
            </a>
          )}
        </div>
      </form>

      <div className="space-y-3 md:hidden">
        {leads.length === 0 && <div className="card p-8 text-center text-sm text-slate-500">Keine Leads gefunden.</div>}
        {leads.map((lead) => <Link key={lead.id} href={`${base}/${lead.id}`} className="card lead-mobile-card block p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-semibold">{lead.fullName || "Unbekannt"}</div><div className="mt-1 text-xs text-slate-500">{allTenants && `${lead.tenant.name} · `}{formatDateTime(lead.receivedAt)}</div></div><StatusBadge status={lead.status} /></div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">{lead.phone && <span>{lead.phone}</span>}{user.role === "ADMIN" && <span>{lead.assignedTo?.displayName ?? "Nicht zugewiesen"}</span>}</div>
          <div className="mt-3 border-t border-slate-100 pt-3 text-right text-sm font-semibold text-[var(--accent-dark)]">Lead öffnen →</div>
        </Link>)}
      </div>

      <div className="card hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {allTenants && <th className="px-4 py-3">Plattform</th>}
              <th className="px-4 py-3">Eingang</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3">E-Mail</th>
              {user.role === "ADMIN" && <th className="px-4 py-3">Zugewiesen</th>}
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  Keine Leads gefunden.
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50">
                {allTenants && (
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-mono text-xs text-slate-400">{lead.tenant.code}</span> {lead.tenant.name}
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(lead.receivedAt)}</td>
                <td className="px-4 py-3 font-medium">
                  <Link href={`${base}/${lead.id}`} className="text-blue-700 hover:underline">
                    {lead.fullName || "Unbekannt"}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{lead.phone}</td>
                <td className="px-4 py-3">{lead.email}</td>
                {user.role === "ADMIN" && (
                  <td className="px-4 py-3">{lead.assignedTo?.displayName ?? <span className="text-slate-400">–</span>}</td>
                )}
                <td className="px-4 py-3">
                  <StatusBadge status={lead.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="btn-secondary">
              ← Zurück
            </Link>
          )}
          <span className="text-slate-500">
            Seite {page} von {pages}
          </span>
          {page < pages && (
            <Link href={pageHref(page + 1)} className="btn-secondary">
              Weiter →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
