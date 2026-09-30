import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { formatDateTime, parseBerlinLocal, TIMEZONE } from "@/lib/format";
import { STATUS_LABELS, STATUSES } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { ReminderActions } from "../leads/[id]/lead-controls";

export const metadata = { title: "Dashboard · Function Concept - Facebook Lead Software" };

function startOfBerlinDay(offsetDays = 0): Date {
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: TIMEZONE }).format(new Date());
  return new Date(parseBerlinLocal(`${day}T00:00`).getTime() + offsetDays * 24 * 60 * 60 * 1000);
}

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const todayStart = startOfBerlinDay(0);
  const tomorrowStart = startOfBerlinDay(1);

  const [reminders, newLeads] = await Promise.all([
    db.reminder.findMany({
      where: { userId: user.id, done: false },
      orderBy: { dueAt: "asc" },
      take: 30,
      include: { lead: { select: { id: true, fullName: true, phone: true, status: true } } },
    }),
    db.lead.findMany({
      where: { assignedToId: user.id, status: "NEU" },
      orderBy: { receivedAt: "asc" },
      take: 20,
      select: { id: true, fullName: true, phone: true, receivedAt: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Hallo {user.displayName}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-1 font-semibold">📞 Als Nächstes anrufen</h2>
          <p className="mb-4 text-sm text-slate-500">Deine geplanten Rückrufe, der dringendste zuerst.</p>
          {reminders.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Keine offenen Rückrufe.</p>
          ) : (
            <ul className="space-y-2">
              {reminders.map((r) => {
                const overdue = r.dueAt < now;
                const today = !overdue && r.dueAt < tomorrowStart;
                return (
                  <li
                    key={r.id}
                    className={`rounded-lg border p-3 ${
                      overdue ? "border-red-200 bg-red-50" : today ? "border-amber-200 bg-amber-50" : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/leads/${r.lead.id}`} className="font-medium text-blue-700 hover:underline">
                        {r.lead.fullName ?? "Lead"}
                      </Link>
                      <span className={`text-xs font-medium ${overdue ? "text-red-700" : today ? "text-amber-800" : "text-slate-500"}`}>
                        {overdue ? "Überfällig · " : today ? "Heute · " : ""}
                        {formatDateTime(r.dueAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm text-slate-600">
                      {r.title}
                      {r.comment && ` – ${r.comment}`}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      {r.lead.phone ? (
                        <a href={`tel:${r.lead.phone.replace(/[^\d+]/g, "")}`} className="text-sm text-emerald-700 hover:underline">
                          {r.lead.phone}
                        </a>
                      ) : (
                        <span />
                      )}
                      <ReminderActions reminderId={r.id} done={false} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-semibold">✨ Neue Leads</h2>
          <p className="mb-4 text-sm text-slate-500">Noch nicht kontaktiert, der älteste zuerst.</p>
          {newLeads.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Keine neuen Leads.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {newLeads.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <Link href={`/leads/${l.id}`} className="font-medium text-blue-700 hover:underline">
                    {l.fullName ?? "Unbekannt"}
                  </Link>
                  <span className="text-xs text-slate-500">{formatDateTime(l.receivedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {user.role === "ADMIN" && <AdminStats todayStart={todayStart} />}
    </div>
  );
}

async function AdminStats({ todayStart }: { todayStart: Date }) {
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  const [salesUsers, today, week, byStatus, unassigned, latest] = await Promise.all([
    db.user.findMany({ where: { role: "SALES" }, orderBy: { distOrder: "asc" }, select: { id: true, displayName: true, active: true, distPaused: true } }),
    db.lead.groupBy({ by: ["assignedToId"], where: { receivedAt: { gte: todayStart } }, _count: true }),
    db.lead.groupBy({ by: ["assignedToId"], where: { receivedAt: { gte: weekStart } }, _count: true }),
    db.lead.groupBy({ by: ["status"], _count: true }),
    db.lead.count({ where: { assignedToId: null } }),
    db.lead.findMany({
      orderBy: { receivedAt: "desc" },
      take: 8,
      include: { assignedTo: { select: { displayName: true } } },
    }),
  ]);
  const countFor = (rows: { assignedToId: string | null; _count: number }[], id: string) =>
    rows.find((r) => r.assignedToId === id)?._count ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="card p-5 lg:col-span-1">
        <h2 className="mb-3 font-semibold">Leads pro Vertriebler</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="pb-2">Name</th>
              <th className="pb-2 text-right">Heute</th>
              <th className="pb-2 text-right">7 Tage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {salesUsers.map((u) => (
              <tr key={u.id}>
                <td className="py-2">
                  {u.displayName}
                  {(!u.active || u.distPaused) && <span className="ml-1 text-xs text-slate-400">(pausiert)</span>}
                </td>
                <td className="py-2 text-right tabular-nums">{countFor(today, u.id)}</td>
                <td className="py-2 text-right tabular-nums">{countFor(week, u.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {unassigned > 0 && (
          <p className="mt-3 text-sm text-amber-700">⚠️ {unassigned} Lead(s) ohne Zuweisung</p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Status-Übersicht</h2>
        <ul className="space-y-2 text-sm">
          {STATUSES.map((s) => (
            <li key={s} className="flex items-center justify-between">
              <Link href={`/leads?status=${s}`} className="hover:underline">
                {STATUS_LABELS[s]}
              </Link>
              <span className="tabular-nums">{byStatus.find((b) => b.status === s)?._count ?? 0}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Zuletzt eingegangen</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {latest.map((l) => (
            <li key={l.id} className="py-2">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/leads/${l.id}`} className="truncate font-medium text-blue-700 hover:underline">
                  {l.fullName ?? "Unbekannt"}
                </Link>
                <StatusBadge status={l.status} />
              </div>
              <div className="text-xs text-slate-500">
                {formatDateTime(l.receivedAt)} · {l.assignedTo?.displayName ?? "nicht zugewiesen"}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
