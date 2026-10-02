import Link from "next/link";
import type { LeadStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { ACTIVITY_LABELS, STATUS_LABELS } from "@/lib/labels";
import { requireAdmin } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";

export const metadata = { title: "Log" };

const LIMIT = 300;

const CATEGORIES = {
  eingang: { label: "Eingang", color: "bg-blue-100 text-blue-800" },
  verarbeitung: { label: "Verarbeitung", color: "bg-slate-100 text-slate-700" },
  status: { label: "Status", color: "bg-purple-100 text-purple-800" },
  notiz: { label: "Notiz", color: "bg-amber-100 text-amber-800" },
} as const;
type Category = keyof typeof CATEGORIES;

type Entry = {
  id: string;
  at: Date;
  category: Category;
  title: string;
  detail?: string | null;
  tone?: "ok" | "error";
  user?: string | null;
  lead?: { id: string; name: string | null } | null;
};

function meta(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function statusLabel(value: unknown): string {
  return STATUS_LABELS[value as LeadStatus] ?? String(value ?? "?");
}

/** Protokoll des Dashboards: eingehende Mails, Verarbeitung, Statusänderungen und Notizen in einer Zeitleiste. */
export default async function LogPage(props: PageProps<"/[tenant]/log">) {
  const admin = await requireAdmin();
  const tenantId = admin.tenantId;
  const base = tenantPath(admin.tenant.slug, "/log");
  const sp = await props.searchParams;
  const filter = typeof sp.typ === "string" && sp.typ in CATEGORIES ? (sp.typ as Category) : null;

  const [mails, activities, notes, users] = await Promise.all([
    db.inboundEmail.findMany({
      where: { tenantId },
      orderBy: { receivedAt: "desc" },
      take: LIMIT,
      select: { id: true, receivedAt: true, from: true, subject: true, status: true, error: true, lead: { select: { id: true, fullName: true } } },
    }),
    db.activity.findMany({
      // Notizen kommen mit Text aus der Notiz-Tabelle, daher hier ausgelassen.
      where: { lead: { tenantId }, type: { not: "NOTE_ADDED" } },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      include: { user: { select: { displayName: true } }, lead: { select: { id: true, fullName: true, sourceEmailId: true } } },
    }),
    db.note.findMany({
      where: { lead: { tenantId } },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      include: { author: { select: { displayName: true } }, lead: { select: { id: true, fullName: true } } },
    }),
    db.user.findMany({ where: { tenantId }, select: { id: true, displayName: true } }),
  ]);
  const userName = (id: unknown) => users.find((u) => u.id === id)?.displayName ?? "unbekannt";

  const entries: Entry[] = [];

  for (const m of mails) {
    entries.push({
      id: `mail-in-${m.id}`,
      at: m.receivedAt,
      category: "eingang",
      title: "Mail eingegangen",
      detail: [m.subject, m.from].filter(Boolean).join(" · "),
    });
    entries.push({
      id: `mail-done-${m.id}`,
      at: m.receivedAt,
      category: "verarbeitung",
      title: m.status === "PROCESSED" ? "Lead angelegt" : m.status === "FAILED" ? "Verarbeitung fehlgeschlagen" : "Kein Lead erkannt (ignoriert)",
      detail: m.error,
      tone: m.status === "PROCESSED" ? "ok" : "error",
      lead: m.lead ? { id: m.lead.id, name: m.lead.fullName } : null,
    });
  }

  for (const a of activities) {
    // Leads aus dem Postfach stehen schon als "Lead angelegt" bei der Mail.
    if (a.type === "CREATED" && a.lead.sourceEmailId) continue;
    const info = meta(a.meta);
    let category: Category = "status";
    let detail: string | null = null;
    if (a.type === "CREATED") category = "verarbeitung";
    if (a.type === "ASSIGNED") {
      category = "verarbeitung";
      detail = `an ${userName(info.toUserId)}${info.auto ? " (automatische Verteilung)" : ""}`;
    }
    if (a.type === "STATUS_CHANGED") detail = `${statusLabel(info.from)} → ${statusLabel(info.to)}${info.auto ? " (automatisch)" : ""}`;
    if ((a.type === "REMINDER_SET" || a.type === "REMINDER_DONE") && typeof info.title === "string") detail = info.title;
    entries.push({
      id: `act-${a.id}`,
      at: a.createdAt,
      category,
      title: ACTIVITY_LABELS[a.type],
      detail,
      user: a.user?.displayName,
      lead: { id: a.lead.id, name: a.lead.fullName },
    });
  }

  for (const n of notes) {
    entries.push({
      id: `note-${n.id}`,
      at: n.createdAt,
      category: "notiz",
      title: "Notiz",
      detail: n.text,
      user: n.author.displayName,
      lead: { id: n.lead.id, name: n.lead.fullName },
    });
  }

  // Bei gleicher Zeit: Eingang vor Verarbeitung (in der absteigenden Liste also darunter).
  const order: Record<Category, number> = { eingang: 0, verarbeitung: 1, status: 2, notiz: 3 };
  const shown = entries
    .filter((e) => !filter || e.category === filter)
    .sort((a, b) => b.at.getTime() - a.at.getTime() || order[b.category] - order[a.category])
    .slice(0, LIMIT);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Log</h1>
        <p className="text-sm text-slate-500">
          Alles, was in diesem Dashboard passiert: eingehende Lead-Mails, ihre Verarbeitung, Zuweisungen,
          Statusänderungen und Notizen – die neuesten {LIMIT} Einträge.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={base} className={filter ? "btn-secondary py-1" : "btn-primary py-1"}>
          Alle
        </Link>
        {(Object.keys(CATEGORIES) as Category[]).map((key) => (
          <Link key={key} href={`${base}?typ=${key}`} className={filter === key ? "btn-primary py-1" : "btn-secondary py-1"}>
            {CATEGORIES[key].label}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Zeit</th>
              <th className="px-4 py-3">Art</th>
              <th className="px-4 py-3">Ereignis</th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Von</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Noch keine Einträge.
                </td>
              </tr>
            )}
            {shown.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{formatDateTime(e.at)}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${CATEGORIES[e.category].color}`}>{CATEGORIES[e.category].label}</span>
                </td>
                <td className="max-w-xl px-4 py-3">
                  <div className={e.tone === "ok" ? "text-green-700" : e.tone === "error" ? "text-red-700" : "font-medium"}>{e.title}</div>
                  {e.detail && <div className="whitespace-pre-wrap break-words text-xs text-slate-500">{e.detail}</div>}
                </td>
                <td className="px-4 py-3">
                  {e.lead && (
                    <Link href={tenantPath(admin.tenant.slug, `/leads/${e.lead.id}`)} className="text-blue-700 hover:underline">
                      {e.lead.name ?? "Lead"}
                    </Link>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{e.user ?? (e.category === "eingang" || e.category === "verarbeitung" ? "System" : "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
