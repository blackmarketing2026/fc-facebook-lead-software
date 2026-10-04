import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import Link from "next/link";
import { leadScope } from "@/lib/access";
import { db } from "@/lib/db";
import { formatTime, parseBerlinLocal, TIMEZONE } from "@/lib/format";
import { formatDuration, reminderIcon, reminderLabel } from "@/lib/reminder-types";
import { requireUser } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";
import { CalendarSubscription } from "./calendar-subscription";

export const metadata = { title: "Kalender" };

const DAY_MS = 24 * 60 * 60 * 1000;
const berlinDay = new Intl.DateTimeFormat("sv-SE", { timeZone: TIMEZONE }); // YYYY-MM-DD
const dayHeading = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });
const rangeFmt = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

/** Datum (YYYY-MM-DD) als UTC-Mitternacht – nur zum Rechnen mit Kalendertagen. */
function utcDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
const toDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => toDay(new Date(utcDate(day).getTime() + n * DAY_MS));

/** Adresse, unter der die App gerade aufgerufen wird (für den Abo-Link). */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Montag der Woche, in der day liegt. */
function mondayOf(day: string): string {
  const weekday = (utcDate(day).getUTCDay() + 6) % 7; // Mo = 0
  return addDays(day, -weekday);
}

export default async function CalendarPage(props: PageProps<"/[tenant]/calendar">) {
  const user = await requireUser();
  const slug = user.tenant.slug;
  const { week } = await props.searchParams;
  const today = berlinDay.format(new Date());
  const requested = typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today;
  const monday = mondayOf(requested);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const from = parseBerlinLocal(`${monday}T00:00`);
  const to = parseBerlinLocal(`${addDays(monday, 7)}T00:00`);

  // Vertriebler: eigene Termine. Admin: alle Termine des Dashboards (Hauptaccount: aller Dashboards).
  const scope: Prisma.ReminderWhereInput = user.role === "ADMIN" ? { lead: leadScope(user) } : { userId: user.id };
  const [reminders, me] = await Promise.all([
    db.reminder.findMany({
      where: { ...scope, dueAt: { gte: from, lt: to } },
      orderBy: { dueAt: "asc" },
      include: { lead: { select: { id: true, fullName: true } }, user: { select: { displayName: true } } },
    }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { calendarToken: true } }),
  ]);
  const byDay = new Map<string, typeof reminders>();
  for (const r of reminders) {
    const key = berlinDay.format(r.dueAt);
    byDay.set(key, [...(byDay.get(key) ?? []), r]);
  }
  const now = new Date();
  const weekLink = (day: string) => `${tenantPath(slug, "/calendar")}?week=${day}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Kalender</h1>
          <p className="text-sm text-slate-500">
            {user.role === "ADMIN" ? "Alle Termine und Aufgaben dieses Dashboards." : "Deine Termine und Aufgaben."} Woche vom{" "}
            {rangeFmt.format(utcDate(monday))} bis {rangeFmt.format(utcDate(days[6]))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={weekLink(addDays(monday, -7))} className="btn-secondary" aria-label="Vorherige Woche">
            ←
          </Link>
          <Link href={weekLink(today)} className="btn-secondary">
            Heute
          </Link>
          <Link href={weekLink(addDays(monday, 7))} className="btn-secondary" aria-label="Nächste Woche">
            →
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-7">
        {days.map((day) => {
          const items = byDay.get(day) ?? [];
          const isToday = day === today;
          return (
            <section key={day} className={`card min-h-28 p-3 ${isToday ? "ring-2 ring-blue-500" : ""}`}>
              <h2 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${isToday ? "text-blue-700" : "text-slate-500"}`}>
                {dayHeading.format(utcDate(day))}
                {isToday && " · Heute"}
              </h2>
              {items.length === 0 ? (
                <p className="text-xs text-slate-400">–</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((r) => {
                    const overdue = !r.done && r.dueAt < now;
                    return (
                      <li key={r.id}>
                        <Link
                          href={tenantPath(slug, `/leads/${r.lead.id}`)}
                          className={`block rounded-md border p-2 text-xs hover:bg-slate-50 ${
                            r.done
                              ? "border-slate-100 bg-slate-50 text-slate-400 line-through"
                              : overdue
                                ? "border-red-200 bg-red-50"
                                : "border-slate-200"
                          }`}
                          title={`${reminderLabel(r.type)} · ${formatDuration(r.durationMinutes)}${r.comment ? ` · ${r.comment}` : ""}`}
                        >
                          <div className={`font-semibold ${overdue ? "text-red-700" : "text-slate-700"}`}>
                            {formatTime(r.dueAt)} {reminderIcon(r.type)}
                          </div>
                          <div className="truncate font-medium text-blue-700">{r.lead.fullName ?? "Lead"}</div>
                          <div className="truncate text-slate-500">
                            {r.title !== reminderLabel(r.type) ? r.title : reminderLabel(r.type)}
                          </div>
                          {user.role === "ADMIN" && <div className="truncate text-slate-400">{r.user.displayName}</div>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <CalendarSubscription feedUrl={me.calendarToken ? `${await requestOrigin()}${tenantPath(slug, `/api/calendar/${me.calendarToken}.ics`)}` : null} />
    </div>
  );
}
