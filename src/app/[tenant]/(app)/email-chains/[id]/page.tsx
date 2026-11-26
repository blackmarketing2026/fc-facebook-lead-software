import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { tenantPath } from "@/lib/tenant-paths";
import { ChainEditor } from "./chain-editor";

export const metadata = { title: "E-Mail-Kette" };

export default async function ChainPage(props: PageProps<"/[tenant]/email-chains/[id]">) {
  const admin = await requireAdmin();
  const { id } = await props.params;
  const chain = await db.emailChain.findFirst({
    where: { id, tenantId: admin.tenantId },
    include: { triggerTag: { select: { name: true } }, steps: { orderBy: { position: "asc" } } },
  });
  if (!chain) notFound();
  const [tags, runs, sends] = await Promise.all([
    db.tag.findMany({ where: { tenantId: admin.tenantId }, orderBy: { name: "asc" }, select: { name: true } }),
    db.chainRun.findMany({
      where: { chainId: id },
      orderBy: { startedAt: "desc" },
      take: 25,
      include: { lead: { select: { id: true, fullName: true } } },
    }),
    db.chainSend.findMany({ where: { chainId: id }, orderBy: { sentAt: "desc" }, take: 25 }),
  ]);
  const leadNames = new Map(runs.map((r) => [r.leadId, r.lead.fullName ?? "Unbekannt"]));
  const base = tenantPath(admin.tenant.slug, "/email-chains");
  const leadsBase = tenantPath(admin.tenant.slug, "/leads");
  const RUN_LABEL = { ACTIVE: "läuft", DONE: "fertig", CANCELLED: "abgebrochen" } as const;
  const SEND_LABEL = { SENT: "✓ gesendet", FAILED: "✗ Fehler", SKIPPED: "– übersprungen" } as const;

  return (
    <div className="space-y-6">
      <Link href={base} className="text-sm text-slate-500 hover:text-slate-800">← Alle Ketten</Link>

      <ChainEditor
        chain={{ id: chain.id, name: chain.name, active: chain.active, tag: chain.triggerTag.name }}
        steps={chain.steps.map((s) => ({ id: s.id, type: s.type, subject: s.subject ?? "", body: s.body ?? "", waitValue: s.waitValue ?? 1, waitUnit: s.waitUnit ?? "DAYS", waitTime: s.waitTime ?? "" }))}
        knownTags={tags.map((t) => t.name)}
        testEmail={admin.email}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Leads in dieser Kette</h2>
          {runs.length === 0 ? (
            <p className="text-sm text-slate-500">Noch kein Lead gestartet. Die Kette startet, sobald ein Lead den Tag „{chain.triggerTag.name}“ bekommt (nur wenn die Kette aktiv ist).</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`${leadsBase}/${r.leadId}`} className="font-medium text-blue-700 hover:underline">{r.lead.fullName ?? "Unbekannt"}</Link>
                  <span className="text-xs text-slate-500">
                    {RUN_LABEL[r.status]} · Schritt {Math.min(r.currentStep, chain.steps.length)}/{chain.steps.length}
                    {r.status === "ACTIVE" && r.nextRunAt ? ` · nächster ${formatDateTime(r.nextRunAt)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Zuletzt verschickt</h2>
          {sends.length === 0 ? (
            <p className="text-sm text-slate-500">Noch keine E-Mail verschickt.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {sends.map((s) => (
                <li key={s.id} className="py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="truncate font-medium">{s.subject || "(ohne Betreff)"}</span>
                    <span className={`text-xs ${s.status === "SENT" ? "text-green-700" : s.status === "FAILED" ? "text-red-700" : "text-slate-500"}`}>{SEND_LABEL[s.status]}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {leadNames.get(s.leadId) ?? "Lead"} · {formatDateTime(s.sentAt)}
                    {s.error ? ` · ${s.error}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
