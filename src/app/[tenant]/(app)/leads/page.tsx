import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { STATUS_LABELS, STATUSES } from "@/lib/labels";
import { leadListFilters, leadListWhere } from "@/lib/lead-filters";
import { requireUser } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";

export const metadata = { title: "Leads" };

const PAGE_SIZE = 50;

export default async function LeadsPage(props: PageProps<"/[tenant]/leads">) {
  const user = await requireUser();
  const base = tenantPath(user.tenant.slug, "/leads");
  const sp = await props.searchParams;
  const filters = leadListFilters(sp);
  const { q, status, from, to } = filters;
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  const where = leadListWhere(user, filters);

  const [leads, total] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.lead.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterParams = () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, status, from, to })) if (v) params.set(k, v);
    return params;
  };
  const pageHref = (p: number) => {
    const params = filterParams();
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `${base}?${s}` : base;
  };
  const canExport = user.role === "ADMIN";

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <span className="text-sm text-slate-500">{total} gesamt</span>
      </div>

      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <input name="q" defaultValue={q} placeholder="Name, E-Mail, Telefon …" className="input lg:col-span-2" />
        <select name="status" defaultValue={status} className="input">
          <option value="">Alle Status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
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
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-semibold">{lead.fullName || "Unbekannt"}</div><div className="mt-1 text-xs text-slate-500">{formatDateTime(lead.receivedAt)}</div></div><StatusBadge status={lead.status} /></div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">{lead.phone && <span>{lead.phone}</span>}</div>
          <div className="mt-3 border-t border-slate-100 pt-3 text-right text-sm font-semibold text-[var(--accent-dark)]">Lead öffnen →</div>
        </Link>)}
      </div>

      <div className="card hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Eingang</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3">E-Mail</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  Keine Leads gefunden.
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(lead.receivedAt)}</td>
                <td className="px-4 py-3 font-medium">
                  <Link href={`${base}/${lead.id}`} className="text-blue-700 hover:underline">
                    {lead.fullName || "Unbekannt"}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{lead.phone}</td>
                <td className="px-4 py-3">{lead.email}</td>
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
