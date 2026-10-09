import Link from "next/link";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { PLATFORM_TENANT_SLUG, tenantPath } from "@/lib/tenant-paths";
import { ROUTE_TYPE_LABELS } from "@/lib/lead-routing";
import { requireAdmin } from "@/lib/session";
import { ManualImportForm, ReprocessButton } from "./mailbox-controls";

export const metadata = { title: "Postfach" };

type LastRun = { at: string; ok: boolean; processed?: number; ignored?: number; message?: string };

export default async function MailboxPage() {
  const admin = await requireAdmin();
  const tenantId = admin.tenantId;
  const [lastRunSetting, mails, counts, routes] = await Promise.all([
    db.setting.findUnique({ where: { key: "imap.lastRun" } }),
    db.inboundEmail.findMany({
      where: { tenantId },
      orderBy: { receivedAt: "desc" },
      take: 50,
      include: { lead: { select: { id: true, fullName: true } } },
    }),
    db.inboundEmail.groupBy({ by: ["status"], where: { tenantId }, _count: true }),
    db.leadRoute.findMany({ where: { tenantId }, orderBy: { priority: "desc" } }),
  ]);
  const lastRun: LastRun | null = lastRunSetting ? JSON.parse(lastRunSetting.value) : null;
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const imapUser = process.env.IMAP_USER;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Postfach</h1>
        <p className="text-sm text-slate-500">
          Das zentrale Lead-Postfach wird regelmäßig abgerufen. Jede Mail mit einem gültigen Lead-JSON wird als Lead
          angelegt und über die Zuordnungsregeln dem richtigen Dashboard zugewiesen.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {routes.length > 0 ? (
            <>
              Leads landen in diesem Dashboard bei:{" "}
              {routes.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && " · "}
                  {ROUTE_TYPE_LABELS[r.type]} <code className="rounded bg-slate-100 px-1">{r.pattern}</code>
                </span>
              ))}
            </>
          ) : admin.tenant.slug === PLATFORM_TENANT_SLUG ? (
            "Dieses Dashboard bekommt alle Leads, für die keine andere Zuordnungsregel passt."
          ) : (
            "Noch keine Zuordnungsregel hinterlegt – Function Concept richtet sie im Plattform-Bereich ein."
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card p-4 sm:col-span-1">
          <div className="text-xs uppercase text-slate-500">Letzter Abruf (zentrales Postfach)</div>
          {lastRun ? (
            <>
              <div className={`mt-1 font-medium ${lastRun.ok ? "text-green-700" : "text-red-700"}`}>
                {lastRun.ok ? "✓ OK" : "✗ Fehler"}
              </div>
              <div className="text-xs text-slate-500">{formatDateTime(new Date(lastRun.at))}</div>
              {lastRun.message && <div className="mt-1 text-xs text-red-700">{lastRun.message}</div>}
            </>
          ) : (
            <div className="mt-1 text-sm text-slate-500">Worker lief noch nicht</div>
          )}
          <div className="mt-2 truncate text-xs text-slate-400">{imapUser && !imapUser.startsWith("PLATZHALTER") ? imapUser : "Kein Postfach konfiguriert"}</div>
        </div>
        {[
          ["PROCESSED", "Leads angelegt", "text-green-700"],
          ["IGNORED", "Ohne Lead (ignoriert)", "text-slate-700"],
          ["FAILED", "Fehlgeschlagen", "text-red-700"],
        ].map(([key, label, color]) => (
          <div key={key} className="card p-4">
            <div className="text-xs uppercase text-slate-500">{label}</div>
            <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{count(key)}</div>
          </div>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Lead manuell importieren</h2>
        <p className="mb-3 text-sm text-slate-500">
          JSON aus einer Lead-Mail einfügen, z. B. zum Testen, solange noch kein Postfach verbunden ist. Der Lead wird ganz
          normal verteilt.
        </p>
        <ManualImportForm />
      </section>

      <section className="card overflow-x-auto">
        <h2 className="px-5 pt-5 font-semibold">Letzte 50 Mails</h2>
        <table className="mt-3 min-w-full text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Eingang</th>
              <th className="px-4 py-3">Absender / Betreff</th>
              <th className="px-4 py-3">Ergebnis</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mails.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Noch keine Mails verarbeitet.
                </td>
              </tr>
            )}
            {mails.map((m) => (
              <tr key={m.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(m.receivedAt)}</td>
                <td className="max-w-md px-4 py-3">
                  <div className="truncate">{m.from}</div>
                  <div className="truncate text-xs text-slate-500">{m.subject}</div>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-blue-700">Rohtext</summary>
                    <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">{m.rawText}</pre>
                  </details>
                </td>
                <td className="px-4 py-3">
                  {m.status === "PROCESSED" && m.lead ? (
                    <Link href={tenantPath(admin.tenant.slug, `/leads/${m.lead.id}`)} className="text-green-700 hover:underline">
                      ✓ {m.lead.fullName ?? "Lead"}
                    </Link>
                  ) : (
                    <>
                      <span className={m.status === "FAILED" ? "text-red-700" : "text-slate-500"}>
                        {m.status === "FAILED" ? "✗ Fehler" : "– Kein Lead"}
                      </span>
                      {m.error && <div className="text-xs text-slate-500">{m.error}</div>}
                    </>
                  )}
                </td>
                <td className="px-4 py-3">{m.status !== "PROCESSED" && <ReprocessButton inboundId={m.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
