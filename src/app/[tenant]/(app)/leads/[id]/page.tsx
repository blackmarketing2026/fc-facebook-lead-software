import type { ActivityType, LeadStatus } from "@prisma/client";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { getAccessibleLeadOr404 } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDateTime, telHref, TIMEZONE, whatsappNumber } from "@/lib/format";
import { ACTIVITY_LABELS, STATUS_LABELS } from "@/lib/labels";
import { isContactKey } from "@/lib/lead-parser";
import { requireUser } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";
import {
  ContactButtons,
  NoteForm,
  ReassignSelect,
  ReminderActions,
  ReminderForm,
  StatusSelect,
} from "./lead-controls";

export const metadata = { title: "Lead" };

/** Morgen 10:00 Uhr (Berlin) als Vorschlag für den Rückruf, im Format von datetime-local. */
function defaultDueValue(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: TIMEZONE }).format(tomorrow); // YYYY-MM-DD
  return `${day}T10:00`;
}

function activityText(type: ActivityType, meta: unknown, users: Map<string, string>): string {
  const m = (meta ?? {}) as Record<string, unknown>;
  switch (type) {
    case "STATUS_CHANGED":
      return `Status: ${STATUS_LABELS[m.from as LeadStatus] ?? m.from} → ${STATUS_LABELS[m.to as LeadStatus] ?? m.to}${m.auto ? " (automatisch)" : ""}`;
    case "ASSIGNED":
      return `Zugewiesen an ${users.get(m.toUserId as string) ?? "?"}${m.auto ? " (automatisch)" : ""}`;
    case "REMINDER_SET":
      return `Rückruf geplant für ${m.dueAt ? formatDateTime(new Date(m.dueAt as string)) : "?"}`;
    default:
      return ACTIVITY_LABELS[type];
  }
}

export default async function LeadDetailPage(props: PageProps<"/[tenant]/leads/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  await getAccessibleLeadOr404(user, id);

  const [lead, salesUsers] = await Promise.all([
    db.lead.findUniqueOrThrow({
      where: { id },
      include: {
        assignedTo: { select: { id: true, displayName: true } },
        answers: { orderBy: { position: "asc" } },
        notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { displayName: true } } } },
        reminders: { orderBy: [{ done: "asc" }, { dueAt: "asc" }], include: { user: { select: { displayName: true } } } },
        activities: { orderBy: { createdAt: "desc" }, include: { user: { select: { displayName: true } } } },
      },
    }),
    db.user.findMany({
      where: { tenantId: user.tenantId, role: "SALES", active: true },
      orderBy: { distOrder: "asc" },
      select: { id: true, displayName: true },
    }),
  ]);
  const userNames = new Map(salesUsers.map((u) => [u.id, u.displayName]));
  if (lead.assignedTo) userNames.set(lead.assignedTo.id, lead.assignedTo.displayName);

  const firstName = lead.fullName?.split(" ")[0] ?? "";
  const greeting = `Hallo ${firstName}, hier ist ${user.displayName}. Vielen Dank für deine Anfrage!`.replace("Hallo ,", "Hallo,");
  const waNumber = lead.phone ? whatsappNumber(lead.phone) : "";
  const now = new Date();

  const timeline = lead.activities;

  return (
    <div className="space-y-6">
      <div>
        <Link href={tenantPath(user.tenant.slug, "/leads")} className="text-sm text-slate-500 hover:text-slate-800">
          ← Alle Leads
        </Link>
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{lead.fullName || "Unbekannt"}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Eingegangen am {formatDateTime(lead.receivedAt)}
              {lead.language && ` · Sprache: ${lead.language}`}
            </p>
            <div className="mt-3 space-y-1 text-sm">
              {lead.phone && <div>📱 {lead.phone}</div>}
              {lead.email && <div>✉️ {lead.email}</div>}
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500">Status</span>
              <StatusSelect leadId={lead.id} status={lead.status} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500">Vertriebler</span>
              {user.role === "ADMIN" ? (
                <ReassignSelect leadId={lead.id} assignedToId={lead.assignedToId} users={salesUsers} />
              ) : (
                <span className="text-sm font-medium">{lead.assignedTo?.displayName}</span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <ContactButtons
            leadId={lead.id}
            telHref={lead.phone ? telHref(lead.phone) : null}
            whatsappHref={waNumber ? `https://wa.me/${waNumber}` : null}
            mailHref={
              lead.email
                ? `mailto:${lead.email}?subject=${encodeURIComponent("Deine Anfrage")}&body=${encodeURIComponent(
                    `${greeting}\n\n`,
                  )}`
                : null
            }
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Gesprächsprotokoll</h2>
            <NoteForm leadId={lead.id} />
            <ul className="mt-5 space-y-3">
              {lead.notes.length === 0 && <li className="text-sm text-slate-500">Noch keine Notizen.</li>}
              {lead.notes.map((n) => (
                <li key={n.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="mb-1 text-xs text-slate-500">
                    {formatDateTime(n.createdAt)} · {n.author.displayName}
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{n.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Angaben aus dem Formular</h2>
            <dl className="divide-y divide-slate-100">
              {lead.answers.filter((a) => !isContactKey(a.questionKey)).map((a) => (
                <div key={a.id} className="grid gap-1 py-2.5 sm:grid-cols-5 sm:gap-4">
                  <dt className="text-sm text-slate-500 sm:col-span-3">{a.questionLabel}</dt>
                  <dd className="text-sm font-medium sm:col-span-2">{(a.answers as string[]).join(", ") || "–"}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Rückruf planen</h2>
            <ReminderForm leadId={lead.id} defaultDue={defaultDueValue()} />
            {lead.reminders.length > 0 && (
              <ul className="mt-5 space-y-3">
                {lead.reminders.map((r) => {
                  const overdue = !r.done && r.dueAt < now;
                  return (
                    <li
                      key={r.id}
                      className={`rounded-lg border p-3 ${
                        r.done ? "border-slate-100 bg-slate-50 opacity-60" : overdue ? "border-red-200 bg-red-50" : "border-slate-200"
                      }`}
                    >
                      <div className="text-sm font-medium">
                        {r.done && "✓ "}
                        {r.title}
                      </div>
                      <div className={`text-xs ${overdue ? "text-red-700" : "text-slate-500"}`}>
                        {formatDateTime(r.dueAt)} · {r.user.displayName}
                        {overdue && " · überfällig"}
                      </div>
                      {r.comment && <p className="mt-1 text-sm text-slate-600">{r.comment}</p>}
                      <div className="mt-2">
                        <ReminderActions reminderId={r.id} done={r.done} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Chronik</h2>
            <ol className="relative space-y-3 border-l border-slate-200 pl-4">
              {timeline.map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-300" />
                  <div>{activityText(a.type, a.meta, userNames)}</div>
                  <div className="text-xs text-slate-500">
                    {formatDateTime(a.createdAt)}
                    {a.user && ` · ${a.user.displayName}`}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 text-xs text-slate-400">
              Aktueller Status: <StatusBadge status={lead.status} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
