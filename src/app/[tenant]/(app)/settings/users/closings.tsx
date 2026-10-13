import Link from "next/link";
import { leadScope, seesAllTenants } from "@/lib/access";
import { formatEuro, parsePeriod, recentPeriods, type Period, type PeriodKind } from "@/lib/commission";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import type { CurrentUser } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";

export type ClosingsFilter = { zeitraum?: string | string[]; periode?: string | string[] };

const KINDS: { key: PeriodKind | "all"; label: string }[] = [
  { key: "month", label: "Monate" },
  { key: "week", label: "Wochen" },
  { key: "all", label: "Gesamt" },
];

function one(v: string | string[] | undefined) {
  return typeof v === "string" ? v : undefined;
}

/** Abschnitte "Gesamteinnahmen" und "Abschlüsse" der Rubrik Mitglieder, gefiltert nach Monat oder Kalenderwoche. */
export async function Closings({ admin, filter }: { admin: CurrentUser; filter: ClosingsFilter }) {
  const now = new Date();
  const zeitraum = one(filter.zeitraum);
  const kind: PeriodKind | "all" = zeitraum === "week" || zeitraum === "all" ? zeitraum : "month";
  const options = kind === "all" ? [] : recentPeriods(kind, now, kind === "month" ? 24 : 26);
  const periodKey = one(filter.periode);
  const period: Period | null = kind === "all" ? null : ((periodKey && parsePeriod(kind, periodKey)) || options[0]);
  // Ältere Zeiträume aus einem Link trotzdem in der Auswahl zeigen.
  if (period && !options.some((o) => o.key === period.key)) options.push(period);

  const allTenants = seesAllTenants(admin);
  const scope = { ...leadScope(admin), status: "ABGESCHLOSSEN" as const, closedAt: { not: null } };
  const [closings, overall] = await Promise.all([
    db.lead.findMany({
      where: { ...scope, ...(period ? { closedAt: { gte: period.from, lt: period.to } } : {}) },
      orderBy: { closedAt: "desc" },
      take: 500,
      select: {
        id: true,
        fullName: true,
        commission: true,
        closedAt: true,
        assignedTo: { select: { id: true, displayName: true } },
        tenant: { select: { name: true } },
      },
    }),
    db.lead.aggregate({ where: scope, _sum: { commission: true }, _count: true }),
  ]);

  const rows = closings.map((c) => ({ ...c, amount: c.commission?.toNumber() ?? null }));
  const periodTotal = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const missing = rows.filter((r) => r.amount === null).length;
  const byMember = new Map<string, { name: string; count: number; total: number }>();
  for (const r of rows) {
    const key = r.assignedTo?.id ?? "-";
    const entry = byMember.get(key) ?? { name: r.assignedTo?.displayName ?? "Nicht zugewiesen", count: 0, total: 0 };
    entry.count += 1;
    entry.total += r.amount ?? 0;
    byMember.set(key, entry);
  }
  const members = [...byMember.values()].sort((a, b) => b.total - a.total);

  const base = tenantPath(admin.tenant.slug, "/settings/users");
  const href = (k: string, p?: string) => `${base}?zeitraum=${k}${p ? `&periode=${p}` : ""}#abschluesse`;
  const periodName = period ? period.label : "Gesamter Zeitraum";

  return (
    <>
      <section id="abschluesse" className="card scroll-mt-24 p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Gesamteinnahmen</h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-slate-200 p-0.5 text-sm">
              {KINDS.map((k) => (
                <Link
                  key={k.key}
                  href={href(k.key)}
                  className={`rounded px-3 py-1 ${kind === k.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {k.label}
                </Link>
              ))}
            </div>
            {period && (
              <form action={base} className="flex items-center gap-2">
                <input type="hidden" name="zeitraum" value={kind} />
                <select name="periode" defaultValue={period.key} className="input w-auto py-1.5 text-sm" aria-label="Zeitraum">
                  {options.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button className="btn-secondary py-1.5">Anzeigen</button>
              </form>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">{periodName}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{formatEuro(periodTotal)}</div>
            <div className="text-sm text-slate-500">
              {rows.length} {rows.length === 1 ? "Abschluss" : "Abschlüsse"}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Durchschnitt pro Abschluss</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {formatEuro(rows.length - missing > 0 ? periodTotal / (rows.length - missing) : 0)}
            </div>
            <div className="text-sm text-slate-500">{periodName}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Gesamteinnahmen insgesamt</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{formatEuro(overall._sum.commission?.toNumber() ?? 0)}</div>
            <div className="text-sm text-slate-500">
              {overall._count} {overall._count === 1 ? "Abschluss" : "Abschlüsse"} seit Beginn
            </div>
          </div>
        </div>

        {members.length > 0 && (
          <table className="mt-5 min-w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4">Mitglied</th>
                <th className="py-2 pr-4 text-right">Abschlüsse</th>
                <th className="py-2 text-right">Einnahmen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.name}>
                  <td className="py-2 pr-4 font-medium">{m.name}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{m.count}</td>
                  <td className="py-2 text-right tabular-nums">{formatEuro(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Abschlüsse</h2>
        <p className="mb-4 text-sm text-slate-500">
          {periodName}, neueste zuerst.
          {missing > 0 && ` Bei ${missing} ${missing === 1 ? "Abschluss fehlt" : "Abschlüssen fehlt"} noch die Provision.`}
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">Keine Abschlüsse in diesem Zeitraum.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Datum</th>
                  <th className="py-2 pr-4">Lead</th>
                  {allTenants && <th className="py-2 pr-4">Dashboard</th>}
                  <th className="py-2 pr-4">Mitglied</th>
                  <th className="py-2 text-right">Provision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{r.closedAt && formatDateTime(r.closedAt)}</td>
                    <td className="py-2 pr-4">
                      <Link href={tenantPath(admin.tenant.slug, `/leads/${r.id}`)} className="font-medium text-blue-700 hover:underline">
                        {r.fullName ?? "Unbekannt"}
                      </Link>
                    </td>
                    {allTenants && <td className="py-2 pr-4 text-slate-600">{r.tenant.name}</td>}
                    <td className="py-2 pr-4">{r.assignedTo?.displayName ?? "–"}</td>
                    <td className="py-2 text-right tabular-nums">
                      {r.amount === null ? <span className="text-amber-700">fehlt</span> : formatEuro(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
